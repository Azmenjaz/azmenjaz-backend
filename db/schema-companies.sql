-- ============================================================================
-- SafarSmart: Comprehensive Company Profile System Schema
-- ============================================================================
-- Architecture: Multi-tenant architecture with complete data isolation
-- Security: Row-level security, encryption at rest, audit trails
-- Schema Version: 1.0
-- ============================================================================

-- ============================================================================
-- 1. COMPANIES TABLE - أساس نظام الشركات
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    
    -- Basic Information
    name VARCHAR(255) NOT NULL,
    email VARCHAR(320) NOT NULL UNIQUE,
    phone VARCHAR(20),
    website VARCHAR(255),
    
    -- Company Details
    description TEXT,
    industry VARCHAR(100),
    employees_count INTEGER DEFAULT 0 CHECK (employees_count >= 0),
    
    -- Address Information
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    
    -- Corporate Details
    tax_id VARCHAR(50) UNIQUE,
    registration_number VARCHAR(50),
    business_license VARCHAR(50),
    
    -- Logo & Branding
    logo_url VARCHAR(255),
    brand_color VARCHAR(7),
    
    -- Status & Verification
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'cancelled')),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_date TIMESTAMP WITH TIME ZONE,
    
    -- Subscription & Billing
    subscription_plan VARCHAR(50) DEFAULT 'starter' CHECK (subscription_plan IN ('starter', 'professional', 'enterprise')),
    subscription_status VARCHAR(50) DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'suspended')),
    subscription_start_date TIMESTAMP WITH TIME ZONE,
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    purchase_order_required BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    parent_company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    
    -- Audit Fields
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for Companies
CREATE INDEX idx_companies_email ON companies(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_status ON companies(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_country ON companies(country) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_created_at ON companies(created_at DESC);
CREATE INDEX idx_companies_subscription_plan ON companies(subscription_plan) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_parent ON companies(parent_company_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. COMPANY SUBSCRIPTIONS - خطط الاشتراك والمميزات
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_subscriptions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Subscription Details
    plan_name VARCHAR(50) NOT NULL,
    plan_description TEXT,
    max_users INTEGER DEFAULT 10,
    max_trips INTEGER DEFAULT 100,
    max_monthly_budget DECIMAL(12,2),
    
    -- Feature Flags
    has_analytics BOOLEAN DEFAULT FALSE,
    has_mobile_app BOOLEAN DEFAULT FALSE,
    has_api_access BOOLEAN DEFAULT FALSE,
    has_sso BOOLEAN DEFAULT FALSE,
    has_custom_branding BOOLEAN DEFAULT FALSE,
    has_compliance_reports BOOLEAN DEFAULT FALSE,
    has_travel_policies BOOLEAN DEFAULT FALSE,
    has_expense_management BOOLEAN DEFAULT FALSE,
    support_level VARCHAR(50) DEFAULT 'email', -- email, priority, 24x7
    
    -- Billing
    billing_cycle VARCHAR(50) DEFAULT 'monthly', -- monthly, yearly
    price_per_month DECIMAL(10,2),
    total_cost_per_cycle DECIMAL(12,2),
    billing_date INTEGER DEFAULT 1, -- Day of month
    auto_renewal BOOLEAN DEFAULT TRUE,
    
    -- Current Period
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    next_billing_date TIMESTAMP WITH TIME ZONE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_subscriptions_company ON company_subscriptions(company_id);
CREATE INDEX idx_subscriptions_plan ON company_subscriptions(plan_name);
CREATE INDEX idx_subscriptions_next_billing ON company_subscriptions(next_billing_date);

-- ============================================================================
-- 3. COMPANY MEMBERS - أعضاء الشركة والموظفين
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_members (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Member Details
    role_id INTEGER REFERENCES company_roles(id) ON DELETE SET NULL,
    job_title VARCHAR(255),
    department VARCHAR(100),
    manager_id INTEGER REFERENCES company_members(id) ON DELETE SET NULL,
    
    -- Membership Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'invited')),
    invitation_token VARCHAR(255) UNIQUE,
    invitation_sent_at TIMESTAMP WITH TIME ZONE,
    invitation_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Travel Authorization
    is_travel_approver BOOLEAN DEFAULT FALSE,
    daily_budget_limit DECIMAL(10,2),
    monthly_budget_limit DECIMAL(12,2),
    trip_approval_required BOOLEAN DEFAULT FALSE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Ensure one user per company once
    UNIQUE(company_id, user_id) WHERE deleted_at IS NULL
);

CREATE INDEX idx_members_company ON company_members(company_id) WHERE status = 'active';
CREATE INDEX idx_members_user ON company_members(user_id);
CREATE INDEX idx_members_role ON company_members(role_id);
CREATE INDEX idx_members_manager ON company_members(manager_id);
CREATE INDEX idx_members_status ON company_members(status);

-- ============================================================================
-- 4. COMPANY ROLES & PERMISSIONS - الأدوار والصلاحيات
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_roles (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Role Basics
    role_name VARCHAR(100) NOT NULL,
    role_description TEXT,
    
    -- Role Type
    role_type VARCHAR(50) CHECK (role_type IN ('system', 'custom')), -- system roles can't be deleted
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    UNIQUE(company_id, role_name)
);

CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    permission_code VARCHAR(100) UNIQUE NOT NULL,
    permission_name VARCHAR(255) NOT NULL,
    permission_description TEXT,
    category VARCHAR(50), -- users, trips, billing, reports, settings, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES company_roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    
    UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_roles_company ON company_roles(company_id);
CREATE INDEX idx_permissions_category ON permissions(category);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

-- ============================================================================
-- 5. COMPANY SETTINGS - الإعدادات المخصصة للشركة
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Travel Preferences
    preferred_airline VARCHAR(50),
    preferred_hotel_chain VARCHAR(50),
    preferred_car_rental VARCHAR(50),
    
    -- Currency & Language
    default_currency VARCHAR(3) DEFAULT 'SAR',
    default_language VARCHAR(10) DEFAULT 'ar',
    
    -- Travel Policies
    require_approval_for_trips BOOLEAN DEFAULT TRUE,
    approval_required_above_amount DECIMAL(12,2),
    auto_approve_below_amount DECIMAL(12,2),
    
    -- Notifications
    email_notifications_enabled BOOLEAN DEFAULT TRUE,
    sms_notifications_enabled BOOLEAN DEFAULT FALSE,
    
    -- Compliance
    gdpr_compliant BOOLEAN DEFAULT FALSE,
    data_retention_days INTEGER DEFAULT 365,
    
    -- Custom Domain (for white-label)
    custom_domain VARCHAR(255),
    
    -- API Configuration
    api_rate_limit_per_minute INTEGER DEFAULT 100,
    allowed_ip_addresses TEXT, -- JSON array
    
    -- Integration Settings
    saml_enabled BOOLEAN DEFAULT FALSE,
    saml_endpoint VARCHAR(255),
    oauth_enabled BOOLEAN DEFAULT FALSE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_settings_company ON company_settings(company_id);

-- ============================================================================
-- 6. COMPANY BILLING & INVOICES - الفاتورات والدفعات
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_invoices (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Invoice Details
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    
    -- Amounts
    subtotal DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    
    -- Payment
    paid_amount DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled')),
    payment_terms VARCHAR(50), -- net30, net60, etc.
    
    -- Line Items (stored as JSON for flexibility)
    line_items JSONB NOT NULL DEFAULT '[]',
    
    -- Notes
    notes TEXT,
    internal_notes TEXT,
    
    -- Audit
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS invoice_payments (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES company_invoices(id) ON DELETE CASCADE,
    
    -- Payment Details
    payment_date DATE NOT NULL,
    payment_amount DECIMAL(12,2) NOT NULL,
    payment_method VARCHAR(50), -- bank_transfer, credit_card, check, etc.
    transaction_reference VARCHAR(100) UNIQUE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_invoices_company ON company_invoices(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_status ON company_invoices(status);
CREATE INDEX idx_invoices_due_date ON company_invoices(due_date);
CREATE INDEX idx_payments_invoice ON invoice_payments(invoice_id);

-- ============================================================================
-- 7. TRAVEL POLICIES - سياسات السفر للشركة
-- ============================================================================
CREATE TABLE IF NOT EXISTS travel_policies (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Policy Basics
    policy_name VARCHAR(255) NOT NULL,
    policy_description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Approval Hierarchy
    requires_manager_approval BOOLEAN DEFAULT TRUE,
    requires_finance_approval BOOLEAN DEFAULT FALSE,
    requires_ceo_approval BOOLEAN DEFAULT FALSE,
    max_approval_days INTEGER DEFAULT 7,
    
    -- Trip Restrictions
    max_daily_hotel_rate DECIMAL(10,2),
    max_daily_meal_allowance DECIMAL(10,2),
    max_flight_class VARCHAR(50), -- economy, business, first
    preferred_airlines TEXT, -- JSON array
    
    -- Trip Duration Limits
    max_consecutive_days AWAY INTEGER DEFAULT 30,
    min_advance_booking_days INTEGER DEFAULT 7,
    
    -- Budget Controls
    monthly_budget_limit DECIMAL(12,2),
    requires_budget_availability_check BOOLEAN DEFAULT TRUE,
    
    -- Excluded Countries/Regions
    excluded_destinations TEXT, -- JSON array
    high_risk_countries_require_special_approval BOOLEAN DEFAULT TRUE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    UNIQUE(company_id, policy_name)
);

CREATE INDEX idx_policies_company ON travel_policies(company_id) WHERE is_active = TRUE;

-- ============================================================================
-- 8. EXPENSE REPORTS - تقارير المصروفات
-- ============================================================================
CREATE TABLE IF NOT EXISTS expense_reports (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    company_member_id INTEGER NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
    
    -- Report Details
    report_number VARCHAR(50) NOT NULL UNIQUE,
    report_date DATE NOT NULL,
    trip_id INTEGER REFERENCES flightBookings(id) ON DELETE SET NULL,
    
    -- Amounts
    total_expenses DECIMAL(12,2) NOT NULL,
    personal_expenses DECIMAL(12,2) DEFAULT 0,
    reimbursable_expenses DECIMAL(12,2) NOT NULL,
    reimbursement_amount DECIMAL(12,2),
    
    -- Status
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'paid')),
    
    -- Review Info
    reviewer_id INTEGER REFERENCES company_members(id) ON DELETE SET NULL,
    review_date TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Description
    description TEXT,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_items (
    id SERIAL PRIMARY KEY,
    expense_report_id INTEGER NOT NULL REFERENCES expense_reports(id) ON DELETE CASCADE,
    
    -- Expense Details
    category VARCHAR(50), -- flight, hotel, meals, transport, etc.
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'SAR',
    expense_date DATE NOT NULL,
    
    -- Documentation
    description TEXT,
    receipt_url VARCHAR(255),
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_expense_reports_company ON expense_reports(company_id);
CREATE INDEX idx_expense_reports_member ON expense_reports(company_member_id);
CREATE INDEX idx_expense_reports_status ON expense_reports(status);
CREATE INDEX idx_expense_items_report ON expense_items(expense_report_id);

-- ============================================================================
-- 9. AUDIT LOG - سجل التدقيق للتتبع الشامل
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_audit_logs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- User Action
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Action Details
    entity_type VARCHAR(100), -- companies, members, policies, invoices, etc.
    entity_id INTEGER,
    action_type VARCHAR(50), -- create, update, delete, read, export
    
    -- Change Details
    old_values JSONB,
    new_values JSONB,
    change_description TEXT,
    
    -- Request Metadata
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_id VARCHAR(100),
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    INDEX idx_audit_company ON company_audit_logs(company_id),
    INDEX idx_audit_user ON company_audit_logs(user_id),
    INDEX idx_audit_entity ON company_audit_logs(entity_type, entity_id),
    INDEX idx_audit_action ON company_audit_logs(action_type),
    INDEX idx_audit_created_at ON company_audit_logs(created_at DESC)
);

-- ============================================================================
-- 10. COMPANY ACTIVITY LOG - سجل الأنشطة
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_activity_log (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    member_id INTEGER REFERENCES company_members(id) ON DELETE SET NULL,
    
    -- Activity
    activity_type VARCHAR(50), -- trip_created, expense_submitted, approval_requested, etc.
    activity_description TEXT,
    related_entity_type VARCHAR(100),
    related_entity_id INTEGER,
    
    -- Created
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_activity_company ON company_activity_log(company_id);
CREATE INDEX idx_activity_created_at ON company_activity_log(created_at DESC);

-- ============================================================================
-- 11. UPDATE USERS TABLE TO LINK TO COMPANIES
-- ============================================================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- 12. STORED PROCEDURES FOR COMMON OPERATIONS
-- ============================================================================

-- Function to get company with stats
CREATE OR REPLACE FUNCTION get_company_with_stats(p_company_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    name VARCHAR,
    email VARCHAR,
    members_count BIGINT,
    active_invoices_count BIGINT,
    pending_expenses NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.email,
        COUNT(DISTINCT cm.id) as members_count,
        COUNT(DISTINCT ci.id) as active_invoices_count,
        COALESCE(SUM(CASE WHEN er.status = 'submitted' THEN er.reimbursable_expenses ELSE 0 END), 0) as pending_expenses,
        c.created_at
    FROM companies c
    LEFT JOIN company_members cm ON c.id = cm.company_id AND cm.status = 'active'
    LEFT JOIN company_invoices ci ON c.id = ci.company_id AND ci.status NOT IN ('paid', 'cancelled')
    LEFT JOIN expense_reports er ON c.id = er.company_id
    WHERE c.id = p_company_id AND c.deleted_at IS NULL
    GROUP BY c.id, c.name, c.email, c.created_at;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 13. ROW-LEVEL SECURITY FOR MULTI-TENANT ISOLATION
-- ============================================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (these would be added based on your authentication system)
-- Example policy for companies table:
-- CREATE POLICY company_isolation ON companies
--   FOR SELECT USING (
--     id IN (SELECT company_id FROM company_members WHERE user_id = current_user_id())
--     OR created_by = current_user_id()
--   );

-- ============================================================================
-- 14. INITIAL PERMISSIONS DATA
-- ============================================================================
INSERT INTO permissions (permission_code, permission_name, permission_description, category) VALUES
-- Company Management
('company:view', 'View Company', 'View company details and information', 'company'),
('company:edit', 'Edit Company', 'Edit company profile and settings', 'company'),
('company:delete', 'Delete Company', 'Delete company', 'company'),

-- Member Management
('members:view', 'View Members', 'View company members and team', 'members'),
('members:invite', 'Invite Members', 'Invite new members to company', 'members'),
('members:edit', 'Edit Members', 'Edit member details and roles', 'members'),
('members:remove', 'Remove Members', 'Remove members from company', 'members'),

-- Trip Management
('trips:create', 'Create Trip', 'Create and book trips', 'trips'),
('trips:view', 'View Trips', 'View all company trips', 'trips'),
('trips:approve', 'Approve Trips', 'Approve trip requests', 'trips'),
('trips:cancel', 'Cancel Trip', 'Cancel trips', 'trips'),

-- Expense Management
('expenses:create', 'Create Expense', 'Create expense reports', 'expenses'),
('expenses:submit', 'Submit Expenses', 'Submit expense reports for approval', 'expenses'),
('expenses:approve', 'Approve Expenses', 'Approve expense reports', 'expenses'),
('expenses:view', 'View Expenses', 'View expense reports', 'expenses'),

-- Billing & Invoices
('billing:view', 'View Invoices', 'View company invoices', 'billing'),
('billing:manage', 'Manage Billing', 'Manage subscriptions and billing', 'billing'),

-- Reports & Analytics
('reports:view', 'View Reports', 'View company analytics and reports', 'reports'),
('reports:export', 'Export Reports', 'Export reports and data', 'reports'),

-- Settings & Admin
('settings:manage', 'Manage Settings', 'Manage company settings', 'settings'),
('policies:manage', 'Manage Policies', 'Manage travel policies', 'settings'),
('audit:view', 'View Audit Logs', 'View company audit logs', 'settings');

-- ============================================================================
-- 15. DEFAULT SYSTEM ROLES (Company-specific, will be created per company)
-- ============================================================================
-- Note: These roles are created dynamically per company in the application layer
-- System roles: admin, manager, employee, approver, finance

COMMIT;
