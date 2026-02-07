const Amadeus = require('amadeus');
require('dotenv').config();

const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_CLIENT_ID,
  clientSecret: process.env.AMADEUS_CLIENT_SECRET,
  hostname: 'production' // Set to production based on usage
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
      const flights = response.data.map(offer => ({
        price: parseFloat(offer.price.total),
        airline: this.getAirlineName(offer.validatingAirlineCodes[0]),
        airlineCode: offer.validatingAirlineCodes[0],
        currency: offer.price.currency,
        segments: offer.itineraries[0].segments,
        isDirect: offer.itineraries[0].segments.length === 1,
        duration: offer.itineraries[0].duration,
        departureTime: offer.itineraries[0].segments[0].departure.at,
        arrivalTime: offer.itineraries[0].segments[offer.itineraries[0].segments.length - 1].arrival.at
      }));

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
      'MS': 'مصر للطيران',
      'RJ': 'الملكية الأردنية'
    };
    return airlines[code] || code;
  }

  // البحث عن المدن والمطارات (Autocomplete)
  static async searchCities(keyword) {
    try {
      // Manual mapping for common Arabic city names
      const arabicMap = {
        'الرياض': 'RUH',
        'جدة': 'JED',
        'الدمام': 'DMM',
        'المدينة': 'MED',
        'مكة': 'JED', // Mecca serves via Jeddah
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
        'القاهرة': 'CAI',
        'دبي': 'DXB',
        'لندن': 'LHR',
        'باريس': 'CDG',
        'إسطنبول': 'IST',
        'اسطنبول': 'IST',
        'مدريد': 'MAD',
        'برشلونة': 'BCN'
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
      'XY': 'https://www.flynas.com',
      'F3': 'https://www.flyadeal.com',
      'SV': 'https://www.saudia.com',
      'G9': 'https://www.airarabia.com',
      'FZ': 'https://www.flydubai.com',
      'QR': 'https://www.qatarairways.com',
      'EK': 'https://www.emirates.com',
      'MS': 'https://www.egyptair.com',
      'RJ': 'https://www.rj.com'
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
}

module.exports = AmadeusService;
