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

// ─── Employee Management ──────────────────────────────────────────────────────
// يستخدم جدول employees المنفصل بدل جدول users
// لأن جدول users يتطلب openid وهو غير موجود للموظفين المضافين يدوياً

async function getEmployeesByCompany(companyId) {
    // محاولة جلب من جدول employees أولاً، وإلا من users
    try {
        const result = await db.execute(
            `SELECT * FROM employees WHERE company_id = ${companyId}`
        );
        return result.rows || [];
    } catch {
        // fallback: جدول users
        return await db.select().from(schema.users)
            .where(eq(schema.users.companyId, companyId));
    }
}

async function createEmployee(data) {
    // نستخدم raw SQL لتجنب مشكلة openid في جدول users
    try {
        const result = await db.execute(
            `INSERT INTO employees (company_id, name, email, permissions, status, created_at)
             VALUES ($1, $2, $3, $4, 'Active', NOW())
             RETURNING *`,
            [data.companyId, data.name, data.email, data.permissions || 'Basic']
        );
        return result.rows || [{ name: data.name, email: data.email }];
    } catch (err) {
        // إذا ما في جدول employees، نحاول نضيف لـ users مع openid
        return await db.insert(schema.users).values({
            name: data.name,
            email: data.email,
            companyId: data.companyId,
            role: 'employee',
            openId: 'emp_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now(),
            loginMethod: 'manual'
        }).returning();
    }
}

async function deleteEmployee(id, companyId) {
    try {
        await db.execute(
            `DELETE FROM employees WHERE id = $1 AND company_id = $2`,
            [id, companyId]
        );
    } catch {
        return await db.delete(schema.users)
            .where(eq(schema.users.id, id))
            .where(eq(schema.users.companyId, companyId));
    }
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
    createPassenger,
    getEmployeesByCompany,
    createEmployee,
    deleteEmployee
};
