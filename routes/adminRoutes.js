const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const crypto = require('crypto');
const { invalidateCompanyTokens } = require('../utils/authStore');

// نفس طريقة التشفير المستخدمة في corporateRoutes
function hashPassword(password) {
  const salt = process.env.PASSWORD_SALT || 'safarsmart_secret_2026';
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

// ─── Admin Session Store (in-memory) ──────────────────────────────────────────
const adminSessions = new Set();

const adminAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !adminSessions.has(token)) {
    return res.status(401).json({ success: false, error: 'غير مصرح' });
  }
  next();
};

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS operations_requests (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        priority VARCHAR(20) DEFAULT 'medium',
        subject VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Operations requests table ready');
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
      const token = crypto.randomBytes(32).toString('hex');
      adminSessions.add(token);
      res.json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        token
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
router.get('/stats', adminAuth, async (req, res) => {
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

    // إحصائيات النقرات (نحتفظ بها بالخلفية للآن ولكن سنبرز الـ TTV)
    const clicksResult = await pool.query(`
      SELECT 
        COUNT(*) as count, 
        COALESCE(SUM(price), 0) as total_revenue 
      FROM booking_clicks
    `);

    // إجمالي حجم مبيعات الشركات (TTV)
    const ttvResult = await pool.query(`
      SELECT COALESCE(SUM(price), 0) as total_ttv 
      FROM portal_bookings
    `);

    // عدد الطلبات اليدوية المعلقة
    const opsCount = await pool.query(`
      SELECT COUNT(*) as count FROM operations_requests WHERE status = 'pending'
    `);

    const clicksCount = clicksResult.rows[0].count;
    const totalTTV = ttvResult.rows[0].total_ttv;

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
        totalTTV: parseFloat(totalTTV),
        pendingOps: parseInt(opsCount.rows[0].count)
      },
      recentAlerts: recentAlerts.rows,
      recentClicks: recentClicks.rows
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// جلب جميع المستخدمين
router.get('/users', adminAuth, async (req, res) => {
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
router.get('/alerts', adminAuth, async (req, res) => {
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
router.delete('/users/:userId', adminAuth, async (req, res) => {
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
router.delete('/alerts/:alertId', adminAuth, async (req, res) => {
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
router.post('/run-cron', adminAuth, async (req, res) => {
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
router.get('/recent-prices', adminAuth, async (req, res) => {
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

// جلب جميع الشركات B2B مع إحصائياتها الحقيقية
router.get('/companies', adminAuth, async (req, res) => {
  try {
    let result;
    // نتحقق أولاً من اسم حقل التاريخ في قاعدة البيانات
    const dateColCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'companies' AND column_name IN ('created_at', 'createdAt')
    `);
    const dateCol = dateColCheck.rows.length > 0 ? dateColCheck.rows[0].column_name : 'id'; // fallback to id if no date found

    try {
      // الاستعلام المحدث: نستخدم users بدلاً من employees و portal_bookings للإحصائيات
      result = await pool.query(`
        SELECT 
          c.id, c.name, c.email, c.phone,
          c."${dateCol}" AS created_at,
          COUNT(DISTINCT u.id) AS employee_count,
          COUNT(DISTINCT pb.id) AS booking_count,
          COALESCE(SUM(pb.price), 0) AS total_spend,
          MAX(pb.created_at) AS last_booking_date
        FROM companies c
        LEFT JOIN users u ON u.company_id = c.id
        LEFT JOIN portal_bookings pb ON pb.company_id = c.id
        GROUP BY c.id, c.name, c.email, c.phone, c."${dateCol}"
        ORDER BY c.id DESC
      `);
    } catch (joinErr) {
      console.log('Query failed, using fallback:', joinErr.message);
      result = await pool.query(`SELECT *, "${dateCol}" as created_at FROM companies ORDER BY id DESC`);
    }

    res.json({ success: true, count: result.rows.length, companies: result.rows });
  } catch (error) {
    console.error('Admin companies error:', error.message);
    res.json({ success: false, error: error.message, companies: [] });
  }
});

// إضافة شركة B2B جديدة مباشرة من لوحة الإدارة
router.post('/companies', adminAuth, async (req, res) => {
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

    // نتحقق من أعمدة الجدول الفعلية أولاً
    const colCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'companies' AND column_name IN ('created_at', 'createdAt')
    `);
    const cols = colCheck.rows.map(r => r.column_name);
    
    let result;
    if (cols.includes('created_at')) {
      result = await pool.query(
        `INSERT INTO companies (name, email, password, phone, created_at)
         VALUES ($1, $2, $3, $4, NOW()) RETURNING id, name, email, phone`,
        [name, email, hashedPassword, phone || 'غير محدد']
      );
    } else if (cols.includes('createdAt')) {
      result = await pool.query(
        `INSERT INTO companies (name, email, password, phone, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id, name, email, phone`,
        [name, email, hashedPassword, phone || 'غير محدد']
      );
    } else {
      result = await pool.query(
        `INSERT INTO companies (name, email, password, phone)
         VALUES ($1, $2, $3, $4) RETURNING id, name, email, phone`,
        [name, email, hashedPassword, phone || 'غير محدد']
      );
    }

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
router.get('/companies/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    let result;
    try {
      result = await pool.query(`
        SELECT
          c.id, c.name, c.email, c.phone,
          NULL AS created_at,
          COUNT(DISTINCT e.id) AS employee_count,
          COUNT(DISTINCT pb.id) AS booking_count,
          COALESCE(SUM(pb.price), 0) AS total_spend
        FROM companies c
        LEFT JOIN employees e ON e.company_id = c.id
        LEFT JOIN portal_bookings pb ON pb.company_id = c.id
        WHERE c.id = $1
        GROUP BY c.id, c.name, c.email, c.phone
      `, [id]);
    } catch (joinErr) {
      result = await pool.query(
        `SELECT id, name, email, phone, NULL AS created_at, 0 AS employee_count, 0 AS booking_count, 0 AS total_spend FROM companies WHERE id = $1`,
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
router.put('/companies/:id', adminAuth, async (req, res) => {
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
router.delete('/companies/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // ① إلغاء جميع جلسات البوابة النشطة لهذه الشركة فوراً
    await invalidateCompanyTokens(id);

    // ② حذف الشركة من قاعدة البيانات
    await pool.query('DELETE FROM companies WHERE id = $1', [id]);

    res.json({ success: true, message: 'تم حذف الشركة وإلغاء جميع جلساتها بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- عمليات الإدارة (Operations) ---

// جلب جميع طلبات العمليات
router.get('/operations', adminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT op.*, c.name as company_name 
      FROM operations_requests op
      LEFT JOIN companies c ON op.company_id = c.id
      ORDER BY op.created_at DESC
    `);
    res.json({ success: true, count: result.rows.length, operations: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// تحديث حالة طلب
router.put('/operations/:id', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;
    await pool.query(
      'UPDATE operations_requests SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// جلب جميع الحجوزات المؤسسية (Global Monitoring)
router.get('/bookings', adminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        pb.*, 
        c.name as company_name,
        u.name as employee_name
      FROM portal_bookings pb
      LEFT JOIN companies c ON pb.company_id = c.id
      LEFT JOIN users u ON pb.user_id = u.id
      ORDER BY pb.created_at DESC
    `);
    res.json({ success: true, count: result.rows.length, bookings: result.rows });
  } catch (error) {
    console.error('Admin bookings error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// إنشاء توكن انتحال شخصية (Impersonation) للدخول المباشر للبوابة
router.post('/impersonate/:companyId', adminAuth, async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // نتحقق من وجود الشركة
    const co = await pool.query('SELECT name FROM companies WHERE id = $1', [companyId]);
    if (co.rows.length === 0) return res.status(404).json({ success: false, error: 'الشركة غير موجودة' });

    // نولد توكن خاص (يمكن أن يكون JWT عادي مع صلاحية admin=true)
    const token = jwt.sign(
      { companyId: parseInt(companyId), isAdminImpersonation: true, adminName: req.admin.username },
      process.env.JWT_SECRET || 'safarsmart_secret_key',
      { expiresIn: '1h' }
    );

    res.json({ success: true, token, portalUrl: `/portal/index.html?impersonate=true&token=${token}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;


