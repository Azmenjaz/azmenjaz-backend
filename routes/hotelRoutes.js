const express = require('express');
const router = express.Router();
const HotelService = require('../services/hotelService');

// البحث عن فنادق
router.post('/search', async (req, res) => {
    try {
        const { cityCode, checkInDate, checkOutDate, adults } = req.body;

        if (!cityCode) {
            return res.status(400).json({ success: false, error: 'City code is required' });
        }

        const result = await HotelService.searchHotelsWithDetails({
            cityCode,
            checkInDate: checkInDate || new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
            checkOutDate: checkOutDate || new Date(Date.now() + 172800000).toISOString().split('T')[0], // Day after tomorrow
            adults: adults || '1'
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
