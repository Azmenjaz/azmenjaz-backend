const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const Price = require('../models/Price');
const AmadeusService = require('../services/amadeusService');

// إنشاء تنبيه جديد
router.post('/create', async (req, res) => {
  try {
    const { userId, fromCity, toCity, travelDate, targetPrice } = req.body;

    if (!userId || !fromCity || !toCity || !travelDate) {
      return res.status(400).json({ 
        success: false,
        error: 'جميع الحقول مطلوبة' 
      });
    }

    const today = new Date();
    const travelDateObj = new Date(travelDate);
    if (travelDateObj < today) {
      return res.status(400).json({ 
        success: false,
        error: 'التاريخ يجب أن يكون في المستقبل' 
      });
    }

    const alert = await Alert.create(userId, fromCity, toCity, travelDate, targetPrice);

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

// ========== Routes الاختبار ==========

// عرض التنبيهات النشطة
router.get('/active-alerts', async (req, res) => {
  try {
    const alerts = await Alert.getActive();
    
    res.json({
      success: true,
      count: alerts.length,
      alerts: alerts.map(a => ({
        id: a.id,
        user: a.name,
        route: `${a.from_city} → ${a.to_city}`,
        date: a.travel_date,
        phone: a.phone
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// تشغيل Cron Job يدوياً
router.get('/run-cron-test', async (req, res) => {
  try {
    const { checkAllPrices } = require('../cron/priceChecker');
    
    console.log('🧪 بدء اختبار Cron Job يدوياً...');
    await checkAllPrices();
    
    res.json({
      success: true,
      message: 'تم تشغيل Cron Job بنجاح! شوف الـ Logs في Railway'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// اختبار إرسال واتساب
router.post('/test-whatsapp', async (req, res) => {
  try {
    const { phone, name } = req.body;
    
    if (!phone) {
      return res.status(400).json({ 
        success: false,
        error: 'رقم الجوال مطلوب' 
      });
    }

    const { sendPriceAlert } = require('../services/notificationService');
    
    await sendPriceAlert({
      userName: name || 'عزيزي العميل',
      userPhone: phone,
      fromCity: 'RUH',
      toCity: 'JED',
      travelDate: '2026-03-15',
      price: 299,
      recommendation: {
        action: 'test',
        message: '🧪 هذه رسالة اختبار من سفر سمارت!'
      }
    });

    res.json({
      success: true,
      message: 'تم إرسال رسالة واتساب! (شوف الـ Logs أو جوالك)'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
