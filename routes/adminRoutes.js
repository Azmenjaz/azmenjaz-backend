const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Initialize Tables
const initTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS booking_clicks (
        id SERIAL PRIMARY KEY,
        airline_name VARCHAR(100),
        origin_code CHAR(3),
        destination_code CHAR(3),
        price DECIMAL(10, 2),
        currency VARCHAR(10),
        travel_date DATE,
        click_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Booking clicks table ready');
  } catch (err) {
    console.error('❌ Error initializing click table:', err);
  }
};
initTables();

// ⭐ بيانات الأدمن (يمكن نقلها لـ Environment Variables)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Azmenjaz@2026';

// تتبع نقرة حجز (Public)
router.post('/track-click', async (req, res) => {
  try {
    const { airline, origin, destination, price, currency, date } = req.body;

    await pool.query(
      `INSERT INTO booking_clicks 
       (airline_name, origin_code, destination_code, price, currency, travel_date) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [airline, origin, destination, price, currency, date]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Tracking error:', error);
    res.json({ success: false }); // Don't block UI on tracking error
  }
});

// تسجيل دخول Admin
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      // في الإنتاج الحقيقي، استخدم JWT Token
      res.json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        token: 'admin-token-12345' // مؤقت للتجربة
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'اسم المستخدم أو كلمة المرور خاطئة'
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// إحصائيات Dashboard
router.get('/stats', async (req, res) => {
  try {
    // عدد المستخدمين
    const usersCount = await pool.query('SELECT COUNT(*) as count FROM users');

    // عدد التنبيهات النشطة
    const activeAlertsCount = await pool.query(
      'SELECT COUNT(*) as count FROM alerts WHERE is_active = true'
    );

    // عدد التنبيهات الكلي
    const totalAlertsCount = await pool.query('SELECT COUNT(*) as count FROM alerts');

    // عدد الأسعار المسجلة
    const pricesCount = await pool.query('SELECT COUNT(*) as count FROM price_history');

    // آخر 10 تنبيهات
    const recentAlerts = await pool.query(`
      SELECT a.*, u.name, u.phone 
      FROM alerts a
      JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 10
    `);

    // إحصائيات النقرات
    const clicksCount = await pool.query('SELECT COUNT(*) as count FROM booking_clicks');
    const recentClicks = await pool.query(`
      SELECT * FROM booking_clicks 
      ORDER BY click_timestamp DESC 
      LIMIT 10
    `);

    res.json({
      success: true,
      stats: {
        totalUsers: parseInt(usersCount.rows[0].count),
        activeAlerts: parseInt(activeAlertsCount.rows[0].count),
        totalAlerts: parseInt(totalAlertsCount.rows[0].count),
        totalPrices: parseInt(pricesCount.rows[0].count),
        totalClicks: parseInt(clicksCount.rows[0].count)
      },
      recentAlerts: recentAlerts.rows,
      recentClicks: recentClicks.rows
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// جلب جميع المستخدمين
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.*,
        COUNT(a.id) as alerts_count
      FROM users u
      LEFT JOIN alerts a ON u.id = a.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      users: result.rows
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// جلب جميع التنبيهات
router.get('/alerts', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.*,
        u.name,
        u.phone,
        u.email
      FROM alerts a
      JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      alerts: result.rows
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// حذف مستخدم
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({
      success: true,
      message: 'تم حذف المستخدم بنجاح'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// حذف تنبيه
router.delete('/alerts/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;

    await pool.query('DELETE FROM alerts WHERE id = $1', [alertId]);

    res.json({
      success: true,
      message: 'تم حذف التنبيه بنجاح'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// تشغيل Cron Job يدوياً
router.post('/run-cron', async (req, res) => {
  try {
    const { checkAllPrices } = require('../cron/priceChecker');

    // تشغيل في الخلفية
    checkAllPrices().catch(err => console.error('Cron error:', err));

    res.json({
      success: true,
      message: 'تم تشغيل فحص الأسعار! راجع الـ Logs'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// آخر الأسعار المسجلة
router.get('/recent-prices', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM price_history
      ORDER BY recorded_at DESC
      LIMIT 50
    `);

    res.json({
      success: true,
      prices: result.rows
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
