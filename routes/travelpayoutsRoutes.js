const express = require('express');
const router = express.Router();
const TPService = require('../services/travelpayoutsService');

router.get('/popular', async (req, res) => {
    const { origin } = req.query;
    const result = await TPService.getPopularDeals(origin || 'RUH');
    res.json(result);
});

router.get('/calendar', async (req, res) => {
    const { origin, destination, month } = req.query;
    const result = await TPService.getMonthMatrix(origin, destination, month);
    res.json(result);
});

module.exports = router;
