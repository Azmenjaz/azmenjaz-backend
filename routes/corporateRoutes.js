const express = require('express');
const router = express.Router();
const db = require('../db');
const { z } = require('zod');

// Middleware to mock authentication for testing
// In production, this should be replaced with real JWT/Session auth
const mockAuth = (req, res, next) => {
    // Mocking a company user
    req.user = {
        id: 1,
        companyId: 1,
        role: 'company'
    };
    next();
};

// Company Dashboard
router.get('/dashboard', mockAuth, async (req, res) => {
    try {
        const { companyId } = req.user;
        if (!companyId) return res.status(403).json({ success: false, error: 'غير مصرح للشركات فقط' });

        const company = await db.getCompanyById(companyId);
        const flights = await db.getFlightBookingsByCompany(companyId);
        const hotels = await db.getHotelBookingsByCompany(companyId);
        const visas = await db.getVisaRequestsByCompany(companyId);

        res.json({
            success: true,
            data: {
                company,
                stats: {
                    totalFlightBookings: flights.length,
                    totalHotelBookings: hotels.length,
                    totalVisaRequests: visas.length,
                    pendingRequests: [
                        ...flights.filter(f => f.status === 'pending'),
                        ...hotels.filter(h => h.status === 'pending'),
                        ...visas.filter(v => v.status === 'pending'),
                    ].length,
                },
                recentBookings: {
                    flights: flights.slice(0, 5),
                    hotels: hotels.slice(0, 5),
                    visas: visas.slice(0, 5),
                },
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Bookings List
router.get('/bookings/flights', mockAuth, async (req, res) => {
    try {
        const flights = await db.getFlightBookingsByCompany(req.user.companyId);
        res.json({ success: true, flights });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/bookings/hotels', mockAuth, async (req, res) => {
    try {
        const hotels = await db.getHotelBookingsByCompany(req.user.companyId);
        res.json({ success: true, hotels });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/bookings/visas', mockAuth, async (req, res) => {
    try {
        const visas = await db.getVisaRequestsByCompany(req.user.companyId);
        res.json({ success: true, visas });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create Bookings
router.post('/bookings/flights', mockAuth, async (req, res) => {
    try {
        const bookingRef = `FL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const booking = await db.createFlightBooking({
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

router.post('/bookings/hotels', mockAuth, async (req, res) => {
    try {
        const bookingRef = `HT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const booking = await db.createHotelBooking({
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

router.post('/bookings/visas', mockAuth, async (req, res) => {
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
