const pool = require('./pg-pool');
const logger = require('../logger');

/**
 * Execute a single query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params = []) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;

        if (duration > 1000) {
            logger.warn('Slow query detected', {
                text: text.substring(0, 100),
                duration,
                rowCount: result.rowCount
            });
        } else {
            logger.debug('Query executed', {
                text: text.substring(0, 100),
                duration,
                rowCount: result.rowCount
            });
        }

        return result;
    } catch (error) {
        logger.error('Query error', {
            text: text.substring(0, 100),
            params: JSON.stringify(params).substring(0, 100),
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * Get a single row (equivalent to SQLite .get())
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|null>} First row or null
 */
async function getOne(text, params = []) {
    const result = await query(text, params);
    return result.rows[0] || null;
}

/**
 * Get all rows (equivalent to SQLite .all())
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Array of rows
 */
async function getAll(text, params = []) {
    const result = await query(text, params);
    return result.rows;
}

/**
 * Execute a query and return row count
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<number>} Number of affected rows
 */
async function run(text, params = []) {
    const result = await query(text, params);
    return result.rowCount;
}

/**
 * Execute with transaction
 * @param {Function} callback - Callback function receiving client
 * @returns {Promise<any>} Result from callback
 */
async function transaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        logger.debug('Transaction started');

        const result = await callback(client);

        await client.query('COMMIT');
        logger.debug('Transaction committed');

        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Transaction rolled back', { error: error.message });
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connected
 */
async function testConnection() {
    try {
        const result = await query('SELECT NOW() as current_time, version() as pg_version');
        logger.info('PostgreSQL connection test successful', {
            time: result.rows[0].current_time,
            version: result.rows[0].pg_version.split(' ')[1]
        });
        return true;
    } catch (error) {
        logger.error('PostgreSQL connection test failed', { error: error.message });
        return false;
    }
}

/**
 * Close the database pool
 * @returns {Promise<void>}
 */
async function close() {
    await pool.end();
}

module.exports = {
    query,
    getOne,
    getAll,
    run,
    transaction,
    testConnection,
    close,
    pool
};
