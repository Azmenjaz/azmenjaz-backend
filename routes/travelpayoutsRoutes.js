const express = require('express');
const router = express.Router();
const TPService = require('../services/travelpayoutsService');

router.get('/popular', async (req, res) => {
    try {
        const { origin } = req.query;
        const result = await TPService.getPopularDeals(origin || 'RUH');
        res.json(result);
    } catch (error) {
        console.error('TP popular deals error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch popular deals' });
    }
});

router.get('/calendar', async (req, res) => {
    try {
        const { origin, destination, month } = req.query;
        if (!origin || !destination) {
            return res.status(400).json({ success: false, error: 'origin and destination are required' });
        }
        const result = await TPService.getMonthMatrix(origin, destination, month);
        res.json(result);
    } catch (error) {
        console.error('TP calendar error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch calendar data' });
    }
});

module.exports = router;
