-- ============================================
-- PHASE 3.1: SCOUT PROFILE MANAGEMENT SYSTEM
-- PostgreSQL Migration 004
-- Date: 2026-02-10
-- ============================================

-- This migration adds organization-agnostic scout profile management
-- with Girl Scouts USA as the initial organization.
--
-- New Tables (12):
-- - scout_organizations (org registry)
-- - level_systems, scout_levels (rank/level definitions)
-- - badge_catalogs, badges (badge system)
-- - role_definition_sets, leadership_roles (leadership positions)
-- - color_palettes, color_definitions (branding colors)
-- - scout_profiles, scout_positions, scout_badges (scout data)
--
-- Modified Tables:
-- - troops: add organizationId column

BEGIN TRANSACTION;

-- ==============================================
-- SCOUT ORGANIZATIONS - Registry of scouting organizations
-- ==============================================

CREATE TABLE IF NOT EXISTS scout_organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "orgCode" VARCHAR(50) UNIQUE NOT NULL,
    "orgName" VARCHAR(255) NOT NULL,
    "orgType" VARCHAR(50) NOT NULL,
    description TEXT,
    "websiteUrl" VARCHAR(500),
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT orgType_check CHECK ("orgType" IN ('girl_scouts', 'scouting_america', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_scout_organizations_orgCode ON scout_organizations("orgCode");
CREATE INDEX IF NOT EXISTS idx_scout_organizations_isActive ON scout_organizations("isActive");

COMMENT ON TABLE scout_organizations IS 'Registry of scouting organizations (GSUSA, Scouting America, etc.)';
COMMENT ON COLUMN scout_organizations."orgCode" IS 'Unique organization code: gsusa, sa_cub, sa_bsa, etc.';

-- ==============================================
-- LEVEL SYSTEMS - Rank/level progression systems
-- ==============================================

CREATE TABLE IF NOT EXISTS level_systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "organizationId" UUID NOT NULL,
    "systemName" VARCHAR(255) NOT NULL,
    description TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY ("organizationId") REFERENCES scout_organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_level_systems_organizationId ON level_systems("organizationId");

COMMENT ON TABLE level_systems IS 'Level systems define rank/level progressions (Girl Scout Levels, Cub Scout Ranks, etc.)';

-- ==============================================
-- SCOUT LEVELS - Individual ranks/levels
-- ==============================================

CREATE TABLE IF NOT EXISTS scout_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "levelSystemId" UUID NOT NULL,
    "levelCode" VARCHAR(50) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "gradeRange" VARCHAR(20),
    "ageRange" VARCHAR(20),
    "uniformColor" VARCHAR(50),
    description TEXT,
    "sortOrder" INTEGER DEFAULT 0,
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY ("levelSystemId") REFERENCES level_systems(id) ON DELETE CASCADE,
    CONSTRAINT unique_level_per_system UNIQUE("levelSystemId", "levelCode")
);

CREATE INDEX IF NOT EXISTS idx_scout_levels_levelSystemId ON scout_levels("levelSystemId");
CREATE INDEX IF NOT EXISTS idx_scout_levels_sortOrder ON scout_levels("sortOrder");

COMMENT ON TABLE scout_levels IS 'Individual scout levels with grade ranges, ages, and official colors';

-- ==============================================
-- BADGE CATALOGS - Versioned badge collections
-- ==============================================

CREATE TABLE IF NOT EXISTS badge_catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "organizationId" UUID NOT NULL,
    "catalogName" VARCHAR(255) NOT NULL,
    "catalogYear" VARCHAR(10),
    description TEXT,
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY ("organizationId") REFERENCES scout_organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_badge_catalogs_organizationId ON badge_catalogs("organizationId");
CREATE INDEX IF NOT EXISTS idx_badge_catalogs_isActive ON badge_catalogs("isActive");

COMMENT ON TABLE badge_catalogs IS 'Versioned badge catalogs for different organizations and years';

-- ==============================================
-- BADGES - Badge definitions
-- ==============================================

CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "badgeCatalogId" UUID NOT NULL,
    "badgeCode" VARCHAR(100) NOT NULL,
    "badgeName" VARCHAR(255) NOT NULL,
    "badgeType" VARCHAR(50),
    description TEXT,
    "applicableLevels" JSONB,
    "imageUrl" TEXT,
    requirements TEXT,
    "detailsUrl" TEXT,
    "isActive" BOOLEAN DEFAULT TRUE,
    "sortOrder" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY ("badgeCatalogId") REFERENCES badge_catalogs(id) ON DELETE CASCADE,
    CONSTRAINT unique_badge_per_catalog UNIQUE("badgeCatalogId", "badgeCode")
);

CREATE INDEX IF NOT EXISTS idx_badges_badgeCatalogId ON badges("badgeCatalogId");
CREATE INDEX IF NOT EXISTS idx_badges_badgeType ON badges("badgeType");
CREATE INDEX IF NOT EXISTS idx_badges_applicableLevels ON badges USING GIN ("applicableLevels");

COMMENT ON TABLE badges IS 'Badge definitions with requirements and applicable levels';

-- ==============================================
-- ROLE DEFINITION SETS - Leadership role definitions
-- ==============================================

CREATE TABLE IF NOT EXISTS role_definition_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "organizationId" UUID NOT NULL,
    "setName" VARCHAR(255) NOT NULL,
    description TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY ("organizationId") REFERENCES scout_organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_role_definition_sets_organizationId ON role_definition_sets("organizationId");

COMMENT ON TABLE role_definition_sets IS 'Sets of leadership role definitions for organizations';

-- ==============================================
-- LEADERSHIP ROLES - Individual role definitions
-- ==============================================

CREATE TABLE IF NOT EXISTS leadership_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "roleSetId" UUID NOT NULL,
    "roleCode" VARCHAR(100) NOT NULL,
    "displayName" VARCHAR(255) NOT NULL,
    description TEXT,
    "roleType" VARCHAR(20),
    "minAge" INTEGER,
    requirements TEXT,
    "sortOrder" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY ("roleSetId") REFERENCES role_definition_sets(id) ON DELETE CASCADE,
    CONSTRAINT roleType_check CHECK ("roleType" IN ('youth', 'adult'))
);

CREATE INDEX IF NOT EXISTS idx_leadership_roles_roleSetId ON leadership_roles("roleSetId");
CREATE INDEX IF NOT EXISTS idx_leadership_roles_roleType ON leadership_roles("roleType");

COMMENT ON TABLE leadership_roles IS 'Leadership role definitions (Patrol Leader, Treasurer, etc.)';

-- ==============================================
-- COLOR PALETTES - Organization color schemes
-- ==============================================

CREATE TABLE IF NOT EXISTS color_palettes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "organizationId" UUID NOT NULL,
    "paletteName" VARCHAR(255) NOT NULL,
    description TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY ("organizationId") REFERENCES scout_organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_color_palettes_organizationId ON color_palettes("organizationId");

COMMENT ON TABLE color_palettes IS 'Color palettes for organizations (branding)';

-- ==============================================
-- COLOR DEFINITIONS - Individual colors
-- ==============================================

CREATE TABLE IF NOT EXISTS color_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "paletteId" UUID NOT NULL,
    "colorName" VARCHAR(100) NOT NULL,
    "hexValue" VARCHAR(7),
    "rgbValue" VARCHAR(50),
    "cssVariable" VARCHAR(100),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY ("paletteId") REFERENCES color_palettes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_color_definitions_paletteId ON color_definitions("paletteId");

COMMENT ON TABLE color_definitions IS 'Individual color definitions within palettes';

-- ==============================================
-- SCOUT PROFILES - Organization-aware scout profiles
-- ==============================================

CREATE TABLE IF NOT EXISTS scout_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL UNIQUE,
    "organizationId" UUID NOT NULL,
    "troopId" UUID,
    "currentLevelId" UUID,
    "levelSince" DATE,
    status VARCHAR(20) DEFAULT 'active',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY ("organizationId") REFERENCES scout_organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY ("troopId") REFERENCES troops(id) ON DELETE SET NULL,
    FOREIGN KEY ("currentLevelId") REFERENCES scout_levels(id) ON DELETE SET NULL,
    CONSTRAINT status_check CHECK (status IN ('active', 'inactive', 'transferred', 'graduated'))
);

CREATE INDEX IF NOT EXISTS idx_scout_profiles_userId ON scout_profiles("userId");
CREATE INDEX IF NOT EXISTS idx_scout_profiles_organizationId ON scout_profiles("organizationId");
CREATE INDEX IF NOT EXISTS idx_scout_profiles_troopId ON scout_profiles("troopId");
CREATE INDEX IF NOT EXISTS idx_scout_profiles_currentLevelId ON scout_profiles("currentLevelId");
CREATE INDEX IF NOT EXISTS idx_scout_profiles_status ON scout_profiles(status);

COMMENT ON TABLE scout_profiles IS 'Organization-aware scout profiles with level tracking';

-- ==============================================
-- SCOUT POSITIONS - Leadership positions held
-- ==============================================

CREATE TABLE IF NOT EXISTS scout_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "scoutProfileId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "troopId" UUID,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    notes TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY ("scoutProfileId") REFERENCES scout_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY ("roleId") REFERENCES leadership_roles(id) ON DELETE RESTRICT,
    FOREIGN KEY ("troopId") REFERENCES troops(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_scout_positions_scoutProfileId ON scout_positions("scoutProfileId");
CREATE INDEX IF NOT EXISTS idx_scout_positions_roleId ON scout_positions("roleId");
CREATE INDEX IF NOT EXISTS idx_scout_positions_dates ON scout_positions("startDate", "endDate");

COMMENT ON TABLE scout_positions IS 'Leadership positions held by scouts';

-- ==============================================
-- SCOUT BADGES - Badge awards tracking
-- ==============================================

CREATE TABLE IF NOT EXISTS scout_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "badgeId" UUID NOT NULL,
    "troopId" UUID,
    "earnedDate" DATE NOT NULL,
    "recognizedDate" DATE,
    "verifiedBy" UUID,
    "verifiedDate" DATE,
    notes TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY ("badgeId") REFERENCES badges(id) ON DELETE RESTRICT,
    FOREIGN KEY ("troopId") REFERENCES troops(id) ON DELETE SET NULL,
    FOREIGN KEY ("verifiedBy") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT unique_badge_per_scout UNIQUE("userId", "badgeId", "earnedDate")
);

CREATE INDEX IF NOT EXISTS idx_scout_badges_userId ON scout_badges("userId");
CREATE INDEX IF NOT EXISTS idx_scout_badges_badgeId ON scout_badges("badgeId");
CREATE INDEX IF NOT EXISTS idx_scout_badges_earnedDate ON scout_badges("earnedDate");

COMMENT ON TABLE scout_badges IS 'Badges earned by scouts with verification workflow';

-- ==============================================
-- MODIFY EXISTING TABLES
-- ==============================================

-- Add organizationId to troops table (backward compatible)
ALTER TABLE troops ADD COLUMN IF NOT EXISTS "organizationId" UUID;

-- Add foreign key constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'troops' AND constraint_name = 'fk_troops_organization'
    ) THEN
        ALTER TABLE troops ADD CONSTRAINT fk_troops_organization
            FOREIGN KEY ("organizationId") REFERENCES scout_organizations(id) ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_troops_organizationId ON troops("organizationId");

COMMENT ON COLUMN troops."organizationId" IS 'Links troop to scouting organization (GSUSA, SA, etc.)';

-- ==============================================
-- MIGRATION COMPLETE
-- ==============================================

COMMIT;

-- Verification queries (run these after migration to confirm):
--
-- SELECT tablename FROM pg_tables
-- WHERE tablename LIKE 'scout_%' OR tablename = 'color_definitions'
-- ORDER BY tablename;
--
-- SELECT COUNT(*) FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE 'scout_%';
