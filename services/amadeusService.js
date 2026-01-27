const Amadeus = require('amadeus');
require('dotenv').config();

const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_CLIENT_ID,
  clientSecret: process.env.AMADEUS_CLIENT_SECRET
});

class AmadeusService {
  static async getFlightPrice(origin, destination, date) {
    try {
      const response = await amadeus.shopping.flightOffersSearch.get({
        originLocationCode: origin,
        destinationLocationCode: destination,
        departureDate: date,
        adults: '1',
        currencyCode: 'SAR',
        max: 5
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
        airline: prices[0].airline,
        allPrices: prices
      };

    } catch (error) {
      console.error('❌ Amadeus API Error:', error.response?.data || error.message);
      return null;
    }
  }

  static async searchFlights(origin, destination, dateRange) {
    // للمستقبل: البحث عن أرخص أيام في نطاق تواريخ
    try {
      const response = await amadeus.shopping.flightOffers.get({
        origin,
        destination,
        departureDate: dateRange.start,
        returnDate: dateRange.end || null
      });
      return response.data;
    } catch (error) {
      console.error('Search error:', error);
      return null;
    }
  }
}

module.exports = AmadeusService;
