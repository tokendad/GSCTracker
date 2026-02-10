#!/usr/bin/env node

/**
 * Seed Scouts BSA Organization Data
 *
 * Populates:
 * - Scouts BSA organization (Scouting America)
 * - 7 Scouts BSA ranks (Scout through Eagle Scout)
 * - Official Scouts BSA colors
 * - Leadership position definitions
 * - Initial merit badge catalog structure
 *
 * Usage: node migrations/seed-scouts-bsa.js
 */

require('dotenv').config();
const db = require('../database/query-helpers');
const logger = require('../logger');

async function seedScoutsBSA() {
    logger.info('Starting Scouts BSA organization seed');

    try {
        // 1. Create Scouts BSA Organization
        const org = await db.getOne(`
            INSERT INTO scout_organizations ("orgCode", "orgName", "orgType", description, "websiteUrl")
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT ("orgCode") DO UPDATE SET
                "orgName" = EXCLUDED."orgName",
                "updatedAt" = CURRENT_TIMESTAMP
            RETURNING *
        `, ['sa_bsa', 'Scouting America - Scouts BSA', 'scouting_america',
            'Official Boy Scouts of America (Scouts BSA) - Scouting America',
            'https://www.scouting.org/programs/scouts-bsa/']);

        logger.info('Scouts BSA organization created/updated', { orgId: org.id, orgCode: org.orgCode });

        // 2. Create Level System
        const levelSystem = await db.getOne(`
            INSERT INTO level_systems ("organizationId", "systemName", description)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [org.id, 'Scouts BSA Ranks', '7-rank progression from Scout to Eagle Scout']);

        logger.info('Level system created', { levelSystemId: levelSystem.id });

        // 3. Create 7 Scouts BSA Ranks
        const levels = [
            {
                code: 'scout',
                name: 'Scout',
                grades: '6-12',
                ages: '11+',
                color: '#A52A2A',
                desc: 'Entry level Scouts BSA rank',
                order: 1
            },
            {
                code: 'tenderfoot',
                name: 'Tenderfoot',
                grades: '6-12',
                ages: '11+',
                color: '#8B4513',
                desc: 'Build basic Scouting skills',
                order: 2
            },
            {
                code: 'second_class',
                name: 'Second Class',
                grades: '6-12',
                ages: '11+',
                color: '#DAA520',
                desc: 'Develop camping and outdoor skills',
                order: 3
            },
            {
                code: 'first_class',
                name: 'First Class',
                grades: '6-12',
                ages: '11+',
                color: '#FF6347',
                desc: 'Master fundamentals of Scouting',
                order: 4
            },
            {
                code: 'star_scout',
                name: 'Star Scout',
                grades: '6-12',
                ages: '11+',
                color: '#FF4500',
                desc: 'Advanced scout leadership skills',
                order: 5
            },
            {
                code: 'life_scout',
                name: 'Life Scout',
                grades: '6-12',
                ages: '11+',
                color: '#228B22',
                desc: 'High level of leadership and service',
                order: 6
            },
            {
                code: 'eagle_scout',
                name: 'Eagle Scout',
                grades: '6-12',
                ages: '11+',
                color: '#1C1C1C',
                desc: 'Highest rank in Scouts BSA',
                order: 7
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

        logger.info('Scouts BSA ranks created', { count: levelCount });

        // 4. Create Color Palette
        const palette = await db.getOne(`
            INSERT INTO color_palettes ("organizationId", "paletteName", description)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
            RETURNING *
        `, [org.id, 'Scouts BSA Official Colors', 'Official Scouting America Scouts BSA rank and brand colors']);

        if (!palette) {
            // If it already exists, get it
            const existing = await db.getOne(`
                SELECT * FROM color_palettes
                WHERE "organizationId" = $1 AND "paletteName" = $2
            `, [org.id, 'Scouts BSA Official Colors']);

            // Use the existing palette ID for color definitions
            if (existing) {
                seedColors(existing.id, org.id);
            }
        } else {
            seedColors(palette.id, org.id);
        }

        async function seedColors(paletteId, orgId) {
            const colors = [
                { name: 'scout_brown', hex: '#A52A2A', rgb: 'rgb(165, 42, 42)', css: '--bsa-scout-brown' },
                { name: 'tenderfoot_saddle', hex: '#8B4513', rgb: 'rgb(139, 69, 19)', css: '--bsa-tenderfoot-saddle' },
                { name: 'second_class_gold', hex: '#DAA520', rgb: 'rgb(218, 165, 32)', css: '--bsa-second-gold' },
                { name: 'first_class_red', hex: '#FF6347', rgb: 'rgb(255, 99, 71)', css: '--bsa-first-red' },
                { name: 'star_orange', hex: '#FF4500', rgb: 'rgb(255, 69, 0)', css: '--bsa-star-orange' },
                { name: 'life_green', hex: '#228B22', rgb: 'rgb(34, 139, 34)', css: '--bsa-life-green' },
                { name: 'eagle_black', hex: '#1C1C1C', rgb: 'rgb(28, 28, 28)', css: '--bsa-eagle-black' },
                { name: 'scouts_blue', hex: '#003DA5', rgb: 'rgb(0, 61, 165)', css: '--bsa-scouts-blue' }
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

            logger.info('Scouts BSA colors created', { count: colorCount });
        }

        // 5. Create Role Definition Set
        const roleSet = await db.getOne(`
            INSERT INTO role_definition_sets ("organizationId", "setName", description)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
            RETURNING *
        `, [org.id, 'Scouts BSA Leadership Positions', 'Standard Scouts BSA patrol and troop leadership positions']);

        let roleSetId = roleSet?.id;
        if (!roleSetId) {
            const existing = await db.getOne(`
                SELECT id FROM role_definition_sets
                WHERE "organizationId" = $1 AND "setName" = $2
            `, [org.id, 'Scouts BSA Leadership Positions']);
            roleSetId = existing?.id;
        }

        const roles = [
            { code: 'senior_patrol_leader', name: 'Senior Patrol Leader (SPL)', type: 'youth', minAge: 11, desc: 'Chief youth leader of the troop' },
            { code: 'assistant_spl', name: 'Assistant Senior Patrol Leader (ASPL)', type: 'youth', minAge: 11, desc: 'Assists Senior Patrol Leader' },
            { code: 'patrol_leader', name: 'Patrol Leader', type: 'youth', minAge: 11, desc: 'Leader of individual patrol' },
            { code: 'scribe', name: 'Scribe', type: 'youth', minAge: 11, desc: 'Records patrol and troop activities' },
            { code: 'quartermaster', name: 'Quartermaster', type: 'youth', minAge: 11, desc: 'Manages equipment and supplies' },
            { code: 'scoutmaster', name: 'Scoutmaster', type: 'adult', minAge: 21, desc: 'Adult leader responsible for troop' },
            { code: 'assistant_scoutmaster', name: 'Assistant Scoutmaster', type: 'adult', minAge: 18, desc: 'Assists Scoutmaster' },
            { code: 'committee_chair', name: 'Troop Committee Chair', type: 'adult', minAge: 21, desc: 'Oversees troop operations and logistics' }
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

        logger.info('Scouts BSA leadership positions created', { count: roleCount });

        // 6. Create Merit Badge Catalog (placeholder - badges imported later)
        const catalog = await db.getOne(`
            INSERT INTO badge_catalogs ("organizationId", "catalogName", "catalogYear", description)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT DO NOTHING
            RETURNING *
        `, [org.id, 'Scouts BSA Merit Badges 2025-26', '2025-26', 'Official Scouts BSA merit badges for 2025-26 program year']);

        if (catalog) {
            logger.info('Merit badge catalog created', { catalogId: catalog.id });
        } else {
            logger.info('Merit badge catalog already exists');
        }

        logger.info('✅ Scouts BSA organization seed completed successfully');
        logger.info('Note: Merit badge details imported from official guides in future implementation');

    } catch (error) {
        logger.error('❌ Error seeding Scouts BSA organization', { error: error.message, stack: error.stack });
        throw error;
    } finally {
        await db.close();
    }
}

// Run if called directly
if (require.main === module) {
    seedScoutsBSA()
        .then(() => {
            console.log('✅ Scouts BSA seed completed');
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Seed failed:', err.message);
            process.exit(1);
        });
}

module.exports = { seedScoutsBSA };
