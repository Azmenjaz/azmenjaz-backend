const Amadeus = require('amadeus');
require('dotenv').config();

const amadeus = (process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET)
    ? new Amadeus({
        clientId: process.env.AMADEUS_CLIENT_ID,
        clientSecret: process.env.AMADEUS_CLIENT_SECRET,
        hostname: 'test'
    })
    : null;

class HotelService {
    /**
     * Search hotels in a city by IATA code
     */
    static async searchHotels(cityCode) {
        if (!amadeus) return { success: false, error: 'Amadeus keys missing' };

        try {
            console.log(`🏨 Searching hotels in city: ${cityCode}`);

            // Step 1: Get list of hotels in the city
            const hotelsResponse = await amadeus.referenceData.locations.hotels.byCity.get({
                cityCode: cityCode
            });

            if (!hotelsResponse.data || hotelsResponse.data.length === 0) {
                return { success: true, hotels: [], message: 'No hotels found in this city' };
            }

            // Limit to 20 hotels for test environment performance
            const hotelIds = hotelsResponse.data.slice(0, 20).map(hotel => hotel.hotelId).join(',');

            // Step 2: Get offers for these hotels
            // Note: checkInDate and checkOutDate can be added as parameters
            const offersResponse = await amadeus.shopping.hotelOffersSearch.get({
                hotelIds: hotelIds,
                adults: '1'
            });

            const processedHotels = offersResponse.data.map(offer => ({
                hotelId: offer.hotel.hotelId,
                name: offer.hotel.name,
                price: offer.offers[0].price.total,
                currency: offer.offers[0].price.currency,
                rating: offer.hotel.rating,
                latitude: offer.hotel.latitude,
                longitude: offer.hotel.longitude,
                description: offer.hotel.description ? offer.hotel.description.text : 'No description available',
                amenities: offer.hotel.amenities || []
            }));

            return {
                success: true,
                hotels: processedHotels
            };

        } catch (error) {
            console.error('❌ Amadeus Hotel Error:', error.message || error);
            return {
                success: false,
                error: 'Fails to fetch hotels',
                details: error.description || error.message
            };
        }
    }

    /**
     * Search hotels with guest details and dates
     */
    static async searchHotelsWithDetails(params) {
        if (!amadeus) return { success: false, error: 'Amadeus keys missing' };

        try {
            const { cityCode, checkInDate, checkOutDate, adults } = params;

            console.log(`🏨 Detailed hotel search:`, params);

            // First find hotels in city
            const listResponse = await amadeus.referenceData.locations.hotels.byCity.get({
                cityCode
            });

            if (!listResponse.data || listResponse.data.length === 0) {
                return { success: true, hotels: [] };
            }

            const hotelIds = listResponse.data.slice(0, 15).map(h => h.hotelId).join(',');

            // Then get offers for these dates
            const offersResponse = await amadeus.shopping.hotelOffersSearch.get({
                hotelIds,
                checkInDate,
                checkOutDate,
                adults,
                currencyCode: 'SAR'
            });

            return {
                success: true,
                hotels: offersResponse.data.map(offer => ({
                    id: offer.hotel.hotelId,
                    name: offer.hotel.name,
                    price: parseFloat(offer.offers[0].price.total),
                    currency: offer.offers[0].price.currency,
                    chainCode: offer.hotel.chainCode,
                    latitude: offer.hotel.latitude,
                    longitude: offer.hotel.longitude,
                    available: true
                }))
            };
        } catch (error) {
            console.error('❌ Detailed Hotel Search Error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get a simple list of hotels in a city (no prices/availability)
     */
    static async getHotelList(cityCode) {
        if (!amadeus) return { success: false, error: 'Amadeus keys missing' };

        try {
            console.log(`🏨 Fetching hotel list for: ${cityCode}`);
            const response = await amadeus.referenceData.locations.hotels.byCity.get({
                cityCode: cityCode
            });

            return {
                success: true,
                hotels: response.data.map(hotel => ({
                    id: hotel.hotelId,
                    name: hotel.name,
                    iataCode: hotel.iataCode,
                    latitude: hotel.geoCode ? hotel.geoCode.latitude : null,
                    longitude: hotel.geoCode ? hotel.geoCode.longitude : null,
                    chainCode: hotel.chainCode
                }))
            };
        } catch (error) {
            console.error('❌ Hotel List Error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Autocomplete hotel names (Search by keyword)
     */
    static async autocompleteHotels(keyword) {
        if (!amadeus) return { success: false, error: 'Amadeus keys missing' };

        try {
            console.log(`🔍 Autocomplete hotels for: ${keyword}`);
            const response = await amadeus.referenceData.locations.get({
                keyword: keyword,
                subType: 'HOTEL_GDS'
            });

            return {
                success: true,
                data: response.data.map(loc => ({
                    name: loc.name,
                    hotelId: loc.hotelId,
                    iataCode: loc.iataCode,
                    cityName: loc.address ? loc.address.cityName : ''
                }))
            };
        } catch (error) {
            console.error('❌ Hotel Autocomplete Error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Book a hotel (Mock implementation for test environment)
     */
    static async bookHotel(bookingParams) {
        if (!amadeus) return { success: false, error: 'Amadeus keys missing' };

        try {
            console.log(`🛎️ Booking hotel:`, bookingParams);
            return {
                success: true,
                bookingReference: `HTL-${Math.floor(Math.random() * 900000) + 100000}`,
                status: 'confirmed',
                details: bookingParams
            };
        } catch (error) {
            console.error('❌ Hotel Booking Error:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = HotelService;
