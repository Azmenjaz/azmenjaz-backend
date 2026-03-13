const { drizzle } = require('drizzle-orm/node-postgres');
const { sql, eq, and } = require('drizzle-orm');
const pool = require('../config/database');
const schema = require('./schema');

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

async function updateCompanyProfile(companyId, data) {
    const [updated] = await db.update(schema.companies)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.companies.id, companyId))
        .returning();
    return updated;
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
        const result = await pool.query(
            `SELECT * FROM employees WHERE company_id = $1`,
            [companyId]
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
        const result = await pool.query(
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
        // Raw SQL for employees table (not in drizzle schema)
        await pool.query(
            'DELETE FROM employees WHERE id = $1 AND company_id = $2',
            [id, companyId]
        );
    } catch {
        // Fallback: delete from users table using drizzle
        return await db.delete(schema.users)
            .where(and(
                eq(schema.users.id, id),
                eq(schema.users.companyId, companyId)
            ));
    }
}

// ─── Travel Policy ───────────────────────────────────────────
async function getTravelPolicy(companyId) {
    try {
        const result = await pool.query(
            'SELECT * FROM travel_policy WHERE company_id = $1 LIMIT 1',
            [companyId]
        );
        return result.rows[0] || null;
    } catch { return null; }
}

async function saveTravelPolicy(data) {
    const result = await pool.query(
        `INSERT INTO travel_policy (company_id, max_price, cabin, manager_cabin, advance_days, monthly_budget, require_approval, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (company_id) DO UPDATE SET
           max_price = EXCLUDED.max_price,
           cabin = EXCLUDED.cabin,
           manager_cabin = EXCLUDED.manager_cabin,
           advance_days = EXCLUDED.advance_days,
           monthly_budget = EXCLUDED.monthly_budget,
           require_approval = EXCLUDED.require_approval,
           updated_at = NOW()
         RETURNING *`,
        [data.companyId, data.maxPrice, data.cabin, data.managerCabin, data.advanceDays, data.monthlyBudget, data.requireApproval]
    );
    return result.rows[0];
}

// ─── Portal Bookings ─────────────────────────────────────────
async function getPortalBookingsByCompany(companyId) {
    try {
        const result = await pool.query(
            'SELECT * FROM portal_bookings WHERE company_id = $1 ORDER BY created_at DESC',
            [companyId]
        );
        return result.rows || [];
    } catch { return []; }
}

async function createPortalBooking(data) {
    const result = await pool.query(
        `INSERT INTO portal_bookings (company_id, employee_name, origin, destination, travel_date, price, cabin, booking_ref, compliant, booking_type, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
         RETURNING *`,
        [data.companyId, data.employeeName, data.origin, data.destination, data.travelDate, data.price, data.cabin, data.bookingRef, data.compliant, data.bookingType, data.status || 'confirmed']
    );
    return result.rows[0];
}

async function updatePortalBookingStatus(id, status, companyId) {
    const result = await pool.query(
        `UPDATE portal_bookings SET status = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3 RETURNING *`,
        [status, id, companyId]
    );
    return result.rows[0];
}

module.exports = {
    db,
    ...schema,
    getCompanyById,
    getCompanyByEmail,
    createCompany,
    updateCompanyProfile,
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
    deleteEmployee,
    getTravelPolicy,
    saveTravelPolicy,
    getPortalBookingsByCompany,
    createPortalBooking,
    updatePortalBookingStatus
};


