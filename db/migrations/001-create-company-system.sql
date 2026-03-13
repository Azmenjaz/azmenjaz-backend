-- ============================================================================
-- SafarSmart Company Profile System - Migration Script
-- ============================================================================
-- Run this script to set up the complete company profile system
-- Date: 2026-03-13
-- Version: 1.0
-- ============================================================================

BEGIN TRANSACTION;

-- Check if tables already exist to prevent re-creation
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'companies') THEN
        
        -- ====================================
        -- CREATE ALL TABLES
        -- ====================================
        
        CREATE TABLE companies (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(320) NOT NULL UNIQUE,
            phone VARCHAR(20),
            website VARCHAR(255),
            description TEXT,
            industry VARCHAR(100),
            employees_count INTEGER DEFAULT 0 CHECK (employees_count >= 0),
            address TEXT,
            city VARCHAR(100),
            country VARCHAR(100),
            postal_code VARCHAR(20),
            tax_id VARCHAR(50) UNIQUE,
            registration_number VARCHAR(50),
            business_license VARCHAR(50),
            logo_url VARCHAR(255),
            brand_color VARCHAR(7),
            status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'cancelled')),
            is_verified BOOLEAN DEFAULT FALSE,
            verification_date TIMESTAMP WITH TIME ZONE,
            subscription_plan VARCHAR(50) DEFAULT 'starter' CHECK (subscription_plan IN ('starter', 'professional', 'enterprise')),
            subscription_status VARCHAR(50) DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'suspended')),
            subscription_start_date TIMESTAMP WITH TIME ZONE,
            subscription_end_date TIMESTAMP WITH TIME ZONE,
            purchase_order_required BOOLEAN DEFAULT FALSE,
            parent_company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
            created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            deleted_at TIMESTAMP WITH TIME ZONE
        );
        
        CREATE INDEX idx_companies_email ON companies(email) WHERE deleted_at IS NULL;
        CREATE INDEX idx_companies_status ON companies(status) WHERE deleted_at IS NULL;
        CREATE INDEX idx_companies_country ON companies(country) WHERE deleted_at IS NULL;
        CREATE INDEX idx_companies_created_at ON companies(created_at DESC);
        CREATE INDEX idx_companies_subscription_plan ON companies(subscription_plan) WHERE deleted_at IS NULL;
        CREATE INDEX idx_companies_parent ON companies(parent_company_id) WHERE deleted_at IS NULL;
        
        -- ========== Company Subscriptions ==========
        CREATE TABLE company_subscriptions (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
            plan_name VARCHAR(50) NOT NULL,
            plan_description TEXT,
            max_users INTEGER DEFAULT 10,
            max_trips INTEGER DEFAULT 100,
            max_monthly_budget DECIMAL(12,2),
            has_analytics BOOLEAN DEFAULT FALSE,
            has_mobile_app BOOLEAN DEFAULT FALSE,
            has_api_access BOOLEAN DEFAULT FALSE,
            has_sso BOOLEAN DEFAULT FALSE,
            has_custom_branding BOOLEAN DEFAULT FALSE,
            has_compliance_reports BOOLEAN DEFAULT FALSE,
            has_travel_policies BOOLEAN DEFAULT FALSE,
            has_expense_management BOOLEAN DEFAULT FALSE,
            support_level VARCHAR(50) DEFAULT 'email',
            billing_cycle VARCHAR(50) DEFAULT 'monthly',
            price_per_month DECIMAL(10,2),
            total_cost_per_cycle DECIMAL(12,2),
            billing_date INTEGER DEFAULT 1,
            auto_renewal BOOLEAN DEFAULT TRUE,
            current_period_start TIMESTAMP WITH TIME ZONE,
            current_period_end TIMESTAMP WITH TIME ZONE,
            next_billing_date TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
        
        CREATE INDEX idx_subscriptions_company ON company_subscriptions(company_id);
        CREATE INDEX idx_subscriptions_plan ON company_subscriptions(plan_name);
        CREATE INDEX idx_subscriptions_next_billing ON company_subscriptions(next_billing_date);
        
        -- ========== Company Roles & Permissions ==========
        CREATE TABLE company_roles (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            role_name VARCHAR(100) NOT NULL,
            role_description TEXT,
            role_type VARCHAR(50) CHECK (role_type IN ('system', 'custom')),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            UNIQUE(company_id, role_name)
        );
        
        CREATE TABLE permissions (
            id SERIAL PRIMARY KEY,
            permission_code VARCHAR(100) UNIQUE NOT NULL,
            permission_name VARCHAR(255) NOT NULL,
            permission_description TEXT,
            category VARCHAR(50),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE TABLE role_permissions (
            id SERIAL PRIMARY KEY,
            role_id INTEGER NOT NULL REFERENCES company_roles(id) ON DELETE CASCADE,
            permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
            UNIQUE(role_id, permission_id)
        );
        
        CREATE INDEX idx_roles_company ON company_roles(company_id);
        CREATE INDEX idx_permissions_category ON permissions(category);
        CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
        
        -- ========== Company Members ==========
        CREATE TABLE company_members (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role_id INTEGER REFERENCES company_roles(id) ON DELETE SET NULL,
            job_title VARCHAR(255),
            department VARCHAR(100),
            manager_id INTEGER REFERENCES company_members(id) ON DELETE SET NULL,
            status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'invited')),
            invitation_token VARCHAR(255) UNIQUE,
            invitation_sent_at TIMESTAMP WITH TIME ZONE,
            invitation_expires_at TIMESTAMP WITH TIME ZONE,
            is_travel_approver BOOLEAN DEFAULT FALSE,
            daily_budget_limit DECIMAL(10,2),
            monthly_budget_limit DECIMAL(12,2),
            trip_approval_required BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            UNIQUE(company_id, user_id)
        );
        
        CREATE INDEX idx_members_company ON company_members(company_id) WHERE status = 'active';
        CREATE INDEX idx_members_user ON company_members(user_id);
        CREATE INDEX idx_members_role ON company_members(role_id);
        CREATE INDEX idx_members_manager ON company_members(manager_id);
        
        -- ========== Company Settings ==========
        CREATE TABLE company_settings (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
            preferred_airline VARCHAR(50),
            preferred_hotel_chain VARCHAR(50),
            preferred_car_rental VARCHAR(50),
            default_currency VARCHAR(3) DEFAULT 'SAR',
            default_language VARCHAR(10) DEFAULT 'ar',
            require_approval_for_trips BOOLEAN DEFAULT TRUE,
            approval_required_above_amount DECIMAL(12,2),
            auto_approve_below_amount DECIMAL(12,2),
            email_notifications_enabled BOOLEAN DEFAULT TRUE,
            sms_notifications_enabled BOOLEAN DEFAULT FALSE,
            gdpr_compliant BOOLEAN DEFAULT FALSE,
            data_retention_days INTEGER DEFAULT 365,
            custom_domain VARCHAR(255),
            api_rate_limit_per_minute INTEGER DEFAULT 100,
            allowed_ip_addresses TEXT,
            saml_enabled BOOLEAN DEFAULT FALSE,
            saml_endpoint VARCHAR(255),
            oauth_enabled BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
        
        CREATE INDEX idx_settings_company ON company_settings(company_id);
        
        -- ========== Travel Policies ==========
        CREATE TABLE travel_policies (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            policy_name VARCHAR(255) NOT NULL,
            policy_description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            requires_manager_approval BOOLEAN DEFAULT TRUE,
            requires_finance_approval BOOLEAN DEFAULT FALSE,
            requires_ceo_approval BOOLEAN DEFAULT FALSE,
            max_approval_days INTEGER DEFAULT 7,
            max_daily_hotel_rate DECIMAL(10,2),
            max_daily_meal_allowance DECIMAL(10,2),
            max_flight_class VARCHAR(50),
            preferred_airlines TEXT,
            max_consecutive_days_away INTEGER DEFAULT 30,
            min_advance_booking_days INTEGER DEFAULT 7,
            monthly_budget_limit DECIMAL(12,2),
            requires_budget_availability_check BOOLEAN DEFAULT TRUE,
            excluded_destinations TEXT,
            high_risk_countries_require_special_approval BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            UNIQUE(company_id, policy_name)
        );
        
        CREATE INDEX idx_policies_company ON travel_policies(company_id) WHERE is_active = TRUE;
        
        -- ========== Company Invoices & Payments ==========
        CREATE TABLE company_invoices (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            invoice_number VARCHAR(50) NOT NULL UNIQUE,
            invoice_date DATE NOT NULL,
            due_date DATE NOT NULL,
            subtotal DECIMAL(12,2) NOT NULL,
            tax_amount DECIMAL(12,2) DEFAULT 0,
            tax_rate DECIMAL(5,2) DEFAULT 0,
            discount_amount DECIMAL(12,2) DEFAULT 0,
            total_amount DECIMAL(12,2) NOT NULL,
            paid_amount DECIMAL(12,2) DEFAULT 0,
            status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled')),
            payment_terms VARCHAR(50),
            line_items JSONB NOT NULL DEFAULT '[]',
            notes TEXT,
            internal_notes TEXT,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            sent_at TIMESTAMP WITH TIME ZONE,
            paid_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
        
        CREATE TABLE invoice_payments (
            id SERIAL PRIMARY KEY,
            invoice_id INTEGER NOT NULL REFERENCES company_invoices(id) ON DELETE CASCADE,
            payment_date DATE NOT NULL,
            payment_amount DECIMAL(12,2) NOT NULL,
            payment_method VARCHAR(50),
            transaction_reference VARCHAR(100) UNIQUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
        
        CREATE INDEX idx_invoices_company ON company_invoices(company_id);
        CREATE INDEX idx_invoices_status ON company_invoices(status);
        CREATE INDEX idx_invoices_due_date ON company_invoices(due_date);
        CREATE INDEX idx_payments_invoice ON invoice_payments(invoice_id);
        
        -- ========== Expense Reports ==========
        CREATE TABLE expense_reports (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            company_member_id INTEGER NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
            report_number VARCHAR(50) NOT NULL UNIQUE,
            report_date DATE NOT NULL,
            trip_id INTEGER REFERENCES flightBookings(id) ON DELETE SET NULL,
            total_expenses DECIMAL(12,2) NOT NULL,
            personal_expenses DECIMAL(12,2) DEFAULT 0,
            reimbursable_expenses DECIMAL(12,2) NOT NULL,
            reimbursement_amount DECIMAL(12,2),
            status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'paid')),
            reviewer_id INTEGER REFERENCES company_members(id) ON DELETE SET NULL,
            review_date TIMESTAMP WITH TIME ZONE,
            rejection_reason TEXT,
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
        
        CREATE TABLE expense_items (
            id SERIAL PRIMARY KEY,
            expense_report_id INTEGER NOT NULL REFERENCES expense_reports(id) ON DELETE CASCADE,
            category VARCHAR(50),
            amount DECIMAL(10,2) NOT NULL,
            currency VARCHAR(3) DEFAULT 'SAR',
            expense_date DATE NOT NULL,
            description TEXT,
            receipt_url VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
        
        CREATE INDEX idx_expense_reports_company ON expense_reports(company_id);
        CREATE INDEX idx_expense_reports_member ON expense_reports(company_member_id);
        CREATE INDEX idx_expense_items_report ON expense_items(expense_report_id);
        
        -- ========== Audit Logs ==========
        CREATE TABLE company_audit_logs (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            entity_type VARCHAR(100),
            entity_id INTEGER,
            action_type VARCHAR(50),
            old_values JSONB,
            new_values JSONB,
            change_description TEXT,
            ip_address VARCHAR(45),
            user_agent TEXT,
            request_id VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
        
        CREATE TABLE company_activity_log (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            member_id INTEGER REFERENCES company_members(id) ON DELETE SET NULL,
            activity_type VARCHAR(50),
            activity_description TEXT,
            related_entity_type VARCHAR(100),
            related_entity_id INTEGER,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
        
        CREATE INDEX idx_audit_company ON company_audit_logs(company_id);
        CREATE INDEX idx_audit_action ON company_audit_logs(action_type);
        CREATE INDEX idx_activity_company ON company_activity_log(company_id);
        CREATE INDEX idx_activity_created_at ON company_activity_log(created_at DESC);
        
        -- ========== Update Users Table ==========
        ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id) WHERE deleted_at IS NULL;
        
        -- ========== Insert Default Permissions ==========
        INSERT INTO permissions (permission_code, permission_name, permission_description, category) VALUES
        ('company:view', 'View Company', 'View company details and information', 'company'),
        ('company:edit', 'Edit Company', 'Edit company profile and settings', 'company'),
        ('company:delete', 'Delete Company', 'Delete company', 'company'),
        ('members:view', 'View Members', 'View company members and team', 'members'),
        ('members:invite', 'Invite Members', 'Invite new members to company', 'members'),
        ('members:edit', 'Edit Members', 'Edit member details and roles', 'members'),
        ('members:remove', 'Remove Members', 'Remove members from company', 'members'),
        ('trips:create', 'Create Trip', 'Create and book trips', 'trips'),
        ('trips:view', 'View Trips', 'View all company trips', 'trips'),
        ('trips:approve', 'Approve Trips', 'Approve trip requests', 'trips'),
        ('trips:cancel', 'Cancel Trip', 'Cancel trips', 'trips'),
        ('expenses:create', 'Create Expense', 'Create expense reports', 'expenses'),
        ('expenses:submit', 'Submit Expenses', 'Submit expense reports for approval', 'expenses'),
        ('expenses:approve', 'Approve Expenses', 'Approve expense reports', 'expenses'),
        ('expenses:view', 'View Expenses', 'View expense reports', 'expenses'),
        ('billing:view', 'View Invoices', 'View company invoices', 'billing'),
        ('billing:manage', 'Manage Billing', 'Manage subscriptions and billing', 'billing'),
        ('reports:view', 'View Reports', 'View company analytics and reports', 'reports'),
        ('reports:export', 'Export Reports', 'Export reports and data', 'reports'),
        ('settings:manage', 'Manage Settings', 'Manage company settings', 'settings'),
        ('policies:manage', 'Manage Policies', 'Manage travel policies', 'settings'),
        ('audit:view', 'View Audit Logs', 'View company audit logs', 'settings')
        ON CONFLICT (permission_code) DO NOTHING;
        
        RAISE NOTICE 'Company Profile System tables created successfully!';
        
    ELSE
        RAISE NOTICE 'Tables already exist. Skipping creation.';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- Script to check if migration was successful
-- ============================================================================
SELECT 'Migration Status' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'company%' 
OR table_name = 'companies'
OR table_name = 'permissions'
OR table_name = 'travel_policies'
OR table_name = 'expense_%'
ORDER BY table_name;
