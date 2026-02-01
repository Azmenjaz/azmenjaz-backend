const Amadeus = require('amadeus');
require('dotenv').config();

const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_CLIENT_ID,
  clientSecret: process.env.AMADEUS_CLIENT_SECRET,
  hostname: 'test' // استخدم 'production' بعد التأكد من أن كل شيء يعمل
});

class AmadeusService {
  // البحث عن الرحلات (للاستخدام في الموقع)
  static async searchFlights(origin, destination, date) {
    try {
      console.log('🔍 Searching flights:', { origin, destination, date });

      const response = await amadeus.shopping.flightOffersSearch.get({
        originLocationCode: origin,
        destinationLocationCode: destination,
        departureDate: date,
        adults: '1',
        currencyCode: 'SAR',
        max: '10',
        nonStop: 'false'
      });

      console.log('✅ Amadeus API Response:', response.data.length, 'flights found');

      if (!response.data || response.data.length === 0) {
        return {
          success: true,
          flights: [],
          message: 'لم يتم العثور على رحلات'
        };
      }

      // معالجة البيانات
      const flights = response.data.map(
