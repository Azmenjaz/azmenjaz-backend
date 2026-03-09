const express = require('express');
const router = express.Router();
const db = require('../db/index');
const crypto = require('crypto');

// ─── Auth Token Store ─────────────────────────────────────────
// NOTE: In-memory store — cleared on server restart.
// For production, move to Redis or a database-backed session table.
const authTokens = new Map();

// Token TTL: 7 days
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Simple password hashing with SHA-256 + salt (no external deps)
// For higher security, install and use bcrypt instead
function hashPassword(password) {
    const salt = process.env.PASSWORD_SALT || 'safarsmart_secret_2026';
    return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Auth middleware
const corporateAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'غير مصرح - يرجى تسجيل الدخول' });
    const token = authHeader.split(' ')[1];
    const session = authTokens.get(token);
    if (!session) return res.status(401).json({ success: false, error: 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى' });
    // Check expiry
    if (Date.now() > session.expiresAt) {
        authTokens.delete(token);
        return res.status(401).json({ success: false, error: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى' });
    }
    req.user = session.user;
    next();
};

// ─── REGISTER ────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        if (!name || !email || !password)
            return res.status(400).json({ success: false, error: 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة' });

        if (password.length < 8)
            return res.status(400).json({ success: false, error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });

        const existing = await db.getCompanyByEmail(email);
        if (existing) return res.status(400).json({ success: false, error: 'البريد الإلكتروني مسجل بالفعل' });

        const hashedPassword = hashPassword(password);
        const [company] = await db.createCompany({ name, email, password: hashedPassword, phone });

        const token = generateToken();
        authTokens.set(token, {
            user: { id: company.id, companyId: company.id, name: company.name, role: 'company' },
            expiresAt: Date.now() + TOKEN_TTL_MS
        });

        res.status(201).json({ success: true, token, name: company.name, companyId: company.id });
    } catch (error) {
        console.error('Corporate register error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── LOGIN ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ success: false, error: 'البريد الإلكتروني وكلمة المرور مطلوبان' });

        const company = await db.getCompanyByEmail(email);
        const hashedInput = hashPassword(password);

        if (!company || company.password !== hashedInput)
            return res.status(401).json({ success: false, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });

        const token = generateToken();
        authTokens.set(token, {
            user: { id: company.id, companyId: company.id, name: company.name, role: 'company' },
            expiresAt: Date.now() + TOKEN_TTL_MS
        });

        res.json({ success: true, token, name: company.name, companyId: company.id });
    } catch (error) {
        console.error('Corporate login error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── LOGOUT ───────────────────────────────────────────────────
router.post('/logout', corporateAuth, (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) authTokens.delete(token);
    res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
});

// ─── DASHBOARD ───────────────────────────────────────────────
router.get('/dashboard', corporateAuth, async (req, res) => {
    try {
        const { companyId } = req.user;
        const company = await db.getCompanyById(companyId);
        const employees = await db.getEmployeesByCompany(companyId);
        const bookings = await db.getPortalBookingsByCompany(companyId);
        const policy = await db.getTravelPolicy(companyId);

        const totalSpend = bookings.reduce((s, b) => s + parseFloat(b.price || 0), 0);
        const compliant = bookings.filter(b => b.compliant).length;
        const complianceRate = bookings.length ? Math.round((compliant / bookings.length) * 100) : 100;

        res.json({
            success: true,
            data: {
                company,
                policy,
                stats: {
                    totalEmployees: employees.length,
                    totalSpend,
                    totalBookings: bookings.length,
                    complianceRate,
                },
                recentBookings: bookings.slice(0, 5),
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── TRAVEL POLICY ───────────────────────────────────────────
router.get('/policy', corporateAuth, async (req, res) => {
    try {
        const policy = await db.getTravelPolicy(req.user.companyId);
        res.json({ success: true, policy: policy || null });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/policy', corporateAuth, async (req, res) => {
    try {
        const { maxPrice, cabin, managerCabin, advanceDays, monthlyBudget, requireApproval } = req.body;
        const policy = await db.saveTravelPolicy({
            companyId: req.user.companyId,
            maxPrice: maxPrice || null,
            cabin: cabin || 'economy',
            managerCabin: managerCabin || 'business',
            advanceDays: advanceDays || 0,
            monthlyBudget: monthlyBudget || null,
            requireApproval: requireApproval || false,
        });
        res.json({ success: true, policy });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── PORTAL BOOKINGS ─────────────────────────────────────────
router.get('/portal-bookings', corporateAuth, async (req, res) => {
    try {
        const bookings = await db.getPortalBookingsByCompany(req.user.companyId);
        res.json({ success: true, bookings });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/portal-bookings', corporateAuth, async (req, res) => {
    try {
        const { employeeName, origin, destination, travelDate, price, cabin, bookingRef, compliant, bookingType } = req.body;
        const booking = await db.createPortalBooking({
            companyId: req.user.companyId,
            employeeName,
            origin,
            destination,
            travelDate: travelDate || null,
            price: price || 0,
            cabin: cabin || 'economy',
            bookingRef: bookingRef || '',
            compliant: compliant !== false,
            bookingType: bookingType || 'flight',
        });
        res.status(201).json({ success: true, booking });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── EMPLOYEES ───────────────────────────────────────────────
router.get('/employees', corporateAuth, async (req, res) => {
    try {
        const employees = await db.getEmployeesByCompany(req.user.companyId);
        res.json({ success: true, employees });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/employees', corporateAuth, async (req, res) => {
    try {
        const { name, email, permissions } = req.body;
        const [employee] = await db.createEmployee({
            name, email,
            permissions: permissions || 'Basic',
            companyId: req.user.companyId
        });
        res.status(201).json({ success: true, employee });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/employees/:id', corporateAuth, async (req, res) => {
    try {
        await db.deleteEmployee(parseInt(req.params.id), req.user.companyId);
        res.json({ success: true, message: 'تم حذف الموظف بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── LEGACY BOOKINGS (kept for compatibility) ─────────────────
router.get('/bookings/flights', corporateAuth, async (req, res) => {
    try {
        const flights = await db.getFlightBookingsByCompany(req.user.companyId);
        res.json({ success: true, bookings: flights });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/bookings/flights', corporateAuth, async (req, res) => {
    try {
        const bookingRef = `FL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const [booking] = await db.createFlightBooking({
            ...req.body,
            companyId: req.user.companyId,
            bookingReference: bookingRef,
            status: 'pending'
        });
        res.status(201).json({ success: true, booking });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/bookings/hotels', corporateAuth, async (req, res) => {
    try {
        const hotels = await db.getHotelBookingsByCompany(req.user.companyId);
        res.json({ success: true, bookings: hotels });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/bookings/hotels', corporateAuth, async (req, res) => {
    try {
        const bookingRef = `HTL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const [booking] = await db.createHotelBooking({
            ...req.body,
            companyId: req.user.companyId,
            bookingReference: bookingRef,
            status: 'confirmed'
        });
        res.status(201).json({ success: true, booking, bookingReference: bookingRef });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
