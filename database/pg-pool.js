const { Pool } = require('pg');
const logger = require('../logger');

// Create PostgreSQL connection pool
const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT) || 5432,
    database: process.env.POSTGRES_DB || 'apex_scout_manager',
    user: process.env.POSTGRES_USER || 'asm_user',
    password: process.env.POSTGRES_PASSWORD,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    min: parseInt(process.env.POSTGRES_POOL_MIN) || 2,
    max: parseInt(process.env.POSTGRES_POOL_MAX) || 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// Log pool errors
pool.on('error', (err, client) => {
    logger.error('Unexpected database pool error', { error: err.message, stack: err.stack });
});

// Log successful connections
pool.on('connect', (client) => {
    logger.debug('New PostgreSQL client connected');
});

// Graceful shutdown
const shutdown = async () => {
    try {
        await pool.end();
        logger.info('PostgreSQL pool closed gracefully');
    } catch (err) {
        logger.error('Error closing PostgreSQL pool', { error: err.message });
    }
};

process.on('SIGINT', async () => {
    await shutdown();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await shutdown();
    process.exit(0);
});

module.exports = pool;
