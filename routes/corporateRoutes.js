const express = require('express');
const router = express.Router();
const db = require('../db/index');
const crypto = require('crypto');

// ─── Auth Session Store (DB-backed, survives restarts) ───────────────────────
const { saveSession, getSession, deleteSession, TOKEN_TTL_MS } = require('../utils/authStore');
const { hashPassword, verifyPassword } = require('../utils/password');

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Auth middleware (async — checks DB)
const corporateAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'غير مصرح - يرجى تسجيل الدخول' });
    const token = authHeader.split(' ')[1];
    try {
        const session = await getSession(token);
        if (!session) return res.status(401).json({ success: false, error: 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى' });
        req.user = session.user;
        next();
    } catch (err) {
        console.error('corporateAuth DB error:', err.message);
        return res.status(500).json({ success: false, error: 'خطأ في التحقق من الجلسة' });
    }
};

const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'Employee') {
        return res.status(403).json({ success: false, error: 'غير مصرح - هذه الصلاحية لمديري الشركات فقط' });
    }
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

        const hashedPassword = await hashPassword(password);
        const [company] = await db.createCompany({ name, email, password: hashedPassword, phone });

        const token = generateToken();
        await saveSession(token, { companyId: company.id, name: company.name, email: company.email, role: 'Admin' });

        res.status(201).json({ success: true, token, name: company.name, companyId: company.id, role: 'Admin' });
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

        // 1. Check if Company Admin
        const company = await db.getCompanyByEmail(email);
        if (company) {
            const { ok, needsRehash } = await verifyPassword(password, company.password);
            if (ok) {
                if (needsRehash) {
                    try {
                        const newHash = await hashPassword(password);
                        await db.updateCompanyPassword(company.id, newHash);
                    } catch (e) {
                        console.warn('Rehash company password failed:', e.message);
                    }
                }
                const token = generateToken();
                await saveSession(token, { companyId: company.id, name: company.name, email: company.email, role: 'Admin' });
                return res.json({ success: true, token, name: company.name, companyId: company.id, role: 'Admin' });
            }
        }

        // 2. Check if Employee
        const employee = await db.getEmployeeByEmail(email);
        if (employee && employee.password) {
            const { ok, needsRehash } = await verifyPassword(password, employee.password);
            if (ok) {
                if (needsRehash) {
                    try {
                        const newHash = await hashPassword(password);
                        await db.updateEmployeePassword(employee.id, newHash);
                    } catch (e) {
                        console.warn('Rehash employee password failed:', e.message);
                    }
                }
                const token = generateToken();
                const companyId = employee.company_id || employee.companyId;
                await saveSession(token, { companyId, employeeId: employee.id, name: employee.name, email: employee.email, role: 'Employee' });
                return res.json({ success: true, token, name: employee.name, companyId, role: 'Employee' });
            }
        }

        return res.status(401).json({ success: false, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    } catch (error) {
        console.error('Corporate login error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── LOGOUT ───────────────────────────────────────────────────
router.post('/logout', corporateAuth, async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) await deleteSession(token);
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

        // Do not expose password hash to client
        if (company) delete company.password;

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

// ─── COMPANY PROFILE ─────────────────────────────────────────
router.get('/profile', corporateAuth, async (req, res) => {
    try {
        const company = await db.getCompanyById(req.user.companyId);
        if (!company) return res.status(404).json({ success: false, error: 'الشركة غير موجودة' });
        
        // Remove sensitive fields
        delete company.password;
        
        res.json({ success: true, company });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/profile', corporateAuth, async (req, res) => {
    try {
        const { name, website, taxId, registrationNumber, address, city, country, brandColor, logoUrl } = req.body;
        
        const updated = await db.updateCompanyProfile(req.user.companyId, {
            name, 
            website, 
            taxId, 
            registrationNumber, 
            address, 
            city, 
            country, 
            brandColor, 
            logoUrl
        });

        res.json({ success: true, company: updated });
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
  } catch (err) { res.status(500).json({ success: false, error: 'تعذر جلب الحجوزات' }); }
});

router.put('/portal-bookings/:id/status', corporateAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['confirmed', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, error: 'حالة غير صالحة' });
    }
    const updated = await db.updatePortalBookingStatus(req.params.id, status, req.user.companyId);
    res.json({ success: true, booking: updated });
  } catch (err) { res.status(500).json({ success: false, error: 'تعذر تحديث الحالة' }); }
});

router.post('/portal-bookings', corporateAuth, async (req, res) => {
    try {
        const { employeeName, origin, destination, travelDate, price, cabin, bookingRef, compliant, bookingType } = req.body;
        
        // If employee and non-compliant, auto-set to pending
        let status = 'confirmed';
        if (req.user.role === 'Employee' && compliant === false) {
            status = 'pending';
        }

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
            status 
        });
        res.status(201).json({ success: true, booking });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── EMPLOYEES ───────────────────────────────────────────────
router.get('/employees', corporateAuth, adminOnly, async (req, res) => {
    try {
        const employees = await db.getEmployeesByCompany(req.user.companyId);
        // Do not expose password hashes in API response
        const safeEmployees = employees.map(e => {
            const copy = { ...e };
            if (copy.password) delete copy.password;
            return copy;
        });
        res.json({ success: true, employees: safeEmployees });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/employees', corporateAuth, adminOnly, async (req, res) => {
    try {
        const { name, email, password, title, passport, permissions } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, error: 'الاسم والبريد وكلمة المرور مطلوبة' });
        }

        // تحقق من أن بريد الموظف من نفس نطاق الشركة (إن وُجد allowed_domain)
        const company = await db.getCompanyById(req.user.companyId);
        if (company && company.allowedDomain) {
            const emailDomain = (email.split('@')[1] || '').toLowerCase();
            const allowed = company.allowedDomain.toLowerCase();
            if (emailDomain !== allowed) {
                return res.status(400).json({
                    success: false,
                    error: `يجب أن يكون بريد الموظف من نفس نطاق الشركة (${allowed})`
                });
            }
        }

        const hashedPassword = await hashPassword(password);
        const [employee] = await db.createEmployee({
            name,
            email,
            password: hashedPassword,
            title,
            passport,
            permissions: permissions || 'Employee',
            companyId: req.user.companyId
        });
        res.status(201).json({ success: true, employee });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/employees/:id', corporateAuth, adminOnly, async (req, res) => {
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
