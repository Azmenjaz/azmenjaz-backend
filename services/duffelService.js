/**
 * Duffel Flight Booking Service
 * Docs: https://duffel.com/docs/api
 */

const axios = require('axios');

const DUFFEL_BASE = 'https://api.duffel.com';
const TOKEN = process.env.DUFFEL_API_TOKEN;

const duffel = axios.create({
  baseURL: DUFFEL_BASE,
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    'Duffel-Version': 'v2',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000,
});

/**
 * Search for flights.
 * Returns an offer_request id + list of offers.
 */
async function searchFlights({ origin, destination, date, returnDate = null, passengers = 1, cabinClass = 'economy' }) {
  const slices = [{ origin, destination, departure_date: date }];
  if (returnDate) {
    slices.push({ origin: destination, destination: origin, departure_date: returnDate });
  }

  const payload = {
    data: {
      slices,
      passengers: Array.from({ length: passengers }, () => ({ type: 'adult' })),
      cabin_class: cabinClass,
    },
  };

  const offerReqRes = await duffel.post('/air/offer_requests?return_offers=true', payload);
  const offerRequest = offerReqRes.data.data;

  const offers = (offerRequest.offers || []).slice(0, 20).map(formatOffer);
  return { offerRequestId: offerRequest.id, offers, isRoundTrip: !!returnDate };
}

/**
 * Get a single offer by ID (refreshes price).
 */
async function getOffer(offerId) {
  const res = await duffel.get(`/air/offers/${offerId}`);
  return formatOffer(res.data.data);
}

/**
 * Create an order (book the flight).
 * passengers: [{ title, given_name, family_name, born_on, gender, email, phone_number, passport_number }]
 */
async function createOrder({ offerId, passengers, paymentAmount, paymentCurrency, offerPassengerIds }) {
  const payload = {
    data: {
      type: 'instant',
      selected_offers: [offerId],
      passengers: passengers.map((p, i) => ({
        id: offerPassengerIds?.[i] || `passenger_${i}`,
        title: p.title || 'mr',
        given_name: p.given_name,
        family_name: p.family_name,
        born_on: p.born_on,
        gender: p.gender || 'm',
        email: p.email,
        phone_number: p.phone_number || '+966500000000',
        ...(p.passport_number ? {
          identity_documents: [{
            type: 'passport',
            unique_identifier: p.passport_number,
            expires_on: p.passport_expires || '2030-01-01',
            issuing_country_code: p.nationality || 'SA',
          }]
        } : {}),
      })),
      payments: [{
        type: 'balance',
        amount: String(paymentAmount),
        currency: paymentCurrency || 'SAR',
      }],
    },
  };

  const res = await duffel.post('/air/orders', payload);
  return res.data.data;
}

/**
 * Cancel an order.
 */
async function cancelOrder(orderId) {
  // First create a cancellation request
  const res = await duffel.post('/air/order_cancellations', {
    data: { order_id: orderId },
  });
  const cancellation = res.data.data;

  // Then confirm it
  await duffel.post(`/air/order_cancellations/${cancellation.id}/actions/confirm`);
  return cancellation;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const arabicMap = {
  'الرياض': 'RUH', 'جدة': 'JED', 'الدمام': 'DMM', 'المدينة': 'MED', 'المدينة المنورة': 'MED',
  'مكة': 'JED', 'ابها': 'AHB', 'أبها': 'AHB', 'الطائف': 'TIF', 'جازان': 'GIZ',
  'تبوك': 'TUU', 'القصيم': 'ELQ', 'بريدة': 'ELQ', 'حائل': 'HAS', 'نجران': 'EAM',
  'ينبع': 'YNB', 'العلا': 'ULH', 'الباحة': 'ABT', 'الأحساء': 'HOF', 'عرعر': 'RAE',
  'شرورة': 'SHW', 'دبي': 'DXB', 'ابوظبي': 'AUH', 'أبوظبي': 'AUH', 'الشارقة': 'SHJ',
  'الدوحة': 'DOH', 'المنامة': 'BAH', 'البحرين': 'BAH', 'مسقط': 'MCT', 'الكويت': 'KWI',
  'القاهرة': 'CAI', 'الاسكندرية': 'HBE', 'الإسكندرية': 'HBE', 'شرم الشيخ': 'SSH',
  'الغردقة': 'HRG', 'الأقصر': 'LXR', 'عمان': 'AMM', 'بيروت': 'BEY', 'بغداد': 'BGW',
  'أربيل': 'EBL', 'الخرطوم': 'KRT', 'تونس': 'TUN', 'الدار البيضاء': 'CMN',
  'مراكش': 'RAK', 'الجزائر': 'ALG', 'طرابلس': 'TIP', 'إسطنبول': 'IST', 'اسطنبول': 'IST',
  'أنقرة': 'ESB', 'انطاليا': 'AYT', 'أنطاليا': 'AYT', 'طرابزون': 'TZX', 'بودروم': 'BJV',
  'إزمير': 'ADB', 'لندن': 'LHR', 'باريس': 'CDG', 'مدريد': 'MAD', 'برشلونة': 'BCN',
  'روما': 'FCO', 'ميلان': 'MXP', 'ميلانو': 'MXP', 'امستردام': 'AMS', 'أمستردام': 'AMS',
  'فرانكفورت': 'FRA', 'ميونخ': 'MUC', 'برلين': 'BER', 'فيينا': 'VIE', 'جنيف': 'GVA',
  'زيورخ': 'ZRH', 'بروكسل': 'BRU', 'أثينا': 'ATH', 'لشبونة': 'LIS', 'موسكو': 'SVO',
  'براغ': 'PRG', 'وارسو': 'WAW', 'بودابست': 'BUD', 'كوبنهاغن': 'CPH', 'ستوكهولم': 'ARN',
  'أوسلو': 'OSL', 'هلسنكي': 'HEL', 'دبلن': 'DUB', 'مانشستر': 'MAN', 'نيس': 'NCE',
  'ليون': 'LYS', 'البندقية': 'VCE', 'فلورنسا': 'FLR', 'مالقا': 'AGP', 'إشبيلية': 'SVQ',
  'بانكوك': 'BKK', 'كوالالمبور': 'KUL', 'جاكرتا': 'CGK', 'سنغافورة': 'SIN',
  'طوكيو': 'NRT', 'سيول': 'ICN', 'بكين': 'PEK', 'شنغهاي': 'PVG', 'هونغ كونغ': 'HKG',
  'هونج كونج': 'HKG', 'مومباي': 'BOM', 'نيودلهي': 'DEL', 'نيو دلهي': 'DEL',
  'كولومبو': 'CMB', 'مالديف': 'MLE', 'المالديف': 'MLE', 'ماليه': 'MLE', 'بالي': 'DPS',
  'مانيلا': 'MNL', 'هانوي': 'HAN', 'تايبيه': 'TPE', 'نيروبي': 'NBI', 'أديس أبابا': 'ADD',
  'اديس ابابا': 'ADD', 'دار السلام': 'DAR', 'كيب تاون': 'CPT', 'جوهانسبرغ': 'JNB',
  'نيويورك': 'JFK', 'لوس أنجلوس': 'LAX', 'لوس انجلوس': 'LAX', 'شيكاغو': 'ORD',
  'واشنطن': 'IAD', 'ميامي': 'MIA', 'سان فرانسيسكو': 'SFO', 'تورنتو': 'YYZ',
  'ساو باولو': 'GRU', 'بوينس آيرس': 'EZE', 'سيدني': 'SYD', 'ملبورن': 'MEL',
  'إسلام اباد': 'ISB', 'اسلام اباد': 'ISB', 'لاهور': 'LHE', 'كراتشي': 'KHI',
  'كابل': 'KBL', 'طشقند': 'TAS', 'باكو': 'GYD', 'تبليسي': 'TBS', 'يريفان': 'EVN',
};

function formatOffer(offer) {
  const slice = offer.slices?.[0];
  const seg = slice?.segments?.[0];

  return {
    id: offer.id,
    totalAmount: offer.total_amount,
    totalCurrency: offer.total_currency,
    baseAmount: offer.base_amount,
    taxAmount: offer.tax_amount,
    expiresAt: offer.expires_at,
    cabinClass: offer.cabin_class || slice?.cabin_class || 'economy', // formal class
    fareBrand: slice?.fare_brand_name || '', // airline's brand name
    // Passenger IDs assigned by Duffel (required for booking)
    passengerIds: (offer.passengers || []).map(p => p.id),
    // Airline
    airline: seg?.marketing_carrier?.name || '—',
    airlineIata: seg?.marketing_carrier?.iata_code || '',
    airlineLogo: seg?.marketing_carrier?.logo_symbol_url || null,
    flightNumber: seg ? `${seg.marketing_carrier_flight_number}` : '',
    // Route
    origin: seg?.origin?.iata_code || slice?.origin?.iata_code,
    originName: seg?.origin?.name || slice?.origin?.name,
    destination: seg?.destination?.iata_code || slice?.destination?.iata_code,
    destinationName: seg?.destination?.name || slice?.destination?.name,
    departsAt: seg?.departing_at,
    arrivesAt: seg?.arriving_at,
    duration: slice?.duration || null,
    stops: (slice?.segments?.length || 1) - 1,
    passengers: offer.passengers,
  };
}

// English city name mapping (for display in autocomplete results)
const iataToEnglish = {
  RUH: 'Riyadh', JED: 'Jeddah', DMM: 'Dammam', MED: 'Madinah', AHB: 'Abha',
  TIF: 'Taif', GIZ: 'Jazan', TUU: 'Tabuk', ELQ: 'Qassim', HAS: 'Hail',
  EAM: 'Najran', YNB: 'Yanbu', ULH: 'AlUla', ABT: 'Baha', HOF: 'Al-Ahsa',
  RAE: 'Arar', SHW: 'Sharurah', DXB: 'Dubai', AUH: 'Abu Dhabi', SHJ: 'Sharjah',
  DOH: 'Doha', BAH: 'Bahrain', MCT: 'Muscat', KWI: 'Kuwait City',
  CAI: 'Cairo', HBE: 'Alexandria', SSH: 'Sharm el-Sheikh', HRG: 'Hurghada',
  LXR: 'Luxor', AMM: 'Amman', BEY: 'Beirut', BGW: 'Baghdad', EBL: 'Erbil',
  KRT: 'Khartoum', TUN: 'Tunis', CMN: 'Casablanca', RAK: 'Marrakech',
  ALG: 'Algiers', TIP: 'Tripoli', IST: 'Istanbul', ESB: 'Ankara',
  AYT: 'Antalya', LHR: 'London', CDG: 'Paris', MAD: 'Madrid', BCN: 'Barcelona',
  FCO: 'Rome', MXP: 'Milan', AMS: 'Amsterdam', FRA: 'Frankfurt', MUC: 'Munich',
  BER: 'Berlin', JFK: 'New York', LAX: 'Los Angeles', ORD: 'Chicago',
  IAD: 'Washington DC', MIA: 'Miami', SFO: 'San Francisco',
  BKK: 'Bangkok', KUL: 'Kuala Lumpur', SIN: 'Singapore', NRT: 'Tokyo',
  ICN: 'Seoul', PEK: 'Beijing', PVG: 'Shanghai', HKG: 'Hong Kong',
  BOM: 'Mumbai', DEL: 'New Delhi', SYD: 'Sydney', MEL: 'Melbourne',
};

/**
 * Suggest locations (cities/airports) based on a query string.
 * For Arabic input: searches the local arabicMap (no Duffel call needed).
 * For English/IATA input: calls Duffel /places/suggestions.
 */
async function suggestLocations(query) {
  if (!query || query.length < 2) return [];

  const isArabic = /[\u0600-\u06FF]/.test(query);

  if (isArabic) {
    // Search arabicMap locally — Duffel does not understand Arabic text
    const matches = Object.entries(arabicMap).filter(([name]) => name.includes(query));
    if (matches.length === 0) return [];

    // Deduplicate by IATA code and return up to 8 results
    const seen = new Set();
    return matches
      .filter(([, iata]) => { if (seen.has(iata)) return false; seen.add(iata); return true; })
      .slice(0, 8)
      .map(([arabicName, iata]) => ({
        iata_code: iata,
        name: iataToEnglish[iata] || iata,
        city_name: arabicName,
        country_name: '',
        type: 'airport',
      }));
  }

  // English text or IATA code — call Duffel directly
  try {
    console.log('[Duffel Service] Requesting suggestions for:', query);
    const res = await duffel.get('/places/suggestions', { params: { query } });
    return res.data.data;
  } catch (err) {
    console.error('[Duffel Service] Error fetching suggestions:', err.response?.data || err.message);
    throw err;
  }
}

module.exports = { searchFlights, getOffer, createOrder, cancelOrder, suggestLocations };
