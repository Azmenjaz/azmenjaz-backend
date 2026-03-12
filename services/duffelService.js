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
async function createOrder({ offerId, passengers, paymentAmount, paymentCurrency }) {
  const payload = {
    data: {
      type: 'instant',
      selected_offers: [offerId],
      passengers: passengers.map((p, i) => ({
        id: `passenger_${i}`,
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
    cabinClass: slice?.fare_brand_name || offer.cabin_class,
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

module.exports = { searchFlights, getOffer, createOrder, cancelOrder };
