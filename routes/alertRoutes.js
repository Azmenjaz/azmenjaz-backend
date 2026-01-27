const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const Price = require('../models/Price');
const AmadeusService = require('../services/amadeusService');

// إنشاء تنبيه جديد
router.post('/create', async (req, res) => {
  try {
    const { userId, fromCity, toCity, travelDate, targetPrice } = req.body;

    // Validation
    if (!userId || !fromCity || !toCity || !travelDate) {
      return res.status(400).json({ 
        success: false,
        error: 'جميع الحقول مطلوبة' 
      });
    }

    // Validate date is in the future
    const today = new Date();
    const travelDateObj = new Date(travelDate);
    if (travelDateObj < today) {
      return res.status(400).json({ 
        success: false,
        error: 'التاريخ يجب أن يكون في المستقبل' 
      });
    }

    // Create alert
    const alert = await Alert.create(userId, fromCity, toCity, travelDate, targetPrice);

    // Fetch current price
    const priceData = await AmadeusService.getFlightPrice(fromCity, toCity, travelDate);
    
    let currentPrice = null;
    if (priceData) {
      const route = `${fromCity}-${toCity}`;
      await Price.save(route, travelDate, priceData.price, priceData.airline);
      currentPrice = priceData;
    }

    res.status(201).json({
      success: true,
      message: 'تم إنشاء التنبيه بنجاح',
      alert,
      currentPrice
    });

  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// جلب تنبيهات مستخدم
router.get('/user/:userId', async (req, res) => {
  try {
    const alerts = await Alert.getByUserId(req.params.userId);
    
    res.json({ 
      success: true,
      count: alerts.length,
      alerts 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// جلب كل التنبيهات النشطة (للـ Cron Job)
router.get('/active', async (req, res) => {
  try {
    const alerts = await Alert.getActive();
    
    res.json({ 
      success: true,
      count: alerts.length,
      alerts 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// إيقاف تنبيه
router.put('/:alertId/deactivate', async (req, res) => {
  try {
    const alert = await Alert.deactivate(req.params.alertId);
    
    if (!alert) {
      return res.status(404).json({ 
        success: false,
        error: 'التنبيه غير موجود' 
      });
    }
    
    res.json({ 
      success: true,
      message: 'تم إيقاف التنبيه',
      alert 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// حذف تنبيه
router.delete('/:alertId', async (req, res) => {
  try {
    const alert = await Alert.delete(req.params.alertId);
    
    if (!alert) {
      return res.status(404).json({ 
        success: false,
        error: 'التنبيه غير موجود' 
      });
    }
    
    res.json({ 
      success: true,
      message: 'تم حذف التنبيه',
      alert 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// جلب سعر حالي لرحلة
router.get('/price/:from/:to/:date', async (req, res) => {
  try {
    const { from, to, date } = req.params;
    
    const priceData = await AmadeusService.getFlightPrice(from, to, date);
    
    if (!priceData) {
      return res.status(404).json({ 
        success: false,
        error: 'لم يتم العثور على رحلات متاحة' 
      });
    }

    // Save to history
    const route = `${from}-${to}`;
    await Price.save(route, date, priceData.price, priceData.airline);

    res.json({ 
      success: true,
      price: priceData 
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// جلب تاريخ الأسعار
router.get('/price-history/:route/:date', async (req, res) => {
  try {
    const { route, date } = req.params;
    const history = await Price.getHistory(route, date, 20);
    
    res.json({ 
      success: true,
      count: history.length,
      history 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

module.exports = router;
