const { drizzle } = require('drizzle-orm/node-postgres');
const pool = require('../config/database');
const schema = require('./schema');
const { eq } = require('drizzle-orm');

const db = drizzle(pool, { schema });

// Helper functions for Corporate Portal
async function getCompanyById(companyId) {
    const result = await db.select().from(schema.companies).where(eq(schema.companies.id, companyId)).limit(1);
    return result[0];
}

async function getFlightBookingsByCompany(companyId) {
    return await db.select().from(schema.flightBookings).where(eq(schema.flightBookings.companyId, companyId));
}

async function getHotelBookingsByCompany(companyId) {
    return await db.select().from(schema.hotelBookings).where(eq(schema.hotelBookings.companyId, companyId));
}

async function getVisaRequestsByCompany(companyId) {
    return await db.select().from(schema.visaRequests).where(eq(schema.visaRequests.companyId, companyId));
}

async function createFlightBooking(data) {
    return await db.insert(schema.flightBookings).values(data).returning();
}

async function createHotelBooking(data) {
    return await db.insert(schema.hotelBookings).values(data).returning();
}

async function createVisaRequest(data) {
    return await db.insert(schema.visaRequests).values(data).returning();
}

async function getFlightBookingById(id) {
    const result = await db.select().from(schema.flightBookings).where(eq(schema.flightBookings.id, id)).limit(1);
    return result[0];
}

async function getHotelBookingById(id) {
    const result = await db.select().from(schema.hotelBookings).where(eq(schema.hotelBookings.id, id)).limit(1);
    return result[0];
}

async function getVisaRequestById(id) {
    const result = await db.select().from(schema.visaRequests).where(eq(schema.visaRequests.id, id)).limit(1);
    return result[0];
}

async function getPassengersByBooking(bookingId) {
    return await db.select().from(schema.passengers).where(eq(schema.passengers.bookingId, bookingId));
}

async function getCompanyByEmail(email) {
    const result = await db.select().from(schema.companies).where(eq(schema.companies.email, email)).limit(1);
    return result[0];
}

async function createCompany(data) {
    return await db.insert(schema.companies).values(data).returning();
}

async function getCompanyStats(companyId) {
    const flights = await db.select().from(schema.flightBookings).where(eq(schema.flightBookings.companyId, companyId));
    const hotels = await db.select().from(schema.hotelBookings).where(eq(schema.hotelBookings.companyId, companyId));
    const visas = await db.select().from(schema.visaRequests).where(eq(schema.visaRequests.companyId, companyId));

    const totalSpending = flights.reduce((sum, b) => sum + parseFloat(b.totalPrice || 0), 0) +
        hotels.reduce((sum, b) => sum + parseFloat(b.totalPrice || 0), 0);

    return {
        flights: flights.length,
        hotels: hotels.length,
        visas: visas.length,
        totalSpending: totalSpending
    };
}

async function createPassenger(data) {
    return await db.insert(schema.passengers).values(data).returning();
}

module.exports = {
    db,
    ...schema,
    getCompanyById,
    getCompanyByEmail,
    createCompany,
    getCompanyStats,
    getFlightBookingsByCompany,
    getHotelBookingsByCompany,
    getVisaRequestsByCompany,
    createFlightBooking,
    createHotelBooking,
    createVisaRequest,
    getFlightBookingById,
    getHotelBookingById,
    getVisaRequestById,
    getPassengersByBooking,
    createPassenger
};
