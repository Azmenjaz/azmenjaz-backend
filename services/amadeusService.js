const Amadeus = require('amadeus');
require('dotenv').config();

const amadeus = (process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET)
  ? new Amadeus({
    clientId: process.env.AMADEUS_CLIENT_ID,
    clientSecret: process.env.AMADEUS_CLIENT_SECRET,
    hostname: 'test'
  })
  : null;

if (!amadeus) {
  console.warn('⚠️ Amadeus API keys are missing. Flight search will not work.');
}

class AmadeusService {
  static async searchFlights(origin, destination, date, returnDate = null, travelClass = null) {
    try {
      console.log('🔍 Searching flights:', { origin, destination, date, returnDate, travelClass });

      const searchParams = {
        originLocationCode: origin,
        destinationLocationCode: destination,
        departureDate: date,
        adults: '1',
        currencyCode: 'SAR',
        max: '60',
        nonStop: 'false'
      };

      if (returnDate) {
        searchParams.returnDate = returnDate;
      }

      if (travelClass && travelClass !== 'ECONOMY') {
        searchParams.travelClass = travelClass;
      }

      const response = await amadeus.shopping.flightOffersSearch.get(searchParams);

      console.log('✅ Amadeus API Response:', response.data.length, 'flights found');

      if (!response.data || response.data.length === 0) {
        return {
          success: true,
          flights: [],
          message: 'لم يتم العثور على رحلات'
        };
      }

      // معالجة البيانات
      const flights = response.data.map(offer => {
        // استخراج معلومات الشنط (Checked Bags) من أول قطعة في أول رحلة
        const fareDetails = offer.travelerPricings[0].fareDetailsBySegment[0];
        const baggage = fareDetails.includedCheckedBags;

        const processedFlight = {
          id: offer.id,
          price: parseFloat(offer.price.total),
          airline: this.getAirlineName(offer.validatingAirlineCodes[0]),
          airlineCode: offer.validatingAirlineCodes[0],
          currency: offer.price.currency,
          itineraries: offer.itineraries.map(itinerary => ({
            duration: itinerary.duration,
            segments: itinerary.segments,
            departure: itinerary.segments[0].departure,
            arrival: itinerary.segments[itinerary.segments.length - 1].arrival,
            isDirect: itinerary.segments.length === 1
          })),
          baggage: baggage ? (baggage.quantity !== undefined ? baggage.quantity : (baggage.weight ? `${baggage.weight}${baggage.weightUnit}` : '0')) : '0',
          cabin: travelClass || fareDetails.cabin
        };

        return processedFlight;
      });

      // ترتيب حسب السعر
      flights.sort((a, b) => a.price - b.price);

      return {
        success: true,
        flights: flights
      };

    } catch (error) {
      console.error('❌ Amadeus API Error:', error);

      // معالجة الأخطاء المختلفة
      if (error.response) {
        console.error('Error response:', error.response.data);
        return {
          success: false,
          error: 'فشل في الاتصال بخدمة الرحلات',
          details: error.response.data
        };
      }

      return {
        success: false,
        error: error.message || 'حدث خطأ غير متوقع'
      };
    }
  }

  // الحصول على سعر رحلة واحدة (للاستخدام في Cron Job)
  static async getFlightPrice(origin, destination, date) {
    try {
      const response = await amadeus.shopping.flightOffersSearch.get({
        originLocationCode: origin,
        destinationLocationCode: destination,
        departureDate: date,
        adults: '1',
        currencyCode: 'SAR',
        max: '5'
      });

      if (!response.data || response.data.length === 0) {
        return null;
      }

      const prices = response.data.map(offer => ({
        price: parseFloat(offer.price.total),
        airline: offer.validatingAirlineCodes[0],
        currency: offer.price.currency
      }));

      prices.sort((a, b) => a.price - b.price);

      return {
        price: prices[0].price,
        airline: this.getAirlineName(prices[0].airline),
        allPrices: prices
      };

    } catch (error) {
      console.error('❌ getFlightPrice Error:', error.message);
      return null;
    }
  }

  // تحويل كود شركة الطيران إلى اسم عربي
  static getAirlineName(code) {
    const airlines = {
      'XY': 'طيران ناس',
      'F3': 'طيران أديل',
      'SV': 'الخطوط السعودية',
      'G9': 'طيران العربية',
      'FZ': 'فلاي دبي',
      'QR': 'القطرية',
      'EK': 'طيران الإمارات',
      'EY': 'الاتحاد للطيران',
      'MS': 'مصر للطيران',
      'RJ': 'الملكية الأردنية',
      'GF': 'طيران الخليج',
      'WY': 'الطيران العُماني',
      'KU': 'الخطوط الكويتية',
      'TK': 'الخطوط التركية',
      'PC': 'بيجاسوس',
      'LH': 'لوفتهانزا',
      'BA': 'الخطوط البريطانية',
      'AF': 'الخطوط الفرنسية',
      'KL': 'كي إل إم',
      'AZ': 'إيتا إيرويز',
      'IB': 'إيبيريا',
      'LX': 'سويس',
      'OS': 'النمساوية',
      'A3': 'إيجين إير',
      'LO': 'لوت البولندية',
      'TP': 'تاب البرتغالية',
      'AY': 'فين إير',
      'SQ': 'الخطوط السنغافورية',
      'TG': 'الخطوط التايلاندية',
      'MH': 'الخطوط الماليزية',
      'CX': 'كاثي باسيفيك',
      'GA': 'جارودا إندونيسيا',
      'AI': 'الخطوط الهندية',
      'PK': 'الخطوط الباكستانية',
      'UL': 'سريلانكان',
      'ME': 'طيران الشرق الأوسط',
      'ET': 'الخطوط الإثيوبية',
      'KQ': 'الخطوط الكينية'
    };
    return airlines[code] || code;
  }

  // البحث عن المدن والمطارات (Autocomplete)
  static async searchCities(keyword) {
    try {
      // Manual mapping for common Arabic city names
      const arabicMap = {
        // Saudi Cities
        'الرياض': 'RUH',
        'جدة': 'JED',
        'الدمام': 'DMM',
        'المدينة': 'MED',
        'المدينة المنورة': 'MED',
        'مكة': 'JED',
        'ابها': 'AHB',
        'أبها': 'AHB',
        'الطائف': 'TIF',
        'جازان': 'GIZ',
        'تبوك': 'TUU',
        'القصيم': 'ELQ',
        'بريدة': 'ELQ',
        'حائل': 'HAS',
        'نجران': 'EAM',
        'ينبع': 'YNB',
        'العلا': 'ULH',
        'الباحة': 'ABT',
        'الأحساء': 'HOF',
        'عرعر': 'RAE',
        'شرورة': 'SHW',
        // Gulf Countries
        'دبي': 'DXB',
        'ابوظبي': 'AUH',
        'أبوظبي': 'AUH',
        'الشارقة': 'SHJ',
        'الدوحة': 'DOH',
        'المنامة': 'BAH',
        'البحرين': 'BAH',
        'مسقط': 'MCT',
        'الكويت': 'KWI',
        // Middle East
        'القاهرة': 'CAI',
        'الاسكندرية': 'HBE',
        'الإسكندرية': 'HBE',
        'شرم الشيخ': 'SSH',
        'الغردقة': 'HRG',
        'الأقصر': 'LXR',
        'عمان': 'AMM',
        'بيروت': 'BEY',
        'بغداد': 'BGW',
        'أربيل': 'EBL',
        'الخرطوم': 'KRT',
        'تونس': 'TUN',
        'الدار البيضاء': 'CMN',
        'مراكش': 'RAK',
        'الجزائر': 'ALG',
        'طرابلس': 'TIP',
        // Turkey
        'إسطنبول': 'IST',
        'اسطنبول': 'IST',
        'أنقرة': 'ESB',
        'انطاليا': 'AYT',
        'أنطاليا': 'AYT',
        'طرابزون': 'TZX',
        'بودروم': 'BJV',
        'إزمير': 'ADB',
        // Europe
        'لندن': 'LHR',
        'باريس': 'CDG',
        'مدريد': 'MAD',
        'برشلونة': 'BCN',
        'روما': 'FCO',
        'ميلان': 'MXP',
        'ميلانو': 'MXP',
        'امستردام': 'AMS',
        'أمستردام': 'AMS',
        'فرانكفورت': 'FRA',
        'ميونخ': 'MUC',
        'برلين': 'BER',
        'فيينا': 'VIE',
        'جنيف': 'GVA',
        'زيورخ': 'ZRH',
        'بروكسل': 'BRU',
        'أثينا': 'ATH',
        'لشبونة': 'LIS',
        'موسكو': 'SVO',
        'براغ': 'PRG',
        'وارسو': 'WAW',
        'بودابست': 'BUD',
        'كوبنهاغن': 'CPH',
        'ستوكهولم': 'ARN',
        'أوسلو': 'OSL',
        'هلسنكي': 'HEL',
        'دبلن': 'DUB',
        'مانشستر': 'MAN',
        'نيس': 'NCE',
        'ليون': 'LYS',
        'البندقية': 'VCE',
        'فلورنسا': 'FLR',
        'مالقا': 'AGP',
        'إشبيلية': 'SVQ',
        // Asia
        'بانكوك': 'BKK',
        'كوالالمبور': 'KUL',
        'جاكرتا': 'CGK',
        'سنغافورة': 'SIN',
        'طوكيو': 'NRT',
        'سيول': 'ICN',
        'بكين': 'PEK',
        'شنغهاي': 'PVG',
        'هونغ كونغ': 'HKG',
        'هونج كونج': 'HKG',
        'مومباي': 'BOM',
        'نيودلهي': 'DEL',
        'نيو دلهي': 'DEL',
        'كولومبو': 'CMB',
        'مالديف': 'MLE',
        'المالديف': 'MLE',
        'ماليه': 'MLE',
        'بالي': 'DPS',
        'مانيلا': 'MNL',
        'هانوي': 'HAN',
        'تايبيه': 'TPE',
        // Africa
        'نيروبي': 'NBI',
        'أديس أبابا': 'ADD',
        'اديس ابابا': 'ADD',
        'دار السلام': 'DAR',
        'كيب تاون': 'CPT',
        'جوهانسبرغ': 'JNB',
        // Americas
        'نيويورك': 'JFK',
        'لوس أنجلوس': 'LAX',
        'لوس انجلوس': 'LAX',
        'شيكاغو': 'ORD',
        'واشنطن': 'IAD',
        'ميامي': 'MIA',
        'سان فرانسيسكو': 'SFO',
        'تورنتو': 'YYZ',
        'ساو باولو': 'GRU',
        'بوينس آيرس': 'EZE',
        // Australia
        'سيدني': 'SYD',
        'ملبورن': 'MEL',
        // Central Asia
        'إسلام اباد': 'ISB',
        'اسلام اباد': 'ISB',
        'لاهور': 'LHE',
        'كراتشي': 'KHI',
        'كابل': 'KBL',
        'طشقند': 'TAS',
        'باكو': 'GYD',
        'تبليسي': 'TBS',
        'يريفان': 'EVN',
      };

      // Check if keyword is Arabic and mapped
      let searchKeyword = keyword;
      if (arabicMap[keyword]) {
        searchKeyword = arabicMap[keyword];
      } else {
        // Try partial match if direct match fails
        const partialKey = Object.keys(arabicMap).find(key => key.includes(keyword));
        if (partialKey) {
          searchKeyword = arabicMap[partialKey];
        }
      }

      console.log('🔍 Searching cities/airports with keyword:', searchKeyword);
      const response = await amadeus.referenceData.locations.get({
        keyword: searchKeyword,
        subType: 'CITY,AIRPORT'
      });
      return {
        success: true,
        data: response.data.map(loc => ({
          name: loc.name,
          detailedName: loc.detailedName,
          iataCode: loc.iataCode,
          subType: loc.subType,
          cityName: loc.address ? loc.address.cityName : '',
          countryName: loc.address ? loc.address.countryName : ''
        }))
      };
    } catch (error) {
      console.error('❌ searchCities Error:', error.message || error);
      return { success: false, error: error.message || 'Location search failed' };
    }
  }

  // الحصول على توقعات دقة مواعيد المطار
  static async getAirportPerformance(airportCode) {
    try {
      console.log('📊 Getting performance for airport:', airportCode);
      const today = new Date().toISOString().split('T')[0];
      const response = await amadeus.airport.predictions.onTime.get({
        airportCode: airportCode,
        date: today
      });

      if (!response || !response.data) {
        return { success: false, error: 'No data returned' };
      }

      return {
        success: true,
        probability: response.data.probability,
        result: response.data.result
      };
    } catch (error) {
      // التعامل السلس مع أخطاء الـ API (مثل عدم توفر المطار في بيئة التجربة)
      console.warn(`⚠️ Airport Performance not available for ${airportCode}:`, error.code || error.message || 'ClientError');
      return { success: false, error: 'Data not available for this airport' };
    }
  }

  // الحصول على رابط الحجز
  static getBookingLink(airlineCode) {
    const links = {
      // Saudi & Regional
      'XY': 'https://www.flynas.com',
      'F3': 'https://www.flyadeal.com',
      'SV': 'https://www.saudia.com',
      'G9': 'https://www.airarabia.com',
      'FZ': 'https://www.flydubai.com',
      'QR': 'https://www.qatarairways.com',
      'EK': 'https://www.emirates.com',
      'EY': 'https://www.etihad.com',
      'MS': 'https://www.egyptair.com',
      'RJ': 'https://www.rj.com',
      'GF': 'https://www.gulfair.com',
      'WY': 'https://www.omanair.com',
      'KU': 'https://www.kuwaitairways.com',
      // Turkish
      'TK': 'https://www.turkishairlines.com',
      'PC': 'https://www.flypgs.com',
      'XQ': 'https://www.sunexpress.com',
      // European
      'LH': 'https://www.lufthansa.com',
      'BA': 'https://www.britishairways.com',
      'AF': 'https://www.airfrance.com',
      'KL': 'https://www.klm.com',
      'AZ': 'https://www.ita-airways.com',
      'IB': 'https://www.iberia.com',
      'LX': 'https://www.swiss.com',
      'OS': 'https://www.austrian.com',
      'SK': 'https://www.flysas.com',
      'A3': 'https://www.aegeanair.com',
      'LO': 'https://www.lot.com',
      'TP': 'https://www.flytap.com',
      'AY': 'https://www.finnair.com',
      'VF': 'https://www.aeroflot.com',
      // Asian
      'SQ': 'https://www.singaporeair.com',
      'TG': 'https://www.thaiairways.com',
      'MH': 'https://www.malaysiaairlines.com',
      'CX': 'https://www.cathaypacific.com',
      'GA': 'https://www.garuda-indonesia.com',
      'AI': 'https://www.airindia.com',
      'PK': 'https://www.piac.com.pk',
      'UL': 'https://www.srilankan.com',
      'PG': 'https://www.bangkokair.com',
      'ME': 'https://www.mea.com.lb',
      // African
      'ET': 'https://www.ethiopianairlines.com',
      'KQ': 'https://www.kenya-airways.com',
      'SA': 'https://www.flysaa.com'
    };
    return links[airlineCode] || 'https://www.google.com/flights';
  }

  // اختبار الاتصال بـ API
  static async testConnection() {
    try {
      console.log('🔑 Testing Amadeus API connection...');

      const response = await amadeus.shopping.flightOffersSearch.get({
        originLocationCode: 'RUH',
        destinationLocationCode: 'JED',
        departureDate: '2026-02-15',
        adults: '1',
        max: '1'
      });

      console.log('✅ Connection successful!');
      return {
        success: true,
        message: 'الاتصال بـ Amadeus API ناجح',
        sampleData: response.data[0] ? 'تم العثور على بيانات' : 'لا توجد بيانات'
      };

    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
      return {
        success: false,
        error: error.message,
        details: error.description || 'تحقق من API Keys'
      };
    }
  }
  // البحث عن أرخص الوجهات (Inspiration Search)
  static async getCheapestDestinations(origin) {
    try {
      console.log('🌍 Getting cheapest destinations from:', origin);
      const response = await amadeus.shopping.flightDestinations.get({
        origin: origin,
        currency: 'SAR',
        nonStop: false,
        viewBy: 'COUNTRY' // Group by country for diverse results
      });

      if (!response.data || response.data.length === 0) {
        return { success: true, data: [] };
      }

      const deals = response.data.map(item => ({
        destination: item.destination,
        price: parseFloat(item.price.total),
        currency: 'SAR',
        departureDate: item.departureDate,
        returnDate: item.returnDate
      }));

      // Sort by price
      deals.sort((a, b) => a.price - b.price);

      return { success: true, data: deals };

    } catch (error) {
      const statusCode = error?.response?.statusCode || 'unknown';
      console.warn(`⚠️ Inspiration Search unavailable (status: ${statusCode}) - this is normal in Amadeus test environment`);
      // Return empty array on error to avoid breaking UI
      return { success: true, data: [] };
    }
  }

  // تأكيد السعر (Pricing)
  static async confirmPrice(flightOffer) {
    try {
      console.log('💰 Confirming price for offer:', flightOffer.id);
      const response = await amadeus.shopping.flightOffers.pricing.post({
        'data': {
          'type': 'flight-offers-pricing',
          'flightOffers': [flightOffer]
        }
      });

      if (!response.data || !response.data.flightOffers || response.data.flightOffers.length === 0) {
        throw new Error('لم يتم العثور على عرض ساري');
      }

      return {
        success: true,
        data: response.data.flightOffers[0]
      };
    } catch (error) {
      console.error('❌ Price Confirmation Error:', error.response?.data?.errors || error.message);
      return {
        success: false,
        error: 'فشل في تأكيد السعر',
        details: error.response?.data?.errors
      };
    }
  }

  // إنشاء الحجز (Create Order)
  static async createOrder(flightOffer, travelers) {
    try {
      console.log('📝 Creating order for travelers:', travelers.length);
      const response = await amadeus.booking.flightOrders.post({
        'data': {
          'type': 'flight-order',
          'flightOffers': [flightOffer],
          'travelers': travelers
        }
      });

      if (!response.data) {
        throw new Error('لم يتم استلام رد صحيح من Amadeus');
      }

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      console.error('❌ Create Order Error:', error.response?.data?.errors || error.message);
      return {
        success: false,
        error: 'فشل في إنشاء الحجز',
        details: error.response?.data?.errors
      };
    }
  }
}

module.exports = AmadeusService;
