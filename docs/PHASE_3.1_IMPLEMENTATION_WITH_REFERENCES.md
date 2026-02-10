# Phase 3.1: Scout Profile Management - Implementation Plan with Organization References

**Status:** Planning Phase
**Created:** 2026-02-09
**References:** Girl Scout Resources + Scouting America Resources
**Scope:** Foundation for multi-organization support (Girl Scouts initially, Scouting America roadmap)

---

## Executive Summary

Phase 3.1 implementation will be **organization-agnostic** with Girl Scouts as the initial implementation, building a foundation that easily extends to Scouting America (and other organizations in future versions).

**Key Design Principle:** The database schema and API will support pluggable organization types, level systems, badge catalogs, and role definitions.

---

## Reference Material Inventory

### Girl Scout Resources Available
✅ **Organization Structure:** Hierarchy documentation (GSUSA → Council → Service Unit → Troop → Scout)
✅ **Level System:** 6 levels (Daisy K-1, Brownie 2-3, Junior 4-5, Cadette 6-8, Senior 9-10, Ambassador 11-12)
✅ **Badge Catalogs:** Official PDFs for each level (Daisy through Ambassador)
✅ **Color Codes:** Official Girl Scout level colors (hex codes provided)
✅ **Cookie Program:** 2025-26 Goal Getter Order Card + Booth Inventory Sheet
✅ **Branding:** Brand resources and guidelines
✅ **Roles:** Troop Leader, Cookie Manager, Treasurer, etc.

### Scouting America Resources Available
✅ **Organization Structure:** Council → Chartered Organization → Troop structure
✅ **Programs:** 5 programs (Cub Scouts, Scouts BSA, Venturing, Sea Scouts, Exploring)
✅ **Cub Scout Ranks:** 5 ranks (Lion, Tiger, Wolf, Bear, Webelos, Arrow of Light)
✅ **Scouts BSA Ranks:** Traditional rank progression to Eagle Scout
✅ **Youth Positions:** 15+ leadership roles (SPL, Patrol Leader, Scribe, etc.)
✅ **Adult Positions:** Scoutmaster, Committee, Chartered Organization Rep
✅ **Branding:** Colors and branding guidelines
✅ **Career Exploration:** Exploring program details

### Future Organizations (Placeholder)
⏳ International Girl Guide Organizations
⏳ Royal Rangers (Christian scouting)
⏳ Other regional scouting programs

---

## Architecture: Organization-Agnostic Design

### Concept: "Scout Organization Type" Pattern

Instead of hardcoding Girl Scouts, create a flexible system where organizations register their:
1. **Level System** (how scouts progress)
2. **Badge/Achievement System** (recognition types)
3. **Role Definitions** (leadership positions)
4. **Color Palette** (branding)
5. **Organizational Hierarchy** (structure)

### Database Schema: Organization-Aware

```sql
-- CORE: Scout Organizations
CREATE TABLE scout_organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orgCode TEXT UNIQUE NOT NULL,           -- 'gsusa', 'sa_cub', 'sa_bsa', etc.
    orgName TEXT NOT NULL,                  -- 'Girl Scouts USA', 'Scouting America - Cub Scouts'
    orgType TEXT NOT NULL,                  -- 'girl_scouts', 'scouting_america', 'other'
    description TEXT,
    websiteUrl TEXT,

    -- Configuration
    levelSystemId INTEGER,                  -- FK to level_systems
    badgeCatalogId INTEGER,                 -- FK to badge_catalogs
    roleSetId INTEGER,                      -- FK to role_definitions
    colorPaletteId INTEGER,                 -- FK to color_palettes

    -- Metadata
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (levelSystemId) REFERENCES level_systems(id),
    FOREIGN KEY (badgeCatalogId) REFERENCES badge_catalogs(id),
    FOREIGN KEY (roleSetId) REFERENCES role_definitions(id),
    FOREIGN KEY (colorPaletteId) REFERENCES color_palettes(id)
);

-- SUPPORT: Level Systems
CREATE TABLE level_systems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    systemName TEXT NOT NULL,               -- 'Girl Scout Levels', 'Cub Scout Ranks', 'Scouts BSA Ranks'
    organizationId INTEGER,
    description TEXT,

    FOREIGN KEY (organizationId) REFERENCES scout_organizations(id)
);

CREATE TABLE scout_levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    levelSystemId INTEGER NOT NULL,
    levelCode TEXT NOT NULL,                -- 'daisy', 'tiger', 'first_class', etc.
    displayName TEXT NOT NULL,              -- 'Daisy', 'Tiger', 'First Class'
    gradeRange TEXT,                        -- 'K-1', '1st'
    ageRange TEXT,                          -- '5-7', '6-7'
    uniformColor TEXT,                      -- Color/hex code
    description TEXT,
    sortOrder INTEGER,
    isActive INTEGER DEFAULT 1,

    UNIQUE(levelSystemId, levelCode)
);

-- SUPPORT: Badge Catalogs
CREATE TABLE badge_catalogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    catalogName TEXT NOT NULL,              -- 'GSUSA 2025-26', 'SA Merit Badges 2025'
    organizationId INTEGER,
    description TEXT,

    FOREIGN KEY (organizationId) REFERENCES scout_organizations(id)
);

CREATE TABLE badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    badgeCatalogId INTEGER NOT NULL,
    badgeCode TEXT NOT NULL,
    badgeName TEXT NOT NULL,
    badgeType TEXT,                         -- 'activity', 'journey', 'merit', 'award', etc.
    description TEXT,
    applicableLevels TEXT,                  -- JSON array of level codes
    imageUrl TEXT,
    requirements TEXT,
    detailsUrl TEXT,
    isActive INTEGER DEFAULT 1,

    UNIQUE(badgeCatalogId, badgeCode),
    FOREIGN KEY (badgeCatalogId) REFERENCES badge_catalogs(id)
);

-- SUPPORT: Role Definitions
CREATE TABLE role_definition_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setName TEXT NOT NULL,                  -- 'Girl Scout Leadership', 'Scouts BSA Leadership'
    organizationId INTEGER,
    description TEXT,

    FOREIGN KEY (organizationId) REFERENCES scout_organizations(id)
);

CREATE TABLE leadership_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roleSetId INTEGER NOT NULL,
    roleCode TEXT NOT NULL,                 -- 'troop_leader', 'spl', 'den_chief', etc.
    displayName TEXT NOT NULL,
    description TEXT,
    roleType TEXT,                          -- 'youth', 'adult'
    minAge INTEGER,
    requirements TEXT,

    FOREIGN KEY (roleSetId) REFERENCES role_definition_sets(id)
);

-- SUPPORT: Color Palettes
CREATE TABLE color_palettes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paletteName TEXT NOT NULL,              -- 'Girl Scout Colors', 'Scouting America Colors'
    organizationId INTEGER,
    description TEXT,

    FOREIGN KEY (organizationId) REFERENCES scout_organizations(id)
);

CREATE TABLE color_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paletteId INTEGER NOT NULL,
    colorName TEXT NOT NULL,                -- 'daisy_blue', 'brownie_brown', etc.
    hexValue TEXT,                          -- '#A0DEF1'
    rgbValue TEXT,                          -- 'rgb(160, 222, 241)'
    cssVariable TEXT,                       -- '--gs-daisy-blue'

    FOREIGN KEY (paletteId) REFERENCES color_palettes(id)
);

-- CORE: Scout Profile (Organization-Aware)
CREATE TABLE scout_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL UNIQUE,
    organizationId INTEGER NOT NULL,        -- Which organization (GSUSA, SA, etc.)
    troopId INTEGER NOT NULL,

    -- Level Information
    currentLevelId INTEGER,                 -- FK to scout_levels (organization-specific)
    levelSince TEXT,

    -- Status
    status TEXT DEFAULT 'active',

    -- Tracking
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT,

    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (organizationId) REFERENCES scout_organizations(id),
    FOREIGN KEY (troopId) REFERENCES troops(id),
    FOREIGN KEY (currentLevelId) REFERENCES scout_levels(id)
);

-- CORE: Scout Positions (Organization-Aware)
CREATE TABLE scout_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scoutId INTEGER NOT NULL,
    roleId INTEGER NOT NULL,                -- FK to leadership_roles
    troopId INTEGER,

    startDate TEXT,
    endDate TEXT,

    FOREIGN KEY (scoutId) REFERENCES scout_profiles(id),
    FOREIGN KEY (roleId) REFERENCES leadership_roles(id),
    FOREIGN KEY (troopId) REFERENCES troops(id)
);

-- CORE: Scout Badges (Organization-Aware)
CREATE TABLE scout_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    badgeId INTEGER NOT NULL,               -- FK to badges (organization-specific)
    troopId INTEGER,

    earnedDate TEXT NOT NULL,
    recognizedDate TEXT,
    verifiedBy INTEGER,
    verifiedDate TEXT,

    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (badgeId) REFERENCES badges(id),
    FOREIGN KEY (troopId) REFERENCES troops(id)
);
```

### Key Design Benefits

✅ **Extensible:** New organizations added by creating records in `scout_organizations` with their config
✅ **Flexible:** Each org can have different levels, badges, roles, colors
✅ **Maintainable:** Changes to one org's system don't affect others
✅ **Scalable:** Easy to add new organizations without schema changes
✅ **Future-Proof:** Ready for Scouting America, other organizations

---

## Implementation Phase 1: Girl Scouts (GSUSA)

### Step 1: Seed Girl Scout Organization & Configuration

```sql
-- Organization
INSERT INTO scout_organizations VALUES
(1, 'gsusa', 'Girl Scouts USA', 'girl_scouts', 'Official Girl Scouts of the USA',
 'https://www.girlscouts.org', 1, 1, 1, 1, 1, CURRENT_TIMESTAMP);

-- Level System: 6 Girl Scout Levels
INSERT INTO scout_levels VALUES
(1, 1, 'daisy', 'Daisy', 'K-1', '5-7', '#A0DEF1', 'Explore friendship and the world', 1, 1),
(2, 1, 'brownie', 'Brownie', '2-3', '7-9', '#763A16', 'Build skills and have fun', 2, 1),
(3, 1, 'junior', 'Junior', '4-5', '9-11', '#00B2BE', 'Lead and innovate', 3, 1),
(4, 1, 'cadette', 'Cadette', '6-8', '11-14', '#EE3124', 'Tackle real-world issues', 4, 1),
(5, 1, 'senior', 'Senior', '9-10', '14-16', '#FF7818', 'Global perspective', 5, 1),
(6, 1, 'ambassador', 'Ambassador', '11-12', '16-18', '#EE3124', 'Mentoring and legacy', 6, 1);

-- Color Palette: Official GSUSA Colors
INSERT INTO color_palettes VALUES
(1, 1, 'Girl Scout Official Colors', 'Official Girl Scouts of the USA color scheme', CURRENT_TIMESTAMP);

INSERT INTO color_definitions VALUES
(null, 1, 'daisy_blue', '#A0DEF1', 'rgb(160, 222, 241)', '--gs-daisy-blue'),
(null, 1, 'brownie_brown', '#763A16', 'rgb(118, 58, 22)', '--gs-brownie-brown'),
(null, 1, 'brownie_khaki', '#D5CA9F', 'rgb(213, 202, 159)', '--gs-brownie-khaki'),
(null, 1, 'junior_green', '#00B451', 'rgb(0, 180, 81)', '--gs-junior-green'),
(null, 1, 'cadette_red', '#EE3124', 'rgb(238, 49, 36)', '--gs-cadette-red'),
(null, 1, 'senior_orange', '#FF7818', 'rgb(255, 120, 24)', '--gs-senior-orange'),
(null, 1, 'volunteer_stone', '#A8A8A8', 'rgb(168, 168, 168)', '--gs-volunteer-stone');
```

### Step 2: Import Girl Scout Badge Catalogs

From available PDFs:
- **Daisy_GSUSA_BadgesAwardsAndPins.pdf** (4.7MB)
- **Brownie_GSUSA_BadgesAwardsAndPins.pdf** (5.0MB)
- **Junior_GSUSA_BadgesAwardsAndPins.pdf** (5.5MB)
- **Cadette_GSUSA_BadgesAwardsAndPins.pdf** (4.9MB)
- **Senior_GSUSA_BadgesAwardsAndPins.pdf** (5.4MB)
- **Ambassador_GSUSA_BadgesAwardsAndPins.pdf** (5.1MB)

Create import script to extract badge information from PDFs and populate `badges` table.

### Step 3: Define Girl Scout Leadership Roles

From Girl Scout Resources:
- Troop Leader / Co-Leader
- Troop Treasurer
- Troop Cookie Manager
- Service Unit Manager (SUM)
- Product Manager
- Recruiter/Registrar

```sql
INSERT INTO role_definition_sets VALUES
(1, 1, 'Girl Scout Leadership Roles', 'Standard Girl Scout troop and service unit roles', CURRENT_TIMESTAMP);

INSERT INTO leadership_roles VALUES
(null, 1, 'troop_leader', 'Troop Leader', 'Primary mentor guiding girls through program', 'adult', 21, 'Background check, training'),
(null, 1, 'troop_treasurer', 'Troop Treasurer', 'Oversees troop finances', 'adult', 18, 'Financial management experience'),
(null, 1, 'cookie_manager', 'Cookie Manager', 'Manages cookie sales logistics', 'adult', 18, 'Sales management experience');
```

### Step 4: Update Scout Profiles & Levels

Migrate existing scout users to organization-aware profiles:

```javascript
// Migration script concept
async function migrateGirlScoutsToPhase31() {
    // 1. Find all scout users in troops
    const scouts = await getScoutsInTroops();

    // 2. For each scout, create scout_profile with GSUSA org
    for (const scout of scouts) {
        const profile = {
            userId: scout.id,
            organizationId: 1,  // GSUSA
            troopId: scout.troopId,
            currentLevelId: mapLevelToGSUSA(scout.level),
            levelSince: scout.levelStartDate || new Date()
        };
        await createScoutProfile(profile);
    }
}
```

---

## Implementation Phase 2: Scouting America (Future Roadmap)

### Cub Scouts Program Setup

```sql
-- Organization: Scouting America - Cub Scouts
INSERT INTO scout_organizations VALUES
(2, 'sa_cub_scouts', 'Scouting America - Cub Scouts', 'scouting_america',
 'Cub Scouts program for grades K-5', 'https://www.scoutingamerica.org',
 2, 2, 2, 2, 1, CURRENT_TIMESTAMP);

-- Level System: 5 Cub Scout Ranks
INSERT INTO scout_levels VALUES
(7, 2, 'lion', 'Lion', 'K', '5-6', '#FFD700', 'New Scout rank for Kindergarteners', 1, 1),
(8, 2, 'tiger', 'Tiger', '1st', '6-7', '#FF7F50', 'First rank in Cub Scouts', 2, 1),
(9, 2, 'wolf', 'Wolf', '2nd', '7-8', '#696969', 'Building skills and confidence', 3, 1),
(10, 2, 'bear', 'Bear', '3rd', '8-9', '#8B4513', 'Growing as leaders', 4, 1),
(11, 2, 'webelos', 'Webelos', '4th', '9-10', '#FF1493', 'Bridging to Scouts BSA', 5, 1),
(12, 2, 'arrow_of_light', 'Arrow of Light', '5th', '10-11', '#1E90FF', 'Final Cub Scout rank', 6, 1);

-- Role Set: Cub Scout Leadership
INSERT INTO role_definition_sets VALUES
(2, 2, 'Cub Scout Leadership Roles', 'Cub Scout Den and Pack roles', CURRENT_TIMESTAMP);

INSERT INTO leadership_roles VALUES
(null, 2, 'den_leader', 'Den Leader', 'Leads a single-grade den', 'adult', 18, 'Training required'),
(null, 2, 'den_chief', 'Den Chief', 'Older scout helps den leader', 'youth', 10, 'Scout rank or higher'),
(null, 2, 'pack_leader', 'Pack Leader/Committee Chair', 'Oversees entire pack', 'adult', 21, 'Management experience');
```

### Scouts BSA Program Setup

```sql
-- Organization: Scouting America - Scouts BSA
INSERT INTO scout_organizations VALUES
(3, 'sa_bsa', 'Scouting America - Scouts BSA', 'scouting_america',
 'Scouts BSA program for ages 11-17', 'https://www.scoutingamerica.org',
 3, 3, 3, 2, 1, CURRENT_TIMESTAMP);

-- Level System: Scouts BSA Rank Progression
INSERT INTO scout_levels VALUES
(13, 3, 'scout', 'Scout', '6-12', '11-17', '#A52A2A', 'Entry rank', 1, 1),
(14, 3, 'tenderfoot', 'Tenderfoot', '6-12', '11-17', '#8B4513', 'Second rank', 2, 1),
(15, 3, 'second_class', 'Second Class', '6-12', '11-17', '#DAA520', 'Third rank', 3, 1),
(16, 3, 'first_class', 'First Class', '6-12', '11-17', '#FF6347', 'Fourth rank', 4, 1),
(17, 3, 'star', 'Star Scout', '6-12', '11-17', '#FF4500', 'Fifth rank', 5, 1),
(18, 3, 'life', 'Life Scout', '6-12', '11-17', '#228B22', 'Sixth rank', 6, 1),
(19, 3, 'eagle', 'Eagle Scout', '6-12', '11-17', '#1C1C1C', 'Highest rank', 7, 1);

-- Leadership Roles: 15+ youth and adult positions
INSERT INTO role_definition_sets VALUES
(3, 3, 'Scouts BSA Leadership Roles', 'Youth and adult leadership positions in Scouts BSA', CURRENT_TIMESTAMP);

INSERT INTO leadership_roles VALUES
(null, 3, 'spl', 'Senior Patrol Leader', 'Top youth leader elected by scouts', 'youth', 11, 'Scout rank'),
(null, 3, 'aspl', 'Assistant Senior Patrol Leader', 'Second-in-command youth leader', 'youth', 11, 'Scout rank'),
(null, 3, 'patrol_leader', 'Patrol Leader', 'Elected leader of a patrol', 'youth', 11, 'Scout rank'),
(null, 3, 'scoutmaster', 'Scoutmaster', 'Adult troop leader', 'adult', 21, 'BSA training'),
(null, 3, 'committee_chair', 'Committee Chair', 'Head of troop committee', 'adult', 21, 'Leadership experience');
```

---

## API Design: Organization-Aware Endpoints

### Get Organization Configuration
```
GET /api/organizations
GET /api/organizations/:orgCode
GET /api/organizations/:orgCode/levels
GET /api/organizations/:orgCode/badges
GET /api/organizations/:orgCode/roles
GET /api/organizations/:orgCode/colors
```

### Scout Profile (Organization-Specific)
```
GET    /api/scouts/:id?org=gsusa
GET    /api/scouts/:id/level?org=sa_cub_scouts
PUT    /api/scouts/:id/level?org=gsusa
GET    /api/scouts/:id/badges?org=gsusa
POST   /api/scouts/:id/badges?org=gsusa
```

### Leadership & Roles
```
GET    /api/troops/:tid/leaders?org=gsusa
POST   /api/troops/:tid/leaders/:sid/role?org=sa_bsa
GET    /api/scouts/:id/positions?org=gsusa
```

---

## Frontend Components: Organization-Aware

### Scout Profile Card
```javascript
// components/scout-profile-card.js
function renderScoutProfile(scout, organization) {
    const level = getLevelDetails(scout.currentLevelId, organization);
    const color = getOrganizationColor(organization, level.colorKey);

    return `
        <div class="scout-card" style="--card-color: ${color}">
            <div class="level-badge">${level.displayName}</div>
            <img src="${scout.photoUrl}" alt="${scout.firstName}">
            <h3>${scout.firstName} ${scout.lastName}</h3>
            <p>${organization.displayName}</p>
            <p>Joined: ${scout.levelSince}</p>
        </div>
    `;
}
```

### Level Selection (during registration/setup)
```javascript
// Show organization-specific levels during onboarding
async function showLevelSelection(organizationCode) {
    const org = await fetchOrganization(organizationCode);
    const levels = await fetchLevels(org.levelSystemId);

    // Render level selector with org-specific colors and info
    renderLevelSelector(levels, org.colorPalette);
}
```

### Badge Gallery (Organization-Specific)
```javascript
// Show badges applicable to scout's level and organization
async function showBadgeGallery(scoutId) {
    const scout = await fetchScoutProfile(scoutId);
    const org = await fetchOrganization(scout.organizationId);
    const badges = await fetchBadgesForLevel(scout.currentLevelId, org.id);

    // Render organization-specific badge catalog
    renderBadgeGallery(badges, org);
}
```

---

## Data Migration Strategy

### Step 1: Create Phase 3.1 Schema
Deploy new tables (scout_organizations, scout_levels, scout_profiles, etc.)

### Step 2: Seed Girl Scout Configuration
Insert GSUSA organization, levels, colors, roles from reference materials

### Step 3: Migrate Existing Scouts
For each scout user in current system:
1. Create scout_profile with GSUSA organization
2. Map current level to new scout_levels
3. Initialize empty badge/achievement arrays
4. Archive old level data

### Step 4: (Future) Scouting America
When ready to support SA:
1. Create SA organizations (Cub, BSA, Venturing, etc.)
2. Seed their level systems, badges, roles
3. Allow users to register under SA instead of GSUSA

---

## Testing Strategy: Organization-Aware

### Unit Tests
```javascript
// Test: Organization configuration loading
test('Load GSUSA configuration', async () => {
    const org = await getOrganization('gsusa');
    expect(org.id).toBe(1);
    expect(org.levels.length).toBe(6);
});

// Test: Organization-specific level mapping
test('Map scout to correct level for organization', async () => {
    const scout = await getScoutProfile(scoutId, 'gsusa');
    expect(scout.currentLevel.levelCode).toBe('daisy');
    expect(scout.currentLevel.displayName).toBe('Daisy');
});

// Test: Organization-specific badge awarding
test('Award Girl Scout badge', async () => {
    const badge = await awardBadge(scoutId, badgeId, 'gsusa');
    expect(badge.organization).toBe('gsusa');
    expect(badge.earnedDate).toBeDefined();
});
```

### Integration Tests
```javascript
// Test: End-to-end Girl Scout profile flow
test('Complete Girl Scout onboarding and badge earning', async () => {
    // 1. Register new user
    const user = await registerUser({ email, password });

    // 2. Create scout profile (GSUSA)
    const profile = await createScoutProfile(user.id, 'gsusa', troopId);
    expect(profile.organizationId).toBe(1);

    // 3. Set scout level (Daisy)
    await updateScoutLevel(profile.id, 'daisy');

    // 4. Award badge
    const badge = await awardBadge(profile.id, 'first-aid-badge');
    expect(badge.earnedDate).toBeDefined();

    // 5. Verify in profile
    const updated = await getScoutProfile(profile.id);
    expect(updated.badges.length).toBe(1);
});
```

---

## Risk Mitigation

### Technical Risks

**Risk:** Complex multi-organization schema
**Mitigation:**
- Start with GSUSA only (Phase 3.1)
- Defer multi-org support until Phase 3.2
- Test with Girl Scout data before building Scouting America support

**Risk:** Data migration complexity
**Mitigation:**
- Backup production data
- Test migration script on staging environment
- Provide rollback plan

**Risk:** Breaking existing Girl Scout functionality
**Mitigation:**
- Maintain backward compatibility during transition
- Keep old schema alongside new for 2 versions
- Gradual rollout (opt-in initially)

### Business Risks

**Risk:** Organization standards change (e.g., GSUSA updates badge list)
**Mitigation:**
- Design for easy badge import/update
- Create admin tools for badge management
- Document versioning strategy (2025-26, 2026-27, etc.)

**Risk:** Future organizations not fitting current model
**Mitigation:**
- Review model with Scouting America before Phase 3.2
- Plan for extensibility (custom fields, plugins)
- Document assumptions clearly

---

## Reference Material Usage Timeline

### Phase 3.1 (Girl Scouts Implementation)
- ✅ Girl Scout organization structure
- ✅ 6-level system
- ✅ Badge catalogs (extract from PDFs)
- ✅ Official colors (from Resources)
- ✅ Troop roles (from Resources)
- ✅ Cookie program details (from Goal Getter Card)

### Phase 3.2 (Scouting America Prep)
- ⏳ Review Scouting America resources
- ⏳ Validate schema extensibility
- ⏳ Plan Cub Scout rank mapping
- ⏳ Plan Scouts BSA rank and merit badge support

### Phase 3.3+ (Future Organizations)
- ⏳ International Girl Guides
- ⏳ Royal Rangers
- ⏳ Other regional programs

---

## Implementation Checklist

### Database & Schema
- [ ] Create scout_organizations table
- [ ] Create level_systems table
- [ ] Create scout_levels table
- [ ] Create badge_catalogs table
- [ ] Create badges table (organization-aware)
- [ ] Create role_definition_sets table
- [ ] Create leadership_roles table
- [ ] Create color_palettes table
- [ ] Update scout_profiles with organizationId
- [ ] Create indexes for performance

### Girl Scout Configuration
- [ ] Seed GSUSA organization record
- [ ] Insert 6 Girl Scout levels with official details
- [ ] Create color palette with official GSUSA colors
- [ ] Define Girl Scout leadership roles
- [ ] Import badge catalogs from PDFs

### Data Migration
- [ ] Create migration script
- [ ] Test on staging environment
- [ ] Backup production database
- [ ] Run migration on production
- [ ] Verify data integrity
- [ ] Archive old schema (keep for 2 versions)

### API Implementation
- [ ] Create /api/organizations endpoints
- [ ] Create organization-aware /api/scouts endpoints
- [ ] Create /api/badges endpoints (org-specific)
- [ ] Create /api/levels endpoints (org-specific)
- [ ] Add organization parameter to existing endpoints

### Frontend Updates
- [ ] Update scout profile to show organization/level
- [ ] Create organization-aware level selector
- [ ] Create organization-specific badge gallery
- [ ] Update color system to use org colors
- [ ] Update role display to show org-specific positions

### Testing
- [ ] Unit tests for organization configuration
- [ ] Integration tests for Girl Scout profile flow
- [ ] Data migration validation tests
- [ ] Performance tests for multi-org queries
- [ ] Browser compatibility testing

### Documentation
- [ ] Document organization configuration process
- [ ] Document API endpoints for each org
- [ ] Create admin guide for managing organizations
- [ ] Document Scouting America integration plan
- [ ] Create developer guide for adding new organizations

---

## Success Criteria

✅ Girl Scout profiles work identically to current system
✅ Scout levels show official GSUSA colors and names
✅ Badge awards work with GSUSA badge catalog
✅ Data migration completes without data loss
✅ API supports future organization types
✅ Frontend displays organization information correctly
✅ Performance metrics unchanged after migration
✅ No breaking changes to existing functionality

---

## Next Phase: Phase 3.2

After Phase 3.1 completes Girl Scout support, Phase 3.2 will:
- Review Scouting America integration feasibility
- Plan Cub Scout rank system
- Plan Scouts BSA merit badge system
- Extend schema for multi-program support
- Prepare for Scouting America deployment

---

## Document History

**Version:** 1.0
**Created:** 2026-02-09
**Based on:** PHASE_3.1_SCOUT_PROFILE_MANAGEMENT.md + Reference Materials
**Status:** Planning Phase - Ready for Implementation Planning

---

## References

### Girl Scout Resources
- Girl Scouts of the USA organization structure (Resources for Girlscouts.md)
- Official Girl Scout color codes and branding
- 6-level progression system (K-1 through 11-12)
- Badge and awards PDFs for each level
- 2025-26 Goal Getter and Booth Inventory materials
- Troop leadership roles and responsibilities

### Scouting America Resources
- Scouting America program structure (5 programs)
- Cub Scout rank system (Lion through Arrow of Light)
- Scouts BSA rank progression (Scout through Eagle)
- Leadership positions (youth and adult)
- Official Scouting America branding
- Merit badge and advancement frameworks

### Phase Documentation
- PHASE_3.1_SCOUT_PROFILE_MANAGEMENT.md
- PHASE_3_TROOP_MANAGEMENT.md
- PHASE_1_FOUNDATION.md
- PHASE_2_COMPLIANCE_SECURITY.md
