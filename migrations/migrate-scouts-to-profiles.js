#!/usr/bin/env node

/**
 * Migrate Existing Scouts to scout_profiles
 *
 * Migrates:
 * - All users with role='scout' → scout_profiles
 * - Maps troop_members.scoutLevel → scout_levels.levelCode
 * - Links to GSUSA organization
 * - Updates troops.organizationId to GSUSA
 *
 * Usage: node migrations/migrate-scouts-to-profiles.js
 */

require('dotenv').config();
const db = require('../database/query-helpers');
const logger = require('../logger');

async function migrateScouts() {
    logger.info('Starting scout profile migration...');

    try {
        // 1. Get GSUSA organization
        const gsusa = await db.getOne(`
            SELECT id FROM scout_organizations WHERE "orgCode" = $1
        `, ['gsusa']);

        if (!gsusa) {
            throw new Error('GSUSA organization not found. Run seed-gsusa-organization.js first.');
        }

        logger.info('Found GSUSA organization', { orgId: gsusa.id });

        // 2. Get all scouts in troops
        const scoutsInTroops = await db.getAll(`
            SELECT DISTINCT
                tm."userId",
                tm."troopId",
                tm."scoutLevel",
                u."firstName",
                u."lastName"
            FROM troop_members tm
            JOIN users u ON u.id = tm."userId"
            WHERE u.role = $1
              AND tm.status = $2
            ORDER BY tm."troopId", u."firstName"
        `, ['scout', 'active']);

        logger.info(`Found ${scoutsInTroops.length} active scouts to migrate`);

        // 3. Level mapping (lowercase from DB → levelCode)
        const levelMapping = {
            'daisy': 'daisy',
            'brownie': 'brownie',
            'junior': 'junior',
            'cadette': 'cadette',
            'senior': 'senior',
            'ambassador': 'ambassador'
        };

        let migratedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        // 4. Migrate each scout
        for (const scout of scoutsInTroops) {
            try {
                // Check if profile already exists
                const existing = await db.getOne(`
                    SELECT id FROM scout_profiles WHERE "userId" = $1
                `, [scout.userId]);

                if (existing) {
                    logger.debug('Scout profile already exists, skipping', { userId: scout.userId });
                    skippedCount++;
                    continue;
                }

                // Map scout level to scout_levels.id
                let currentLevelId = null;
                if (scout.scoutLevel) {
                    const levelCode = levelMapping[scout.scoutLevel.toLowerCase()];
                    if (levelCode) {
                        const level = await db.getOne(`
                            SELECT sl.id
                            FROM scout_levels sl
                            JOIN level_systems ls ON ls.id = sl."levelSystemId"
                            JOIN scout_organizations so ON so.id = ls."organizationId"
                            WHERE so."orgCode" = $1 AND sl."levelCode" = $2
                        `, ['gsusa', levelCode]);

                        if (level) {
                            currentLevelId = level.id;
                        } else {
                            logger.warn('Level not found for scout', {
                                userId: scout.userId,
                                scoutLevel: scout.scoutLevel,
                                mappedCode: levelCode
                            });
                        }
                    }
                }

                // Create scout profile
                await db.run(`
                    INSERT INTO scout_profiles (
                        "userId", "organizationId", "troopId", "currentLevelId",
                        "levelSince", status
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    scout.userId,
                    gsusa.id,
                    scout.troopId,
                    currentLevelId,
                    new Date().toISOString().split('T')[0], // Current date (YYYY-MM-DD)
                    'active'
                ]);

                migratedCount++;
                logger.debug('Scout profile created', {
                    userId: scout.userId,
                    name: `${scout.firstName} ${scout.lastName}`,
                    level: scout.scoutLevel || 'none'
                });

            } catch (error) {
                errorCount++;
                logger.error('Error migrating scout', {
                    userId: scout.userId,
                    error: error.message
                });
            }
        }

        logger.info('Scout profile migration completed', {
            migrated: migratedCount,
            skipped: skippedCount,
            errors: errorCount,
            total: scoutsInTroops.length
        });

        // 5. Update existing Girl Scout troops to link to GSUSA
        const updateResult = await db.run(`
            UPDATE troops
            SET "organizationId" = $1,
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "organizationId" IS NULL
              AND "troopType" IN ('daisy', 'brownie', 'junior', 'cadette', 'senior', 'ambassador', 'multi-level')
        `, [gsusa.id]);

        logger.info(`Updated ${updateResult} Girl Scout troops with GSUSA organization`);

        // 6. Summary
        if (errorCount === 0) {
            logger.info('✅ Scout migration completed successfully');
        } else {
            logger.warn(`⚠️ Scout migration completed with ${errorCount} errors`);
        }

    } catch (error) {
        logger.error('❌ Error migrating scouts', { error: error.message, stack: error.stack });
        throw error;
    } finally {
        await db.close();
    }
}

// Run if called directly
if (require.main === module) {
    migrateScouts()
        .then(() => {
            console.log('✅ Migration completed');
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Migration failed:', err.message);
            process.exit(1);
        });
}

module.exports = { migrateScouts };
