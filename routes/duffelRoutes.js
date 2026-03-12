const express = require('express');
const router = express.Router();
const duffel = require('../services/duffelService');
const pool = require('../config/database');
const { getSession } = require('../utils/authStore');

// ── Auth Middleware ────────────────────────────────────────────────────────────
const corporateAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'غير مصرح' });
  try {
    const session = await getSession(token);
    if (!session) return res.status(401).json({ success: false, error: 'انتهت الجلسة' });
    req.user = session.user;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, error: 'خطأ في التحقق' });
  }
};

// ── POST /api/duffel/search ───────────────────────────────────────────────────
router.post('/search', corporateAuth, async (req, res) => {
  try {
    const { origin, destination, date, returnDate = null, passengers = 1, cabinClass = 'economy' } = req.body;
    if (!origin || !destination || !date)
      return res.status(400).json({ success: false, error: 'origin, destination, date مطلوبة' });

    const result = await duffel.searchFlights({
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      date,
      returnDate: returnDate || null,
      passengers: Math.min(parseInt(passengers) || 1, 9),
      cabinClass,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Duffel search error:', err.response?.data || err.message);
    const msg = err.response?.data?.errors?.[0]?.message || err.message;
    res.status(500).json({ success: false, error: msg });
  }
});

// ── GET /api/duffel/offer/:id ─────────────────────────────────────────────────
router.get('/offer/:id', corporateAuth, async (req, res) => {
  try {
    const offer = await duffel.getOffer(req.params.id);
    res.json({ success: true, offer });
  } catch (err) {
    const msg = err.response?.data?.errors?.[0]?.message || err.message;
    res.status(500).json({ success: false, error: msg });
  }
});

// ── POST /api/duffel/book ─────────────────────────────────────────────────────
router.post('/book', corporateAuth, async (req, res) => {
  try {
    const { offerId, passengers, offerAmount, offerCurrency, flightInfo } = req.body;
    if (!offerId || !passengers?.length)
      return res.status(400).json({ success: false, error: 'offerId والمسافرون مطلوبون' });

    // Create order on Duffel
    const order = await duffel.createOrder({
      offerId,
      passengers,
      paymentAmount: offerAmount,
      paymentCurrency: offerCurrency || 'SAR',
      offerPassengerIds: req.body.offerPassengerIds, // Pass the IDs from the frontend
    });

    // Save to portal_bookings
    try {
      await pool.query(
        `INSERT INTO portal_bookings
          (company_id, employee_name, origin, destination, travel_date,
           price, cabin, booking_ref, compliant, booking_type, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'flight', NOW())`,
        [
          req.user.companyId,
          passengers[0]?.given_name + ' ' + passengers[0]?.family_name,
          flightInfo?.origin || '',
          flightInfo?.destination || '',
          flightInfo?.date || null,
          parseFloat(offerAmount) || 0,
          flightInfo?.cabinClass || 'economy',
          order.booking_reference || order.id,
          flightInfo?.compliant !== false,
        ]
      );
    } catch (dbErr) {
      // Don't block the booking confirmation if DB save fails
      console.error('Failed to save booking to DB:', dbErr.message);
    }

    res.json({
      success: true,
      bookingReference: order.booking_reference,
      orderId: order.id,
      status: order.payment_status?.awaiting_payment ? 'pending' : 'confirmed',
      slices: order.slices,
    });
  } catch (err) {
    console.error('Duffel book error:', err.response?.data || err.message);
    const msg = err.response?.data?.errors?.[0]?.message || err.message;
    res.status(500).json({ success: false, error: msg });
  }
});

// ── GET /api/duffel/suggestions ──────────────────────────────────────────────
router.get('/suggestions', corporateAuth, async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.json({ success: true, suggestions: [] });
    const suggestions = await duffel.suggestLocations(query);
    res.json({ success: true, suggestions });
  } catch (err) {
    const msg = err.response?.data?.errors?.[0]?.message || err.message;
    res.status(500).json({ success: false, error: msg });
  }
});

module.exports = router;
