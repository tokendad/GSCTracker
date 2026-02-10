#!/usr/bin/env node

/**
 * Seed Girl Scouts USA Organization Data
 *
 * Populates:
 * - GSUSA organization record
 * - 6 Girl Scout levels (Daisy through Ambassador)
 * - Official GSUSA colors
 * - Leadership role definitions
 * - Initial badge catalog structure (badge import deferred)
 *
 * Usage: node migrations/seed-gsusa-organization.js
 */

require('dotenv').config();
const db = require('../database/query-helpers');
const logger = require('../logger');

async function seedGSUSA() {
    logger.info('Starting GSUSA organization seed');

    try {
        // 1. Create GSUSA Organization
        const org = await db.getOne(`
            INSERT INTO scout_organizations ("orgCode", "orgName", "orgType", description, "websiteUrl")
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT ("orgCode") DO UPDATE SET
                "orgName" = EXCLUDED."orgName",
                "updatedAt" = CURRENT_TIMESTAMP
            RETURNING *
        `, ['gsusa', 'Girl Scouts USA', 'girl_scouts',
            'Official Girl Scouts of the USA',
            'https://www.girlscouts.org']);

        logger.info('GSUSA organization created/updated', { orgId: org.id, orgCode: org.orgCode });

        // 2. Create Level System
        const levelSystem = await db.getOne(`
            INSERT INTO level_systems ("organizationId", "systemName", description)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [org.id, 'Girl Scout Levels', '6-level progression from Daisy (K-1) to Ambassador (11-12)']);

        logger.info('Level system created', { levelSystemId: levelSystem.id });

        // 3. Create 6 Girl Scout Levels
        const levels = [
            {
                code: 'daisy',
                name: 'Daisy',
                grades: 'K-1',
                ages: '5-7',
                color: '#A0DEF1',
                desc: 'Explore friendship and the world',
                order: 1
            },
            {
                code: 'brownie',
                name: 'Brownie',
                grades: '2-3',
                ages: '7-9',
                color: '#763A16',
                desc: 'Build skills and have fun',
                order: 2
            },
            {
                code: 'junior',
                name: 'Junior',
                grades: '4-5',
                ages: '9-11',
                color: '#00B2BE',
                desc: 'Lead and innovate',
                order: 3
            },
            {
                code: 'cadette',
                name: 'Cadette',
                grades: '6-8',
                ages: '11-14',
                color: '#EE3124',
                desc: 'Tackle real-world issues',
                order: 4
            },
            {
                code: 'senior',
                name: 'Senior',
                grades: '9-10',
                ages: '14-16',
                color: '#FF7818',
                desc: 'Global perspective',
                order: 5
            },
            {
                code: 'ambassador',
                name: 'Ambassador',
                grades: '11-12',
                ages: '16-18',
                color: '#EE3124',
                desc: 'Mentoring and legacy',
                order: 6
            }
        ];

        let levelCount = 0;
        for (const level of levels) {
            await db.run(`
                INSERT INTO scout_levels (
                    "levelSystemId", "levelCode", "displayName", "gradeRange",
                    "ageRange", "uniformColor", description, "sortOrder"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT ("levelSystemId", "levelCode") DO NOTHING
            `, [levelSystem.id, level.code, level.name, level.grades,
                level.ages, level.color, level.desc, level.order]);
            levelCount++;
        }

        logger.info('Girl Scout levels created', { count: levelCount });

        // 4. Create Color Palette
        const palette = await db.getOne(`
            INSERT INTO color_palettes ("organizationId", "paletteName", description)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
            RETURNING *
        `, [org.id, 'Girl Scout Official Colors', 'Official GSUSA level and brand colors']);

        if (!palette) {
            // If it already exists, get it
            const existing = await db.getOne(`
                SELECT * FROM color_palettes
                WHERE "organizationId" = $1 AND "paletteName" = $2
            `, [org.id, 'Girl Scout Official Colors']);

            // Use the existing palette ID for color definitions
            if (existing) {
                seedColors(existing.id, org.id);
            }
        } else {
            seedColors(palette.id, org.id);
        }

        async function seedColors(paletteId, orgId) {
            const colors = [
                { name: 'daisy_blue', hex: '#A0DEF1', rgb: 'rgb(160, 222, 241)', css: '--gs-daisy-blue' },
                { name: 'brownie_brown', hex: '#763A16', rgb: 'rgb(118, 58, 22)', css: '--gs-brownie-brown' },
                { name: 'brownie_khaki', hex: '#D5CA9F', rgb: 'rgb(213, 202, 159)', css: '--gs-brownie-khaki' },
                { name: 'junior_green', hex: '#00B451', rgb: 'rgb(0, 180, 81)', css: '--gs-junior-green' },
                { name: 'cadette_red', hex: '#EE3124', rgb: 'rgb(238, 49, 36)', css: '--gs-cadette-red' },
                { name: 'senior_orange', hex: '#FF7818', rgb: 'rgb(255, 120, 24)', css: '--gs-senior-orange' },
                { name: 'volunteer_stone', hex: '#A8A8A8', rgb: 'rgb(168, 168, 168)', css: '--gs-volunteer-stone' }
            ];

            let colorCount = 0;
            for (const color of colors) {
                await db.run(`
                    INSERT INTO color_definitions (
                        "paletteId", "colorName", "hexValue", "rgbValue", "cssVariable"
                    ) VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT DO NOTHING
                `, [paletteId, color.name, color.hex, color.rgb, color.css]);
                colorCount++;
            }

            logger.info('GSUSA colors created', { count: colorCount });
        }

        // 5. Create Role Definition Set
        const roleSet = await db.getOne(`
            INSERT INTO role_definition_sets ("organizationId", "setName", description)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
            RETURNING *
        `, [org.id, 'Girl Scout Leadership Roles', 'Standard Girl Scout troop and service unit roles']);

        let roleSetId = roleSet?.id;
        if (!roleSetId) {
            const existing = await db.getOne(`
                SELECT id FROM role_definition_sets
                WHERE "organizationId" = $1 AND "setName" = $2
            `, [org.id, 'Girl Scout Leadership Roles']);
            roleSetId = existing?.id;
        }

        const roles = [
            { code: 'troop_leader', name: 'Troop Leader', type: 'adult', minAge: 21, desc: 'Primary mentor guiding girls through program' },
            { code: 'troop_co_leader', name: 'Troop Co-Leader', type: 'adult', minAge: 21, desc: 'Assists primary leader' },
            { code: 'troop_treasurer', name: 'Troop Treasurer', type: 'adult', minAge: 18, desc: 'Oversees troop finances' },
            { code: 'cookie_manager', name: 'Cookie Manager', type: 'adult', minAge: 18, desc: 'Manages cookie sales logistics' },
            { code: 'service_unit_manager', name: 'Service Unit Manager', type: 'adult', minAge: 21, desc: 'Oversees multiple troops in service unit' }
        ];

        let roleCount = 0;
        for (const role of roles) {
            await db.run(`
                INSERT INTO leadership_roles (
                    "roleSetId", "roleCode", "displayName", "roleType", "minAge", description
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT DO NOTHING
            `, [roleSetId, role.code, role.name, role.type, role.minAge, role.desc]);
            roleCount++;
        }

        logger.info('GSUSA leadership roles created', { count: roleCount });

        // 6. Create Badge Catalog (placeholder - badges imported later)
        const catalog = await db.getOne(`
            INSERT INTO badge_catalogs ("organizationId", "catalogName", "catalogYear", description)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT DO NOTHING
            RETURNING *
        `, [org.id, 'GSUSA 2025-26', '2025-26', 'Official Girl Scout badges for 2025-26 program year']);

        if (catalog) {
            logger.info('Badge catalog created', { catalogId: catalog.id });
        } else {
            logger.info('Badge catalog already exists');
        }

        logger.info('✅ GSUSA organization seed completed successfully');
        logger.info('Note: Badge import from PDFs deferred to future implementation');

    } catch (error) {
        logger.error('❌ Error seeding GSUSA organization', { error: error.message, stack: error.stack });
        throw error;
    } finally {
        await db.close();
    }
}

// Run if called directly
if (require.main === module) {
    seedGSUSA()
        .then(() => {
            console.log('✅ GSUSA seed completed');
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Seed failed:', err.message);
            process.exit(1);
        });
}

module.exports = { seedGSUSA };
