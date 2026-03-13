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
    if (!origin || !destination || !date) {
      console.warn('[duffel/search] Missing required fields:', { origin, destination, date });
      return res.status(400).json({ success: false, error: 'يرجى تحديد المطار والتاريخ' });
    }

    console.log('[duffel/search] Searching flights from', origin, 'to', destination, 'on', date);
    const result = await duffel.searchFlights({
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      date,
      returnDate: returnDate || null,
      passengers: Math.min(parseInt(passengers) || 1, 9),
      cabinClass,
    });

    console.log('[duffel/search] Found', result.offers?.length || 0, 'offers');
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[duffel/search] Error:', err.response?.data || err.message);
    const msg = err.response?.data?.errors?.[0]?.message || err.message || 'فشل البحث عن الرحلات';
    const status = err.response?.status || 500;
    res.status(status).json({ success: false, error: msg });
  }
});

// ── GET /api/duffel/offer/:id ─────────────────────────────────────────────────
router.get('/offer/:id', corporateAuth, async (req, res) => {
  try {
    console.log('[duffel/offer] Getting offer:', req.params.id);
    const offer = await duffel.getOffer(req.params.id);
    res.json({ success: true, offer });
  } catch (err) {
    console.error('[duffel/offer] Error:', err.response?.data || err.message);
    const msg = err.response?.data?.errors?.[0]?.message || err.message || 'فشل جلب تفاصيل العرض';
    res.status(500).json({ success: false, error: msg });
  }
});

// ── POST /api/duffel/book ─────────────────────────────────────────────────────
router.post('/book', corporateAuth, async (req, res) => {
  try {
    const { offerId, passengers, offerAmount, offerCurrency, flightInfo } = req.body;
    if (!offerId || !passengers?.length) {
      console.warn('[duffel/book] Missing required fields:', { offerId: !!offerId, passengers: !!passengers?.length });
      return res.status(400).json({ success: false, error: 'يرجى تحديد الرحلة والمسافرين' });
    }

    console.log('[duffel/book] Creating order for', passengers.length, 'passengers on offer:', offerId);
    
    // Create order on Duffel
    const order = await duffel.createOrder({
      offerId,
      passengers,
      paymentAmount: offerAmount,
      paymentCurrency: offerCurrency || 'SAR',
      offerPassengerIds: req.body.offerPassengerIds,
    });

    console.log('[duffel/book] Order created:', order.booking_reference || order.id);

    // Save to portal_bookings
    try {
      await pool.query(
        `INSERT INTO portal_bookings
          (company_id, employee_name, origin, destination, travel_date,
           price, cabin, booking_ref, compliant, booking_type, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'flight',$10, NOW())`,
        [
          req.user.companyId,
          (passengers[0]?.given_name || '') + ' ' + (passengers[0]?.family_name || ''),
          flightInfo?.origin || '',
          flightInfo?.destination || '',
          flightInfo?.date || null,
          parseFloat(offerAmount) || 0,
          flightInfo?.cabinClass || 'economy',
          order.booking_reference || order.id,
          flightInfo?.compliant !== false,
          flightInfo?.status || 'confirmed',
        ]
      );
      console.log('[duffel/book] Booking saved to database');
    } catch (dbErr) {
      console.error('[duffel/book] DB save failed (non-blocking):', dbErr.message);
    }

    res.json({
      success: true,
      bookingReference: order.booking_reference,
      orderId: order.id,
      status: order.payment_status?.awaiting_payment ? 'pending' : 'confirmed',
      slices: order.slices,
    });
  } catch (err) {
    console.error('[duffel/book] Error:', err.response?.data || err.message);
    const msg = err.response?.data?.errors?.[0]?.message || err.message || 'فشل إتمام الحجز';
    res.status(500).json({ success: false, error: msg });
  }
});

// ── GET /api/duffel/suggestions ──────────────────────────────────────────────
router.get('/suggestions', corporateAuth, async (req, res) => {
  try {
    const query = req.query.q;
    console.log('[duffel/suggestions] Query:', query, 'from company:', req.user.companyId);
    
    if (!query) {
      return res.json({ success: true, suggestions: [] });
    }
    
    const suggestions = await duffel.suggestLocations(query);
    console.log('[duffel/suggestions] Found', suggestions?.length || 0, 'matches for:', query);
    
    res.json({ success: true, suggestions: suggestions || [] });
  } catch (err) {
    console.error('[duffel/suggestions] Error:', err.response?.data || err.message);
    const msg = err.response?.data?.errors?.[0]?.message || err.message || 'فشل البحث عن المطارات';
    res.status(500).json({ success: false, error: msg });
  }
});

module.exports = router;
