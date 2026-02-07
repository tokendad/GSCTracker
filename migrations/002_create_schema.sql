-- Apex Scout Manager PostgreSQL Schema with UUIDs
-- Migrated from SQLite to PostgreSQL
-- Date: 2026-02-07

-- ===========================================
-- AUTHENTICATION & USER MANAGEMENT TABLES
-- ===========================================

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'scout',
    "isActive" BOOLEAN DEFAULT TRUE,
    "emailVerified" BOOLEAN DEFAULT FALSE,
    "dateOfBirth" DATE,
    "isMinor" BOOLEAN DEFAULT FALSE,
    "parentEmail" VARCHAR(255),
    "parentConsentDate" TIMESTAMP WITH TIME ZONE,
    "parentConsentIP" VARCHAR(45),
    "googleId" VARCHAR(255) UNIQUE,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "lastLogin" TIMESTAMP WITH TIME ZONE,
    CONSTRAINT role_check CHECK (role IN ('scout', 'troop_leader', 'council_admin', 'parent'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users("googleId") WHERE "googleId" IS NOT NULL;
CREATE INDEX idx_users_role ON users(role);

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "sessionToken" VARCHAR(255) UNIQUE NOT NULL,
    "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_token ON sessions("sessionToken");
CREATE INDEX idx_sessions_userId ON sessions("userId");
CREATE INDEX idx_sessions_expiresAt ON sessions("expiresAt");

-- Audit log table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID,
    action VARCHAR(100) NOT NULL,
    "resourceType" VARCHAR(100) NOT NULL,
    "resourceId" UUID,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    details TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_log_userId ON audit_log("userId");
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_log_resourceType ON audit_log("resourceType", "resourceId");

-- Data deletion requests (COPPA compliance)
CREATE TABLE data_deletion_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "requestedBy" UUID NOT NULL,
    reason TEXT,
    "requestDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "completionDate" TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending',
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY ("requestedBy") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT status_check CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

CREATE INDEX idx_data_deletion_requests_userId ON data_deletion_requests("userId");
CREATE INDEX idx_data_deletion_requests_status ON data_deletion_requests(status);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    type VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    "isRead" BOOLEAN DEFAULT FALSE,
    "actionUrl" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT type_check CHECK (type IN ('info', 'success', 'warning', 'error', 'achievement'))
);

CREATE INDEX idx_notifications_userId ON notifications("userId");
CREATE INDEX idx_notifications_isRead ON notifications("userId", "isRead");

-- ===========================================
-- ORGANIZATIONAL STRUCTURE TABLES
-- ===========================================

-- Councils table
CREATE TABLE councils (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    region VARCHAR(100),
    "contactEmail" VARCHAR(255),
    "contactPhone" VARCHAR(50),
    address TEXT,
    website VARCHAR(255),
    settings TEXT,
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_councils_name ON councils(name);
CREATE INDEX idx_councils_isActive ON councils("isActive");

-- Troops table
CREATE TABLE troops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "councilId" UUID,
    "troopNumber" VARCHAR(50) NOT NULL,
    "troopType" VARCHAR(20) NOT NULL,
    "leaderId" UUID,
    "meetingLocation" TEXT,
    "meetingDay" VARCHAR(20),
    "meetingTime" VARCHAR(20),
    settings TEXT,
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "troopName" VARCHAR(255),
    "cookieLeaderId" UUID,
    season VARCHAR(20),
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    FOREIGN KEY ("councilId") REFERENCES councils(id) ON DELETE SET NULL,
    FOREIGN KEY ("leaderId") REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY ("cookieLeaderId") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT troopType_check CHECK ("troopType" IN ('daisy', 'brownie', 'junior', 'cadette', 'senior', 'ambassador', 'multi-level'))
);

CREATE INDEX idx_troops_councilId ON troops("councilId");
CREATE INDEX idx_troops_leaderId ON troops("leaderId");
CREATE INDEX idx_troops_season ON troops(season);
CREATE INDEX idx_troops_cookieLeaderId ON troops("cookieLeaderId");

-- Troop members table
CREATE TABLE troop_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "troopId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    "scoutLevel" VARCHAR(20),
    "linkedParentId" UUID,
    "parentRole" VARCHAR(50),
    "joinDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "leaveDate" TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active',
    "linkedScoutId" UUID,
    notes TEXT,
    FOREIGN KEY ("troopId") REFERENCES troops(id) ON DELETE CASCADE,
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY ("linkedParentId") REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY ("linkedScoutId") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT role_check CHECK (role IN ('member', 'co-leader', 'assistant', 'parent')),
    CONSTRAINT status_check CHECK (status IN ('active', 'inactive', 'transferred')),
    UNIQUE("troopId", "userId")
);

CREATE INDEX idx_troop_members_troopId ON troop_members("troopId");
CREATE INDEX idx_troop_members_userId ON troop_members("userId");
CREATE INDEX idx_troop_members_status ON troop_members(status);

-- Troop goals table
CREATE TABLE troop_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "troopId" UUID NOT NULL,
    "goalType" VARCHAR(20) NOT NULL,
    "targetAmount" NUMERIC(10,2) NOT NULL,
    "actualAmount" NUMERIC(10,2) DEFAULT 0,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'in_progress',
    description TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    FOREIGN KEY ("troopId") REFERENCES troops(id) ON DELETE CASCADE,
    FOREIGN KEY ("createdBy") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT goalType_check CHECK ("goalType" IN ('boxes_sold', 'revenue', 'participation', 'events', 'donations')),
    CONSTRAINT status_check CHECK (status IN ('in_progress', 'completed', 'cancelled'))
);

CREATE INDEX idx_troop_goals_troopId ON troop_goals("troopId");
CREATE INDEX idx_troop_goals_status ON troop_goals(status);

-- Troop invitations table
CREATE TABLE troop_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "troopId" UUID NOT NULL,
    "invitedEmail" VARCHAR(255) NOT NULL,
    "invitedUserId" UUID,
    "invitedRole" VARCHAR(20) NOT NULL DEFAULT 'member',
    "invitedBy" UUID NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY ("troopId") REFERENCES troops(id) ON DELETE CASCADE,
    FOREIGN KEY ("invitedUserId") REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY ("invitedBy") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT status_check CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    CONSTRAINT role_check CHECK ("invitedRole" IN ('member', 'scout', 'parent', 'co-leader', 'assistant', 'cookie_leader'))
);

CREATE INDEX idx_troop_invitations_token ON troop_invitations(token);
CREATE INDEX idx_troop_invitations_email ON troop_invitations("invitedEmail");
CREATE INDEX idx_troop_invitations_user ON troop_invitations("invitedUserId");
CREATE INDEX idx_troop_invitations_troop ON troop_invitations("troopId");

-- ===========================================
-- COOKIE CATALOG TABLES
-- ===========================================

-- Seasons table
CREATE TABLE seasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isActive" BOOLEAN DEFAULT FALSE,
    "pricePerBox" NUMERIC(10,2) DEFAULT 6.00,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_seasons_active ON seasons("isActive");
CREATE INDEX idx_seasons_year ON seasons(year);

-- Cookie products table
CREATE TABLE cookie_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season VARCHAR(10) NOT NULL,
    "cookieName" VARCHAR(100) NOT NULL,
    "shortName" VARCHAR(50),
    description TEXT,
    "pricePerBox" NUMERIC(10,2) NOT NULL DEFAULT 6.00,
    "boxesPerCase" INTEGER DEFAULT 12,
    "isActive" BOOLEAN DEFAULT TRUE,
    "sortOrder" INTEGER DEFAULT 0,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE,
    UNIQUE(season, "cookieName")
);

CREATE INDEX idx_cookie_products_season ON cookie_products(season);
CREATE INDEX idx_cookie_products_active ON cookie_products(season, "isActive");

-- Cookie attributes table
CREATE TABLE cookie_attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "productId" UUID NOT NULL,
    "attributeType" VARCHAR(20) NOT NULL,
    "attributeValue" VARCHAR(100) NOT NULL,
    "displayLabel" VARCHAR(100),
    FOREIGN KEY ("productId") REFERENCES cookie_products(id) ON DELETE CASCADE,
    CONSTRAINT attributeType_check CHECK ("attributeType" IN ('dietary', 'allergen', 'certification'))
);

CREATE INDEX idx_cookie_attributes_product ON cookie_attributes("productId");

-- Cookie nutrition table
CREATE TABLE cookie_nutrition (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "productId" UUID NOT NULL UNIQUE,
    "servingSize" VARCHAR(50),
    "servingsPerBox" INTEGER,
    calories INTEGER,
    "totalFat" NUMERIC(5,2),
    "saturatedFat" NUMERIC(5,2),
    "transFat" NUMERIC(5,2),
    cholesterol NUMERIC(5,2),
    sodium NUMERIC(6,2),
    "totalCarbs" NUMERIC(5,2),
    "dietaryFiber" NUMERIC(5,2),
    sugars NUMERIC(5,2),
    protein NUMERIC(5,2),
    ingredients TEXT,
    FOREIGN KEY ("productId") REFERENCES cookie_products(id) ON DELETE CASCADE
);

CREATE INDEX idx_cookie_nutrition_product ON cookie_nutrition("productId");

-- ===========================================
-- CORE DATA TABLES (Sales, Events, etc.)
-- ===========================================

-- Sales table
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "cookieType" VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    "customerName" VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    "saleType" VARCHAR(20) DEFAULT 'individual',
    "customerAddress" TEXT,
    "customerPhone" VARCHAR(50),
    "customerEmail" VARCHAR(255),
    "unitType" VARCHAR(10) DEFAULT 'box',
    "amountCollected" NUMERIC(10,2) DEFAULT 0,
    "amountDue" NUMERIC(10,2) DEFAULT 0,
    "paymentMethod" VARCHAR(50),
    "orderNumber" VARCHAR(100),
    "orderType" VARCHAR(50),
    "orderStatus" VARCHAR(50),
    "userId" UUID,
    season VARCHAR(10),
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_sales_userId ON sales("userId");
CREATE INDEX idx_sales_season ON sales(season);
CREATE INDEX idx_sales_date ON sales(date);

-- Profile table
CREATE TABLE profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID UNIQUE,
    "scoutName" VARCHAR(255),
    email VARCHAR(255),
    "photoData" TEXT,
    "qrCodeUrl" TEXT,
    "paymentQrCodeUrl" TEXT,
    "goalBoxes" INTEGER DEFAULT 0,
    "goalAmount" NUMERIC(10,2) DEFAULT 0,
    "inventoryThinMints" INTEGER DEFAULT 0,
    "inventorySamoas" INTEGER DEFAULT 0,
    "inventoryTagalongs" INTEGER DEFAULT 0,
    "inventoryTrefoils" INTEGER DEFAULT 0,
    "inventoryDosiDos" INTEGER DEFAULT 0,
    "inventoryLemonUps" INTEGER DEFAULT 0,
    "inventoryAdventurefuls" INTEGER DEFAULT 0,
    "inventoryExploremores" INTEGER DEFAULT 0,
    "inventoryToffeetastic" INTEGER DEFAULT 0,
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_profile_userId ON profile("userId");

-- Donations table
CREATE TABLE donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    amount NUMERIC(10,2) NOT NULL,
    "donorName" VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    "userId" UUID,
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_donations_userId ON donations("userId");
CREATE INDEX idx_donations_date ON donations(date);

-- Events table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "eventName" VARCHAR(255) NOT NULL,
    "eventDate" DATE NOT NULL,
    description TEXT,
    "initialBoxes" INTEGER DEFAULT 0,
    "initialCases" INTEGER DEFAULT 0,
    "remainingBoxes" INTEGER DEFAULT 0,
    "remainingCases" INTEGER DEFAULT 0,
    "donationsReceived" NUMERIC(10,2) DEFAULT 0,
    "userId" UUID,
    "troopId" UUID,
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY ("troopId") REFERENCES troops(id) ON DELETE SET NULL
);

CREATE INDEX idx_events_userId ON events("userId");
CREATE INDEX idx_events_troopId ON events("troopId");
CREATE INDEX idx_events_date ON events("eventDate");

-- Payment methods table
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    "isEnabled" BOOLEAN DEFAULT TRUE,
    "userId" UUID,
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_payment_methods_userId ON payment_methods("userId");
CREATE INDEX idx_payment_methods_enabled ON payment_methods("isEnabled");

-- ===========================================
-- COMMENTS
-- ===========================================

COMMENT ON TABLE users IS 'User accounts with authentication and COPPA compliance';
COMMENT ON TABLE sessions IS 'User sessions (legacy table - sessions moving to Redis)';
COMMENT ON TABLE audit_log IS 'Security and compliance audit trail';
COMMENT ON TABLE councils IS 'Girl Scout/Scouting America councils';
COMMENT ON TABLE troops IS 'Scout troops within councils';
COMMENT ON TABLE troop_members IS 'Scout and leader membership in troops';
COMMENT ON TABLE cookie_products IS 'Cookie catalog by season';
COMMENT ON TABLE sales IS 'Individual cookie sales records';
COMMENT ON TABLE profile IS 'Scout profiles with inventory tracking';
COMMENT ON TABLE donations IS 'Donation records';
COMMENT ON TABLE events IS 'Cookie booth sales events';
