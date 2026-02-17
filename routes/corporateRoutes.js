const express = require('express');
const router = express.Router();
const db = require('../db/index');
const { z } = require('zod');

// Basic token storage (In production, use JWT or sessions with Redis)
const authTokens = new Map();

// Real authentication middleware for corporate portal
const corporateAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'غير مصرح - يرجى تسجيل الدخول' });

    const token = authHeader.split(' ')[1];
    const user = authTokens.get(token);

    if (!user) return res.status(401).json({ success: false, error: 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى' });

    req.user = user;
    next();
};

// Company Registration
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, error: 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة' });
        }

        const existing = await db.getCompanyByEmail(email);
        if (existing) return res.status(400).json({ success: false, error: 'البريد الإلكتروني مسجل بالفعل' });

        const [company] = await db.createCompany({ name, email, password, phone });
        res.status(201).json({ success: true, company });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Company Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const company = await db.getCompanyByEmail(email);

        if (!company || company.password !== password) {
            return res.status(401).json({ success: false, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
        }

        // Simple token generation
        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        authTokens.set(token, {
            id: company.id,
            companyId: company.id,
            name: company.name,
            role: 'company'
        });

        res.json({
            success: true,
            token,
            company: {
                id: company.id,
                name: company.name,
                email: company.email
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Company Dashboard
router.get('/dashboard', corporateAuth, async (req, res) => {
    try {
        const { companyId } = req.user;
        if (!companyId) return res.status(403).json({ success: false, error: 'غير مصرح للشركات فقط' });

        const company = await db.getCompanyById(companyId);
        const flights = await db.getFlightBookingsByCompany(companyId);
        const hotels = await db.getHotelBookingsByCompany(companyId);
        const visas = await db.getVisaRequestsByCompany(companyId);

        // Sort all by date descending for "Recent Bookings"
        const allBookings = [
            ...flights.map(f => ({ ...f, type: 'flight' })),
            ...hotels.map(h => ({ ...h, type: 'hotel' })),
            ...visas.map(v => ({ ...v, type: 'visa' }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            success: true,
            data: {
                company,
                stats: {
                    totalFlightBookings: flights.length,
                    totalHotelBookings: hotels.length,
                    totalVisaRequests: visas.length,
                    totalSpending: await db.getCompanyStats(companyId).then(s => s.totalSpending),
                    pendingRequests: [
                        ...flights.filter(f => f.status === 'pending'),
                        ...hotels.filter(h => h.status === 'pending'),
                        ...visas.filter(v => v.status === 'pending'),
                    ].length,
                },
                recentBookings: allBookings.slice(0, 5),
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Bookings List
router.get('/bookings/flights', corporateAuth, async (req, res) => {
    try {
        const flights = await db.getFlightBookingsByCompany(req.user.companyId);
        res.json({ success: true, bookings: flights });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/bookings/hotels', corporateAuth, async (req, res) => {
    try {
        const hotels = await db.getHotelBookingsByCompany(req.user.companyId);
        res.json({ success: true, bookings: hotels });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/bookings/visas', corporateAuth, async (req, res) => {
    try {
        const visas = await db.getVisaRequestsByCompany(req.user.companyId);
        res.json({ success: true, bookings: visas });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create Bookings
router.post('/bookings/flights', corporateAuth, async (req, res) => {
    try {
        const bookingRef = `FL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const [booking] = await db.createFlightBooking({
            ...req.body,
            companyId: req.user.companyId,
            bookingReference: bookingRef,
            status: 'pending'
        });
        res.status(201).json({ success: true, booking });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/bookings/hotels', corporateAuth, async (req, res) => {
    try {
        const { hotelName, city, checkInDate, checkOutDate, rooms, guests, roomType, totalPrice, passengers } = req.body;
        const bookingRef = `HTL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        const [booking] = await db.createHotelBooking({
            hotelName,
            city,
            checkInDate,
            checkOutDate,
            rooms: rooms || 1,
            guests: guests || 1,
            roomType,
            totalPrice,
            companyId: req.user.companyId,
            bookingReference: bookingRef,
            status: 'confirmed' // Firing confirmation for mock
        });

        // Store passengers if provided
        if (passengers && Array.isArray(passengers)) {
            for (const p of passengers) {
                await db.createPassenger({
                    bookingId: booking.id,
                    name: `${p.firstName} ${p.lastName}`,
                    passportNumber: p.passportNumber || '',
                    nationality: p.nationality || ''
                });
            }
        }

        res.status(201).json({ success: true, booking, bookingReference: bookingRef });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/bookings/visas', corporateAuth, async (req, res) => {
    try {
        const requestRef = `VS-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const request = await db.createVisaRequest({
            ...req.body,
            companyId: req.user.companyId,
            requestReference: requestRef,
            status: 'pending'
        });
        res.status(201).json({ success: true, request });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
