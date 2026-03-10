const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const crypto = require('crypto');

// نفس طريقة التشفير المستخدمة في corporateRoutes
function hashPassword(password) {
  const salt = process.env.PASSWORD_SALT || 'safarsmart_secret_2026';
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        email VARCHAR(200),
        permissions VARCHAR(50) DEFAULT 'Basic',
        status VARCHAR(20) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Employees table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS portal_bookings (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        employee_name VARCHAR(200),
        origin VARCHAR(10),
        destination VARCHAR(10),
        travel_date DATE,
        price DECIMAL(10, 2) DEFAULT 0,
        cabin VARCHAR(20) DEFAULT 'economy',
        booking_ref VARCHAR(100),
        compliant BOOLEAN DEFAULT true,
        booking_type VARCHAR(20) DEFAULT 'flight',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Portal bookings table ready');
  } catch (err) {
    console.error('❌ Error initializing tables:', err.message);
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
    const clicksResult = await pool.query(`
      SELECT 
        COUNT(*) as count, 
        COALESCE(SUM(price), 0) as total_revenue 
      FROM booking_clicks
    `);

    const clicksCount = clicksResult.rows[0].count;
    const totalRevenue = clicksResult.rows[0].total_revenue;

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
        totalClicks: parseInt(clicksCount),
        totalRevenue: parseFloat(totalRevenue)
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

// جلب جميع الشركات B2B مع إحصائياتها
router.get('/companies', async (req, res) => {
  try {
    // نحاول الاستعلام الكامل أولاً
    let result;
    try {
      result = await pool.query(`
        SELECT 
          c.id,
          c.name,
          c.email,
          c.phone,
          c.created_at,
          COUNT(DISTINCT e.id) AS employee_count,
          COUNT(DISTINCT pb.id) AS booking_count,
          COALESCE(SUM(pb.price), 0) AS total_spend
        FROM companies c
        LEFT JOIN employees e ON e.company_id = c.id
        LEFT JOIN portal_bookings pb ON pb.company_id = c.id
        GROUP BY c.id, c.name, c.email, c.phone, c.created_at
        ORDER BY c.created_at DESC
      `);
    } catch (joinErr) {
      // إذا فشل بسبب عدم وجود جداول employees أو portal_bookings
      console.log('Full companies query failed, using fallback:', joinErr.message);
      try {
        result = await pool.query(`
          SELECT c.id, c.name, c.email, c.phone, c.created_at,
            COUNT(DISTINCT e.id) AS employee_count,
            0 AS booking_count, 0 AS total_spend
          FROM companies c
          LEFT JOIN employees e ON e.company_id = c.id
          GROUP BY c.id, c.name, c.email, c.phone, c.created_at
          ORDER BY c.created_at DESC
        `);
      } catch (empErr) {
        // حتى جدول employees غير موجود، نجلب الشركات فقط
        console.log('Employees join failed, using basic query:', empErr.message);
        result = await pool.query(`
          SELECT id, name, email, phone, created_at,
            0 AS employee_count, 0 AS booking_count, 0 AS total_spend
          FROM companies
          ORDER BY created_at DESC
        `);
      }
    }

    res.json({ success: true, count: result.rows.length, companies: result.rows });
  } catch (error) {
    console.error('Admin companies error:', error.message);
    res.json({ success: false, error: error.message, companies: [] });
  }
});

// إضافة شركة B2B جديدة مباشرة من لوحة الإدارة
router.post('/companies', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة' });

    if (password.length < 8)
      return res.status(400).json({ success: false, error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });

    // التحقق من عدم وجود نفس البريد مسبقاً
    const existing = await pool.query('SELECT id FROM companies WHERE email = $1', [email]);
    if (existing.rows.length > 0)
      return res.status(400).json({ success: false, error: 'البريد الإلكتروني مسجل بالفعل' });

    const hashedPassword = hashPassword(password);

    const result = await pool.query(
      `INSERT INTO companies (name, email, password, phone, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, name, email, phone, created_at`,
      [name, email, hashedPassword, phone || 'غير محدد']
    );

    const company = result.rows[0];
    res.status(201).json({
      success: true,
      companyId: company.id,
      company
    });
  } catch (error) {
    console.error('Admin create company error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// جلب شركة واحدة بالـ ID
router.get('/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let result;
    try {
      result = await pool.query(`
        SELECT
          c.id, c.name, c.email, c.phone, c.created_at,
          COUNT(DISTINCT e.id) AS employee_count,
          COUNT(DISTINCT pb.id) AS booking_count,
          COALESCE(SUM(pb.price), 0) AS total_spend
        FROM companies c
        LEFT JOIN employees e ON e.company_id = c.id
        LEFT JOIN portal_bookings pb ON pb.company_id = c.id
        WHERE c.id = $1
        GROUP BY c.id, c.name, c.email, c.phone, c.created_at
      `, [id]);
    } catch (joinErr) {
      result = await pool.query(
        `SELECT id, name, email, phone, created_at, 0 AS employee_count, 0 AS booking_count, 0 AS total_spend FROM companies WHERE id = $1`,
        [id]
      );
    }

    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'الشركة غير موجودة' });

    res.json({ success: true, company: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// تعديل بيانات شركة
router.put('/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone } = req.body;

    const result = await pool.query(
      `UPDATE companies SET name = COALESCE($1, name), phone = COALESCE($2, phone)
       WHERE id = $3 RETURNING id, name, email, phone`,
      [name || null, phone || null, id]
    );

    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'الشركة غير موجودة' });

    res.json({ success: true, company: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// حذف شركة
router.delete('/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM companies WHERE id = $1', [id]);
    res.json({ success: true, message: 'تم حذف الشركة بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;


