#!/usr/bin/env node

/**
 * Seed Cub Scouts Organization Data
 *
 * Populates:
 * - Cub Scouts organization (Scouting America)
 * - 6 Cub Scout ranks (Lion through Arrow of Light)
 * - Official Cub Scout colors
 * - Leadership role definitions
 * - Initial adventure catalog structure
 *
 * Usage: node migrations/seed-cub-scouts.js
 */

require('dotenv').config();
const db = require('../database/query-helpers');
const logger = require('../logger');

async function seedCubScouts() {
    logger.info('Starting Cub Scouts organization seed');

    try {
        // 1. Create Cub Scouts Organization
        const org = await db.getOne(`
            INSERT INTO scout_organizations ("orgCode", "orgName", "orgType", description, "websiteUrl")
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT ("orgCode") DO UPDATE SET
                "orgName" = EXCLUDED."orgName",
                "updatedAt" = CURRENT_TIMESTAMP
            RETURNING *
        `, ['sa_cub', 'Scouting America - Cub Scouts', 'scouting_america',
            'Official Cub Scouts of Scouting America',
            'https://www.scouting.org/programs/cub-scouts/']);

        logger.info('Cub Scouts organization created/updated', { orgId: org.id, orgCode: org.orgCode });

        // 2. Create Level System
        const levelSystem = await db.getOne(`
            INSERT INTO level_systems ("organizationId", "systemName", description)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [org.id, 'Cub Scout Ranks', '6-rank progression from Lion (K) to Arrow of Light (5th grade)']);

        logger.info('Level system created', { levelSystemId: levelSystem.id });

        // 3. Create 6 Cub Scout Ranks
        const levels = [
            {
                code: 'lion',
                name: 'Lion',
                grades: 'K',
                ages: '5-6',
                color: '#FFD700',
                desc: 'Adventure and discovery for kindergarteners',
                order: 1
            },
            {
                code: 'tiger',
                name: 'Tiger',
                grades: '1',
                ages: '6-7',
                color: '#FF7F50',
                desc: 'Tigers explore and roar into Scouting',
                order: 2
            },
            {
                code: 'wolf',
                name: 'Wolf',
                grades: '2',
                ages: '7-8',
                color: '#696969',
                desc: 'Wolves run and explore their community',
                order: 3
            },
            {
                code: 'bear',
                name: 'Bear',
                grades: '3',
                ages: '8-9',
                color: '#8B4513',
                desc: 'Bears build skills and friendships',
                order: 4
            },
            {
                code: 'webelos',
                name: 'Webelos',
                grades: '4',
                ages: '9-10',
                color: '#FF1493',
                desc: 'We\'ll Be Loyal Scouts prepare for Boy Scouts',
                order: 5
            },
            {
                code: 'arrow_of_light',
                name: 'Arrow of Light',
                grades: '5',
                ages: '10-11',
                color: '#1E90FF',
                desc: 'Highest rank before transitioning to Boy Scouts',
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

        logger.info('Cub Scout ranks created', { count: levelCount });

        // 4. Create Color Palette
        const palette = await db.getOne(`
            INSERT INTO color_palettes ("organizationId", "paletteName", description)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
            RETURNING *
        `, [org.id, 'Cub Scout Official Colors', 'Official Scouting America Cub Scout rank and brand colors']);

        if (!palette) {
            // If it already exists, get it
            const existing = await db.getOne(`
                SELECT * FROM color_palettes
                WHERE "organizationId" = $1 AND "paletteName" = $2
            `, [org.id, 'Cub Scout Official Colors']);

            // Use the existing palette ID for color definitions
            if (existing) {
                seedColors(existing.id, org.id);
            }
        } else {
            seedColors(palette.id, org.id);
        }

        async function seedColors(paletteId, orgId) {
            const colors = [
                { name: 'lion_gold', hex: '#FFD700', rgb: 'rgb(255, 215, 0)', css: '--cs-lion-gold' },
                { name: 'tiger_coral', hex: '#FF7F50', rgb: 'rgb(255, 127, 80)', css: '--cs-tiger-coral' },
                { name: 'wolf_gray', hex: '#696969', rgb: 'rgb(105, 105, 105)', css: '--cs-wolf-gray' },
                { name: 'bear_brown', hex: '#8B4513', rgb: 'rgb(139, 69, 19)', css: '--cs-bear-brown' },
                { name: 'webelos_pink', hex: '#FF1493', rgb: 'rgb(255, 20, 147)', css: '--cs-webelos-pink' },
                { name: 'arrow_blue', hex: '#1E90FF', rgb: 'rgb(30, 144, 255)', css: '--cs-arrow-blue' },
                { name: 'cub_scout_blue', hex: '#003DA5', rgb: 'rgb(0, 61, 165)', css: '--cs-scout-blue' }
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

            logger.info('Cub Scout colors created', { count: colorCount });
        }

        // 5. Create Role Definition Set
        const roleSet = await db.getOne(`
            INSERT INTO role_definition_sets ("organizationId", "setName", description)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
            RETURNING *
        `, [org.id, 'Cub Scout Leadership Roles', 'Standard Cub Scout pack and den leadership roles']);

        let roleSetId = roleSet?.id;
        if (!roleSetId) {
            const existing = await db.getOne(`
                SELECT id FROM role_definition_sets
                WHERE "organizationId" = $1 AND "setName" = $2
            `, [org.id, 'Cub Scout Leadership Roles']);
            roleSetId = existing?.id;
        }

        const roles = [
            { code: 'den_leader', name: 'Den Leader', type: 'adult', minAge: 21, desc: 'Primary leader of Cub Scout den' },
            { code: 'den_assistant', name: 'Den Assistant', type: 'adult', minAge: 18, desc: 'Assists den leader' },
            { code: 'den_chief', name: 'Den Chief', type: 'youth', minAge: 10, desc: 'Youth leader assisting with den meetings' },
            { code: 'cubmaster', name: 'Cubmaster', type: 'adult', minAge: 21, desc: 'Leader of the Cub Scout pack' },
            { code: 'pack_committee_chair', name: 'Pack Committee Chair', type: 'adult', minAge: 21, desc: 'Manages pack operations and logistics' }
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

        logger.info('Cub Scout leadership roles created', { count: roleCount });

        // 6. Create Adventure Catalog (placeholder - adventures imported later)
        const catalog = await db.getOne(`
            INSERT INTO badge_catalogs ("organizationId", "catalogName", "catalogYear", description)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT DO NOTHING
            RETURNING *
        `, [org.id, 'Cub Scout Adventures 2025-26', '2025-26', 'Official Cub Scout adventures for 2025-26 program year']);

        if (catalog) {
            logger.info('Adventure catalog created', { catalogId: catalog.id });
        } else {
            logger.info('Adventure catalog already exists');
        }

        logger.info('✅ Cub Scouts organization seed completed successfully');
        logger.info('Note: Adventure details imported from official guides in future implementation');

    } catch (error) {
        logger.error('❌ Error seeding Cub Scouts organization', { error: error.message, stack: error.stack });
        throw error;
    } finally {
        await db.close();
    }
}

// Run if called directly
if (require.main === module) {
    seedCubScouts()
        .then(() => {
            console.log('✅ Cub Scouts seed completed');
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Seed failed:', err.message);
            process.exit(1);
        });
}

module.exports = { seedCubScouts };
