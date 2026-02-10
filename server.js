require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ExcelJS = require('exceljs');
const session = require('express-session');
const Redis = require('redis');
const RedisStore = require('connect-redis').default;
const passport = require('passport');
const cookieParser = require('cookie-parser');
const logger = require('./logger');
const auth = require('./auth');
const { configurePassport } = require('./passport-config');
const db = require('./database/query-helpers');
const pool = require('./database/pg-pool');

// ============================================================================
// Privilege System Constants
// ============================================================================
const PRIVILEGE_DEFINITIONS = [
    // Troop & Member Management
    { code: 'view_roster', name: 'View troop roster', category: 'Troop & Member Management' },
    { code: 'manage_members', name: 'Manage troop members', category: 'Troop & Member Management' },
    { code: 'manage_troop_settings', name: 'Manage troop settings', category: 'Troop & Member Management' },
    { code: 'send_invitations', name: 'Send invitations', category: 'Troop & Member Management' },
    { code: 'import_roster', name: 'Import roster', category: 'Troop & Member Management' },
    { code: 'manage_member_roles', name: 'Manage member roles', category: 'Troop & Member Management' },
    { code: 'manage_privileges', name: 'Manage privileges', category: 'Troop & Member Management' },
    // Scout Profiles & Advancement
    { code: 'view_scout_profiles', name: 'View scout profiles', category: 'Scout Profiles & Advancement' },
    { code: 'edit_scout_level', name: 'Edit scout level', category: 'Scout Profiles & Advancement' },
    { code: 'edit_scout_status', name: 'Edit scout status', category: 'Scout Profiles & Advancement' },
    { code: 'award_badges', name: 'Award badges', category: 'Scout Profiles & Advancement' },
    { code: 'view_badge_progress', name: 'View badge progress', category: 'Scout Profiles & Advancement' },
    { code: 'edit_personal_info', name: 'Edit personal info', category: 'Scout Profiles & Advancement' },
    // Calendar & Events
    { code: 'view_events', name: 'View events', category: 'Calendar & Events' },
    { code: 'manage_events', name: 'Manage events', category: 'Calendar & Events' },
    { code: 'export_calendar', name: 'Export calendar', category: 'Calendar & Events' },
    // Fundraising & Sales (future)
    { code: 'view_sales', name: 'View sales data', category: 'Fundraising & Sales', future: true },
    { code: 'record_sales', name: 'Record sales', category: 'Fundraising & Sales', future: true },
    { code: 'manage_fundraisers', name: 'Manage fundraisers', category: 'Fundraising & Sales', future: true },
    { code: 'view_troop_sales', name: 'View troop sales', category: 'Fundraising & Sales', future: true },
    { code: 'view_financials', name: 'View financial accounts', category: 'Fundraising & Sales', future: true },
    { code: 'manage_financials', name: 'Manage financial accounts', category: 'Fundraising & Sales', future: true },
    // Donations
    { code: 'view_donations', name: 'View donations', category: 'Donations' },
    { code: 'record_donations', name: 'Record donations', category: 'Donations' },
    { code: 'delete_donations', name: 'Delete donations', category: 'Donations' },
    // Troop Goals & Reporting
    { code: 'view_goals', name: 'View goals', category: 'Troop Goals & Reporting' },
    { code: 'manage_goals', name: 'Manage goals', category: 'Troop Goals & Reporting' },
    { code: 'view_leaderboard', name: 'View leaderboard', category: 'Troop Goals & Reporting' },
    // Data & Settings
    { code: 'manage_payment_methods', name: 'Manage payment methods', category: 'Data & Settings' },
    { code: 'import_data', name: 'Import data', category: 'Data & Settings' },
    { code: 'export_data', name: 'Export data', category: 'Data & Settings' },
    { code: 'delete_own_data', name: 'Delete own data', category: 'Data & Settings' },
];

const VALID_PRIVILEGE_CODES = PRIVILEGE_DEFINITIONS.map(p => p.code);
const VALID_SCOPES = ['T', 'D', 'H', 'S', 'none'];

// Default privilege scopes per troop role (from Account Access Schema)
const ROLE_PRIVILEGE_DEFAULTS = {
    member:        { view_roster:'none', manage_members:'none', manage_troop_settings:'none', send_invitations:'none', import_roster:'none', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'S', edit_scout_level:'none', edit_scout_status:'none', award_badges:'none', view_badge_progress:'S', edit_personal_info:'none', view_events:'T', manage_events:'none', export_calendar:'T', view_sales:'S', record_sales:'S', manage_fundraisers:'none', view_troop_sales:'none', view_financials:'none', manage_financials:'none', view_donations:'S', record_donations:'S', delete_donations:'S', view_goals:'T', manage_goals:'none', view_leaderboard:'T', manage_payment_methods:'S', import_data:'none', export_data:'S', delete_own_data:'S' },
    parent:        { view_roster:'none', manage_members:'none', manage_troop_settings:'none', send_invitations:'none', import_roster:'none', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'H', edit_scout_level:'none', edit_scout_status:'none', award_badges:'none', view_badge_progress:'H', edit_personal_info:'H', view_events:'T', manage_events:'none', export_calendar:'T', view_sales:'H', record_sales:'H', manage_fundraisers:'none', view_troop_sales:'none', view_financials:'none', manage_financials:'none', view_donations:'H', record_donations:'H', delete_donations:'H', view_goals:'T', manage_goals:'none', view_leaderboard:'T', manage_payment_methods:'S', import_data:'none', export_data:'H', delete_own_data:'S' },
    volunteer:     { view_roster:'T', manage_members:'none', manage_troop_settings:'none', send_invitations:'none', import_roster:'none', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'none', edit_scout_level:'none', edit_scout_status:'none', award_badges:'none', view_badge_progress:'none', edit_personal_info:'none', view_events:'T', manage_events:'none', export_calendar:'T', view_sales:'none', record_sales:'none', manage_fundraisers:'none', view_troop_sales:'none', view_financials:'none', manage_financials:'none', view_donations:'none', record_donations:'none', delete_donations:'none', view_goals:'T', manage_goals:'none', view_leaderboard:'T', manage_payment_methods:'S', import_data:'none', export_data:'none', delete_own_data:'S' },
    assistant:     { view_roster:'T', manage_members:'none', manage_troop_settings:'none', send_invitations:'none', import_roster:'none', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'D', edit_scout_level:'none', edit_scout_status:'none', award_badges:'none', view_badge_progress:'D', edit_personal_info:'none', view_events:'T', manage_events:'T', export_calendar:'T', view_sales:'none', record_sales:'none', manage_fundraisers:'none', view_troop_sales:'none', view_financials:'none', manage_financials:'none', view_donations:'none', record_donations:'none', delete_donations:'none', view_goals:'T', manage_goals:'none', view_leaderboard:'T', manage_payment_methods:'S', import_data:'none', export_data:'none', delete_own_data:'S' },
    'co-leader':   { view_roster:'T', manage_members:'T', manage_troop_settings:'T', send_invitations:'T', import_roster:'T', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'T', edit_scout_level:'T', edit_scout_status:'T', award_badges:'T', view_badge_progress:'T', edit_personal_info:'T', view_events:'T', manage_events:'T', export_calendar:'T', view_sales:'T', record_sales:'S', manage_fundraisers:'T', view_troop_sales:'T', view_financials:'T', manage_financials:'none', view_donations:'T', record_donations:'S', delete_donations:'S', view_goals:'T', manage_goals:'T', view_leaderboard:'T', manage_payment_methods:'S', import_data:'none', export_data:'T', delete_own_data:'S' },
    cookie_leader: { view_roster:'T', manage_members:'none', manage_troop_settings:'none', send_invitations:'none', import_roster:'none', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'none', edit_scout_level:'none', edit_scout_status:'none', award_badges:'none', view_badge_progress:'none', edit_personal_info:'none', view_events:'T', manage_events:'none', export_calendar:'T', view_sales:'T', record_sales:'T', manage_fundraisers:'T', view_troop_sales:'T', view_financials:'T', manage_financials:'T', view_donations:'T', record_donations:'S', delete_donations:'none', view_goals:'T', manage_goals:'none', view_leaderboard:'T', manage_payment_methods:'S', import_data:'T', export_data:'T', delete_own_data:'S' },
    troop_leader:  { view_roster:'T', manage_members:'T', manage_troop_settings:'T', send_invitations:'T', import_roster:'T', manage_member_roles:'T', manage_privileges:'T', view_scout_profiles:'T', edit_scout_level:'T', edit_scout_status:'T', award_badges:'T', view_badge_progress:'T', edit_personal_info:'T', view_events:'T', manage_events:'T', export_calendar:'T', view_sales:'T', record_sales:'T', manage_fundraisers:'T', view_troop_sales:'T', view_financials:'T', manage_financials:'T', view_donations:'T', record_donations:'T', delete_donations:'T', view_goals:'T', manage_goals:'T', view_leaderboard:'T', manage_payment_methods:'S', import_data:'T', export_data:'T', delete_own_data:'S' },
    council_admin: { view_roster:'T', manage_members:'T', manage_troop_settings:'T', send_invitations:'T', import_roster:'T', manage_member_roles:'T', manage_privileges:'T', view_scout_profiles:'T', edit_scout_level:'T', edit_scout_status:'T', award_badges:'T', view_badge_progress:'T', edit_personal_info:'T', view_events:'T', manage_events:'T', export_calendar:'T', view_sales:'T', record_sales:'T', manage_fundraisers:'T', view_troop_sales:'T', view_financials:'T', manage_financials:'T', view_donations:'T', record_donations:'T', delete_donations:'T', view_goals:'T', manage_goals:'T', view_leaderboard:'T', manage_payment_methods:'S', import_data:'T', export_data:'T', delete_own_data:'S' },
};

// Configure multer for file uploads (memory storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.originalname.endsWith('.xlsx')) {
            cb(null, true);
        } else {
            cb(new Error('Only .xlsx files are allowed'), false);
        }
    }
});

const app = express();
app.set('trust proxy', 1); // Trust first proxy
const PORT = process.env.PORT || 3000;

// Test PostgreSQL connection on startup
(async () => {
    const connected = await db.testConnection();
    if (!connected) {
        logger.error('PostgreSQL connection failed - exiting');
        process.exit(1);
    }
    logger.info('PostgreSQL connection established successfully');

    // Safe schema migrations - add columns if they don't exist
    try {
        // Add position column to troop_members
        await db.query(`
            ALTER TABLE troop_members ADD COLUMN IF NOT EXISTS position VARCHAR(50)
        `).catch(() => {});

        // Add additionalRoles column (JSON array of role strings)
        await db.query(`
            ALTER TABLE troop_members ADD COLUMN IF NOT EXISTS "additionalRoles" JSONB DEFAULT '[]'
        `).catch(() => {});

        // Relax the role CHECK constraint to include new positions
        await db.query(`
            ALTER TABLE troop_members DROP CONSTRAINT IF EXISTS role_check
        `).catch(() => {});
        await db.query(`
            ALTER TABLE troop_members ADD CONSTRAINT role_check
            CHECK (role IN ('member', 'co-leader', 'assistant', 'parent', 'troop_leader', 'volunteer'))
        `).catch(() => {});

        // Allow users.email to be nullable for members added by name only
        await db.query(`
            ALTER TABLE users ALTER COLUMN email DROP NOT NULL
        `).catch(() => {});

        // Drop the original unique constraint on email, replace with partial unique index
        await db.query(`
            ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key
        `).catch(() => {});
        await db.query(`
            DROP INDEX IF EXISTS idx_users_email
        `).catch(() => {});
        await db.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL
        `).catch(() => {});

        // Add Calendar fields to events table
        await db.query(`
            ALTER TABLE events ADD COLUMN IF NOT EXISTS "eventType" VARCHAR(50) DEFAULT 'event'
        `).catch(() => {});
        await db.query(`
            ALTER TABLE events ADD COLUMN IF NOT EXISTS "startTime" VARCHAR(10)
        `).catch(() => {});
        await db.query(`
            ALTER TABLE events ADD COLUMN IF NOT EXISTS "endTime" VARCHAR(10)
        `).catch(() => {});
        await db.query(`
            ALTER TABLE events ADD COLUMN IF NOT EXISTS "location" TEXT
        `).catch(() => {});
        await db.query(`
            ALTER TABLE events ADD COLUMN IF NOT EXISTS "targetGroup" VARCHAR(50) DEFAULT 'Troop'
        `).catch(() => {});
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_events_troopId_date ON events("troopId", "eventDate")
        `).catch(() => {});

        // Create privilege_overrides table for per-user-per-troop privilege overrides
        await db.query(`
            CREATE TABLE IF NOT EXISTS privilege_overrides (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                "troopId" UUID NOT NULL REFERENCES troops(id) ON DELETE CASCADE,
                "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                "privilegeCode" VARCHAR(50) NOT NULL,
                scope VARCHAR(10) NOT NULL,
                "grantedBy" UUID NOT NULL REFERENCES users(id),
                "grantedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT scope_check CHECK (scope IN ('T', 'D', 'H', 'S', 'none')),
                CONSTRAINT unique_override UNIQUE ("troopId", "userId", "privilegeCode")
            )
        `).catch(() => {});
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_priv_overrides_troop_user
            ON privilege_overrides("troopId", "userId")
        `).catch(() => {});

        logger.info('Schema migration checks completed');
    } catch (err) {
        logger.warn('Schema migration checks had issues (non-fatal)', { error: err.message });
    }
})();

// Note: PostgreSQL schema is managed via migration files in /migrations/
// Run migrations using: psql -U asm_user -d apex_scout_manager -f migrations/001_enable_uuid_extension.sql
//                       psql -U asm_user -d apex_scout_manager -f migrations/002_create_schema.sql

// Rate limiting middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

// Request logging middleware
app.use((req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        // Use explicit conditionals for log level to prevent injection
        const logLevel = res.statusCode >= 500 ? 'error' : (res.statusCode >= 400 ? 'warn' : 'info');
        logger[logLevel]('HTTP Request', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip
        });
    });
    
    next();
});

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Create Redis client
const redisClient = Redis.createClient({
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379
    },
    password: process.env.REDIS_PASSWORD || undefined,
    database: parseInt(process.env.REDIS_DB) || 0
});

redisClient.on('error', (err) => logger.error('Redis client error', { error: err.message }));
redisClient.on('connect', () => logger.info('Redis client connected'));

// Connect to Redis
redisClient.connect().catch(err => {
    logger.error('Redis connection failed', { error: err.message });
    process.exit(1);
});

// Session configuration with Redis
app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET || 'asm-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Require HTTPS in production
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'lax'
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
const passportStrategies = configurePassport(db);

// Note: Redis handles session TTL automatically, no manual cleanup needed

app.use('/api/', limiter); // Apply rate limiting to all API routes

// Serve login and register pages without authentication
app.get('/login.html', (req, res, next) => {
    // If already authenticated, redirect to main page
    if (req.session && req.session.userId) {
        return res.redirect('/');
    }
    next();
});

app.get('/register.html', (req, res, next) => {
    // If already authenticated, redirect to main page
    if (req.session && req.session.userId) {
        return res.redirect('/');
    }
    next();
});

// Protect the main page - redirect to login if not authenticated
app.get('/', (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/login.html');
    }
    next();
});

app.get('/index.html', (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/login.html');
    }
    next();
});

app.use(express.static('public'));

// ============================================================================
// Authentication Routes
// ============================================================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, dateOfBirth, parentEmail } = req.body;

        // Validate required fields
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate email format
        if (!auth.isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Validate password strength
        const passwordValidation = auth.validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        // Check if user already exists
        const existingUser = await db.getOne('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Check if minor (COPPA compliance)
        let isMinorUser = false;
        if (dateOfBirth) {
            isMinorUser = auth.isMinor(dateOfBirth);

            // If minor and no parent email, require it
            if (isMinorUser && !parentEmail) {
                return res.status(400).json({
                    error: 'Parent email required for users under 13'
                });
            }
        }

        // Hash password
        const passwordHash = await auth.hashPassword(password);

        // Create user (PostgreSQL returns inserted row)
        const newUser = await db.getOne(`
            INSERT INTO users (
                email, password_hash, "firstName", "lastName",
                "dateOfBirth", "isMinor", "parentEmail", role,
                "isActive", "emailVerified"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `, [
            email,
            passwordHash,
            firstName,
            lastName,
            dateOfBirth || null,
            isMinorUser,
            parentEmail || null,
            'scout', // Default role
            !isMinorUser, // Require activation for minors
            false // Email not verified
        ]);

        const userId = newUser.id;

        // Create default profile
        await db.run(`
            INSERT INTO profile ("userId", "scoutName", email)
            VALUES ($1, $2, $3)
        `, [userId, `${firstName} ${lastName}`.trim(), email]);

        // Log audit event
        await auth.logAuditEvent(db, userId, 'user_registered', req, { email });

        // Send notification if minor (parent consent required)
        if (isMinorUser) {
            await auth.createNotification(
                db,
                userId,
                'info',
                'Account Pending',
                'Your account requires parental consent before activation. A consent email has been sent to your parent/guardian.'
            );
        }

        logger.info('New user registered', { userId, email, isMinor: isMinorUser });

        res.status(201).json({
            message: isMinorUser
                ? 'Registration successful. Parental consent required.'
                : 'Registration successful. Please log in.',
            userId,
            requiresConsent: isMinorUser
        });

    } catch (error) {
        logger.error('Registration error', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login with email/password
app.post('/api/auth/login', (req, res, next) => {
    passport.authenticate('local', async (err, user, info) => {
        if (err) {
            logger.error('Login error', { error: err.message });
            return res.status(500).json({ error: 'Login failed' });
        }

        if (!user) {
            return res.status(401).json({ error: info.message || 'Invalid credentials' });
        }

        req.logIn(user, async (err) => {
            if (err) {
                logger.error('Session creation error', { error: err.message });
                return res.status(500).json({ error: 'Failed to create session' });
            }

            // Store user info in session
            req.session.userId = user.id;
            req.session.userEmail = user.email;

            // Hardcoded superuser privilege for welefort@gmail.com
            if (user.email === 'welefort@gmail.com') {
                req.session.userRole = 'council_admin';
            } else {
                req.session.userRole = user.role;
            }

            // Log audit event
            await auth.logAuditEvent(db, user.id, 'user_login', req, { method: 'local' });

            logger.info('User logged in', { userId: user.id, email: user.email });

            res.json({
                message: 'Login successful',
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    photoUrl: user.photoUrl
                }
            });
        });
    })(req, res, next);
});

// Google OAuth initiation
if (passportStrategies.google) {
    app.get('/auth/google',
        passport.authenticate('google', {
            scope: ['profile', 'email']
        })
    );

    // Google OAuth callback
    app.get('/auth/google/callback',
        passport.authenticate('google', { failureRedirect: '/login.html' }),
        (req, res) => {
            // Store user info in session
            req.session.userId = req.user.id;
            req.session.userEmail = req.user.email;
            
            // Hardcoded superuser privilege for welefort@gmail.com
            if (req.user.email === 'welefort@gmail.com') {
                req.session.userRole = 'council_admin';
            } else {
                req.session.userRole = req.user.role;
            }

            // Log audit event
            auth.logAuditEvent(db, req.user.id, 'user_login', req, { method: 'google' });

            logger.info('User logged in via Google', { userId: req.user.id, email: req.user.email });

            res.redirect('/');
        }
    );
}

// Logout
app.post('/api/auth/logout', auth.isAuthenticated, (req, res) => {
    const userId = req.session.userId;

    // Log audit event
    auth.logAuditEvent(db, userId, 'user_logout', req);

    req.logout((err) => {
        if (err) {
            logger.error('Logout error', { error: err.message });
            return res.status(500).json({ error: 'Logout failed' });
        }

        req.session.destroy((err) => {
            if (err) {
                logger.error('Session destruction error', { error: err.message });
            }

            res.clearCookie('connect.sid');
            res.json({ message: 'Logout successful' });
        });
    });
});

// Get current user
app.get('/api/auth/me', auth.isAuthenticated, async (req, res) => {
    try {
        const user = await db.getOne(`
            SELECT id, email, "firstName", "lastName", role, "photoUrl",
                   "isActive", "emailVerified", "dateOfBirth", "isMinor", "createdAt", "lastLogin"
            FROM users
            WHERE id = $1
        `, [req.session.userId]);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Hardcoded superuser privilege for welefort@gmail.com
        if (user.email === 'welefort@gmail.com') {
            user.role = 'council_admin';
        }

        // Get troop info
        const membership = await db.getOne(`
            SELECT "troopId" FROM troop_members
            WHERE "userId" = $1 AND status = 'active'
            LIMIT 1
        `, [req.session.userId]);

        if (membership) {
            user.troopId = membership.troopId;
        }

        res.json(user);
    } catch (error) {
        logger.error('Error fetching current user', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Get notifications for current user
app.get('/api/notifications', auth.isAuthenticated, async (req, res) => {
    try {
        const notifications = await db.getAll(`
            SELECT * FROM notifications
            WHERE "userId" = $1
            ORDER BY "createdAt" DESC
            LIMIT 50
        `, [req.session.userId]);

        res.json(notifications);
    } catch (error) {
        logger.error('Error fetching notifications', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark notification as read
app.put('/api/notifications/:id/read', auth.isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.run(`
            UPDATE notifications
            SET "isRead" = true, "readAt" = NOW()
            WHERE id = $1 AND "userId" = $2
        `, [id, req.session.userId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ success: true });
    } catch (error) {
        logger.error('Error marking notification as read', { error: error.message });
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

// ============================================================================
// API Routes (Protected - require authentication)
// ============================================================================

// Get all sales (filtered by userId)
app.get('/api/sales', auth.isAuthenticated, async (req, res) => {
    try {
        const sales = await db.getAll('SELECT * FROM sales WHERE "userId" = $1 ORDER BY id DESC', [req.session.userId]);
        res.json(sales);
    } catch (error) {
        logger.error('Error fetching sales', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch sales' });
    }
});

// Add a new sale
app.post('/api/sales', auth.isAuthenticated, async (req, res) => {
    try {
        const {
            cookieType,
            quantity,
            customerName,
            date,
            saleType,
            customerAddress,
            customerPhone,
            unitType,
            amountCollected,
            amountDue,
            paymentMethod
        } = req.body;

        if (!cookieType || !quantity || quantity < 1) {
            logger.warn('Invalid sale data received', { cookieType, quantity });
            return res.status(400).json({ error: 'Invalid sale data' });
        }

        // Validate and sanitize customerName
        const sanitizedCustomerName = (customerName && customerName.trim()) || 'Walk-in Customer';

        // Validate saleType (individual or event)
        const validSaleType = (saleType === 'event') ? 'event' : 'individual';

        // Validate and use current date if not provided or invalid
        let saleDate = date;
        if (!saleDate || isNaN(new Date(saleDate).getTime())) {
            saleDate = new Date().toISOString();
        }

        // Validate and sanitize new fields
        const sanitizedCustomerAddress = (customerAddress && customerAddress.trim()) || null;
        const sanitizedCustomerPhone = (customerPhone && customerPhone.trim()) || null;
        const validUnitType = (unitType === 'case') ? 'case' : 'box';
        const validAmountCollected = (typeof amountCollected === 'number' && amountCollected >= 0) ? amountCollected : 0;
        const validAmountDue = (typeof amountDue === 'number' && amountDue >= 0) ? amountDue : 0;
        const validPaymentMethod = paymentMethod || null;

        // New order grouping fields
        const sanitizedOrderNumber = (req.body.orderNumber && String(req.body.orderNumber)) || null;
        const sanitizedOrderType = (req.body.orderType && String(req.body.orderType)) || null;
        const sanitizedOrderStatus = (req.body.orderStatus && String(req.body.orderStatus)) || 'Pending';

        const newSale = await db.getOne(`
            INSERT INTO sales (
                "cookieType", quantity, "customerName", date, "saleType",
                "customerAddress", "customerPhone", "unitType",
                "amountCollected", "amountDue", "paymentMethod",
                "orderNumber", "orderType", "orderStatus", "userId"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `, [
            cookieType, quantity, sanitizedCustomerName, saleDate, validSaleType,
            sanitizedCustomerAddress, sanitizedCustomerPhone, validUnitType,
            validAmountCollected, validAmountDue, validPaymentMethod,
            sanitizedOrderNumber, sanitizedOrderType, sanitizedOrderStatus,
            req.session.userId
        ]);

        logger.info('Sale added successfully', { saleId: newSale.id, cookieType, quantity, saleType: validSaleType, userId: req.session.userId });
        res.status(201).json(newSale);
    } catch (error) {
        // Log error without sensitive request body data
        logger.error('Error adding sale', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to add sale' });
    }
});

// Update a sale (only owner can update)
app.put('/api/sales/:id', auth.isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { orderStatus, amountCollected, amountDue } = req.body;

        // Check ownership
        const existingSale = await db.getOne('SELECT "userId" FROM sales WHERE id = $1', [id]);
        if (!existingSale) {
            return res.status(404).json({ error: 'Sale not found' });
        }
        if (existingSale.userId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Dynamic update query construction
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (orderStatus !== undefined) {
            updates.push(`"orderStatus" = $${paramCount++}`);
            values.push(orderStatus);
        }

        if (amountCollected !== undefined) {
            updates.push(`"amountCollected" = $${paramCount++}`);
            values.push(amountCollected);
        }

        if (amountDue !== undefined) {
            updates.push(`"amountDue" = $${paramCount++}`);
            values.push(amountDue);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(id);

        await db.run(`UPDATE sales SET ${updates.join(', ')} WHERE id = $${paramCount}`, values);

        const updatedSale = await db.getOne('SELECT * FROM sales WHERE id = $1', [id]);
        logger.info('Sale updated successfully', { saleId: id, updates, userId: req.session.userId });
        res.json(updatedSale);
    } catch (error) {
        logger.error('Error updating sale', { error: error.message, stack: error.stack, saleId: req.params.id });
        res.status(500).json({ error: 'Failed to update sale' });
    }
});

// Delete a sale (only owner can delete)
app.delete('/api/sales/:id', auth.isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        // Check ownership
        const existingSale = await db.getOne('SELECT "userId" FROM sales WHERE id = $1', [id]);
        if (!existingSale) {
            logger.warn('Attempted to delete non-existent sale', { saleId: id });
            return res.status(404).json({ error: 'Sale not found' });
        }
        if (existingSale.userId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        await db.run('DELETE FROM sales WHERE id = $1', [id]);

        logger.info('Sale deleted successfully', { saleId: id, userId: req.session.userId });
        res.json({ message: 'Sale deleted successfully' });
    } catch (error) {
        logger.error('Error deleting sale', { error: error.message, stack: error.stack, saleId: req.params.id });
        res.status(500).json({ error: 'Failed to delete sale' });
    }
});

// Get profile (for current user)
app.get('/api/profile', auth.isAuthenticated, async (req, res) => {
    try {
        let profile = await db.getOne('SELECT * FROM profile WHERE "userId" = $1', [req.session.userId]);

        // If no profile exists for this user, create one
        if (!profile) {
            const user = await db.getOne('SELECT "firstName", "lastName", email FROM users WHERE id = $1', [req.session.userId]);
            const scoutName = user ? `${user.firstName} ${user.lastName}`.trim() : '';
            const email = user ? user.email : '';

            profile = await db.getOne(`
                INSERT INTO profile ("userId", "scoutName", email, "goalBoxes", "goalAmount")
                VALUES ($1, $2, $3, 0, 0)
                RETURNING *
            `, [req.session.userId, scoutName, email]);
        }

        res.json(profile || {
            userId: req.session.userId,
            photoData: null,
            qrCodeUrl: null,
            goalBoxes: 0,
            goalAmount: 0,
            inventoryThinMints: 0,
            inventorySamoas: 0,
            inventoryTagalongs: 0,
            inventoryTrefoils: 0,
            inventoryDosiDos: 0,
            inventoryLemonUps: 0,
            inventoryAdventurefuls: 0,
            inventoryExploremores: 0,
            inventoryToffeetastic: 0
        });
    } catch (error) {
        logger.error('Error fetching profile', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update profile (for current user)
app.put('/api/profile', auth.isAuthenticated, async (req, res) => {
    try {
        const {
            photoData, qrCodeUrl, paymentQrCodeUrl, goalBoxes, goalAmount,
            inventoryThinMints, inventorySamoas, inventoryTagalongs,
            inventoryTrefoils, inventoryDosiDos, inventoryLemonUps,
            inventoryAdventurefuls, inventoryExploremores, inventoryToffeetastic
        } = req.body;

        // Helper function to validate numeric values
        const validateNumber = (value) => (typeof value === 'number' && value >= 0) ? value : 0;

        // Validate goalBoxes and goalAmount
        const validGoalBoxes = validateNumber(goalBoxes);
        const validGoalAmount = validateNumber(goalAmount);

        // Validate inventory values
        const inventoryFields = [
            inventoryThinMints, inventorySamoas, inventoryTagalongs,
            inventoryTrefoils, inventoryDosiDos, inventoryLemonUps,
            inventoryAdventurefuls, inventoryExploremores, inventoryToffeetastic
        ];
        const validatedInventory = inventoryFields.map(validateNumber);

        // Check if profile exists for this user
        const existingProfile = await db.getOne('SELECT id FROM profile WHERE "userId" = $1', [req.session.userId]);

        if (existingProfile) {
            // Update existing profile
            await db.run(`
                UPDATE profile
                SET "photoData" = COALESCE($1, "photoData"),
                    "qrCodeUrl" = COALESCE($2, "qrCodeUrl"),
                    "paymentQrCodeUrl" = COALESCE($3, "paymentQrCodeUrl"),
                    "goalBoxes" = $4,
                    "goalAmount" = $5,
                    "inventoryThinMints" = $6,
                    "inventorySamoas" = $7,
                    "inventoryTagalongs" = $8,
                    "inventoryTrefoils" = $9,
                    "inventoryDosiDos" = $10,
                    "inventoryLemonUps" = $11,
                    "inventoryAdventurefuls" = $12,
                    "inventoryExploremores" = $13,
                    "inventoryToffeetastic" = $14
                WHERE "userId" = $15
            `, [
                photoData, qrCodeUrl, paymentQrCodeUrl, validGoalBoxes, validGoalAmount,
                ...validatedInventory,
                req.session.userId
            ]);
        } else {
            // Create new profile
            const user = await db.getOne('SELECT "firstName", "lastName", email FROM users WHERE id = $1', [req.session.userId]);
            const scoutName = user ? `${user.firstName} ${user.lastName}`.trim() : '';
            const email = user ? user.email : '';

            await db.run(`
                INSERT INTO profile (
                    "userId", "scoutName", email, "photoData", "qrCodeUrl", "paymentQrCodeUrl",
                    "goalBoxes", "goalAmount",
                    "inventoryThinMints", "inventorySamoas", "inventoryTagalongs",
                    "inventoryTrefoils", "inventoryDosiDos", "inventoryLemonUps",
                    "inventoryAdventurefuls", "inventoryExploremores", "inventoryToffeetastic"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            `, [
                req.session.userId, scoutName, email,
                photoData, qrCodeUrl, paymentQrCodeUrl, validGoalBoxes, validGoalAmount,
                ...validatedInventory
            ]);
        }

        const updatedProfile = await db.getOne('SELECT * FROM profile WHERE "userId" = $1', [req.session.userId]);
        logger.info('Profile updated successfully', {
            userId: req.session.userId,
            updates: {
                hasPhoto: !!photoData,
                hasStoreQr: !!qrCodeUrl,
                hasPaymentQr: !!paymentQrCodeUrl,
                goalBoxes: validGoalBoxes
            }
        });
        res.json(updatedProfile);
    } catch (error) {
        logger.error('Error updating profile', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Get all donations (filtered by userId)
app.get('/api/donations', auth.isAuthenticated, async (req, res) => {
    try {
        const donations = await db.getAll('SELECT * FROM donations WHERE "userId" = $1 ORDER BY id DESC', [req.session.userId]);
        res.json(donations);
    } catch (error) {
        logger.error('Error fetching donations', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch donations' });
    }
});

// Add a new donation
app.post('/api/donations', auth.isAuthenticated, async (req, res) => {
    try {
        const { amount, donorName, date } = req.body;

        if (!amount || amount <= 0) {
            logger.warn('Invalid donation data received', { amount });
            return res.status(400).json({ error: 'Invalid donation data' });
        }

        // Validate and sanitize donorName
        const sanitizedDonorName = (donorName && donorName.trim()) || 'Anonymous';

        // Validate and use current date if not provided or invalid
        let donationDate = date;
        if (!donationDate || isNaN(new Date(donationDate).getTime())) {
            donationDate = new Date().toISOString();
        }

        const newDonation = await db.getOne('INSERT INTO donations (amount, "donorName", date, "userId") VALUES ($1, $2, $3, $4) RETURNING *',
            [amount, sanitizedDonorName, donationDate, req.session.userId]);

        logger.info('Donation added successfully', { donationId: newDonation.id, amount, userId: req.session.userId });
        res.status(201).json(newDonation);
    } catch (error) {
        logger.error('Error adding donation', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to add donation' });
    }
});

// Delete a donation (only owner can delete)
app.delete('/api/donations/:id', auth.isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        // Check ownership
        const existingDonation = await db.getOne('SELECT "userId" FROM donations WHERE id = $1', [id]);
        if (!existingDonation) {
            logger.warn('Attempted to delete non-existent donation', { donationId: id });
            return res.status(404).json({ error: 'Donation not found' });
        }
        if (existingDonation.userId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        await db.run('DELETE FROM donations WHERE id = $1', [id]);

        logger.info('Donation deleted successfully', { donationId: id, userId: req.session.userId });
        res.json({ message: 'Donation deleted successfully' });
    } catch (error) {
        logger.error('Error deleting donation', { error: error.message, stack: error.stack, donationId: req.params.id });
        res.status(500).json({ error: 'Failed to delete donation' });
    }
});

// Get all events (filtered by userId)
app.get('/api/events', auth.isAuthenticated, async (req, res) => {
    try {
        const events = await db.getAll('SELECT * FROM events WHERE "userId" = $1 ORDER BY "eventDate" DESC', [req.session.userId]);
        res.json(events);
    } catch (error) {
        logger.error('Error fetching events', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Add a new event
app.post('/api/events', auth.isAuthenticated, async (req, res) => {
    try {
        const {
            eventName,
            eventDate,
            description,
            initialBoxes,
            initialCases,
            remainingBoxes,
            remainingCases,
            donationsReceived,
            troopId,
            eventType,
            startTime,
            endTime,
            location,
            targetGroup
        } = req.body;

        if (!eventName || !eventDate) {
            logger.warn('Invalid event data received', { eventName, eventDate });
            return res.status(400).json({ error: 'Event name and date are required' });
        }

        // Validate and sanitize eventName
        const sanitizedEventName = eventName.trim();
        if (!sanitizedEventName) {
            logger.warn('Empty event name received');
            return res.status(400).json({ error: 'Event name cannot be empty' });
        }

        // Validate and use current date if not provided or invalid
        let validEventDate = eventDate;
        if (!validEventDate || isNaN(new Date(validEventDate).getTime())) {
            validEventDate = new Date().toISOString();
        }

        // Validate numeric fields
        const validInitialBoxes = (typeof initialBoxes === 'number' && initialBoxes >= 0) ? initialBoxes : 0;
        const validInitialCases = (typeof initialCases === 'number' && initialCases >= 0) ? initialCases : 0;
        const validRemainingBoxes = (typeof remainingBoxes === 'number' && remainingBoxes >= 0) ? remainingBoxes : 0;
        const validRemainingCases = (typeof remainingCases === 'number' && remainingCases >= 0) ? remainingCases : 0;
        const validDonationsReceived = (typeof donationsReceived === 'number' && donationsReceived >= 0) ? donationsReceived : 0;
        const sanitizedDescription = (description && description.trim()) || null;

        // Verify troop membership if troopId is provided
        if (troopId) {
            const membership = await db.getOne(
                'SELECT * FROM troop_members WHERE "troopId" = $1 AND "userId" = $2 AND status = \'active\'',
                [troopId, req.session.userId]
            );
            if (!membership && req.session.userRole !== 'council_admin') {
                return res.status(403).json({ error: 'You are not an active member of this troop' });
            }
        }

        const newEvent = await db.getOne(`
            INSERT INTO events (
                "eventName", "eventDate", description,
                "initialBoxes", "initialCases", "remainingBoxes", "remainingCases",
                "donationsReceived", "userId", "troopId",
                "eventType", "startTime", "endTime", "location", "targetGroup"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `, [
            sanitizedEventName, validEventDate, sanitizedDescription,
            validInitialBoxes, validInitialCases, validRemainingBoxes, validRemainingCases,
            validDonationsReceived, req.session.userId, troopId || null,
            eventType || 'event', startTime || null, endTime || null, location || null, targetGroup || 'Troop'
        ]);

        logger.info('Event added successfully', { eventId: newEvent.id, eventName: sanitizedEventName, userId: req.session.userId, troopId });
        res.status(201).json(newEvent);
    } catch (error) {
        logger.error('Error adding event', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to add event' });
    }
});

// Update an event (only owner can update)
app.put('/api/events/:id', auth.isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            eventName,
            eventDate,
            description,
            initialBoxes,
            initialCases,
            remainingBoxes,
            remainingCases,
            donationsReceived,
            eventType,
            startTime,
            endTime,
            location,
            targetGroup
        } = req.body;

        // Check ownership
        const existingEvent = await db.getOne('SELECT "userId" FROM events WHERE id = $1', [id]);
        if (!existingEvent) {
            logger.warn('Attempted to update non-existent event', { eventId: id });
            return res.status(404).json({ error: 'Event not found' });
        }
        if (existingEvent.userId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!eventName || !eventDate) {
            logger.warn('Invalid event data received', { eventName, eventDate });
            return res.status(400).json({ error: 'Event name and date are required' });
        }

        // Validate and sanitize eventName
        const sanitizedEventName = eventName.trim();
        if (!sanitizedEventName) {
            logger.warn('Empty event name received');
            return res.status(400).json({ error: 'Event name cannot be empty' });
        }

        // Validate and use current date if not provided or invalid
        let validEventDate = eventDate;
        if (!validEventDate || isNaN(new Date(validEventDate).getTime())) {
            validEventDate = new Date().toISOString();
        }

        // Validate numeric fields
        const validInitialBoxes = (typeof initialBoxes === 'number' && initialBoxes >= 0) ? initialBoxes : 0;
        const validInitialCases = (typeof initialCases === 'number' && initialCases >= 0) ? initialCases : 0;
        const validRemainingBoxes = (typeof remainingBoxes === 'number' && remainingBoxes >= 0) ? remainingBoxes : 0;
        const validRemainingCases = (typeof remainingCases === 'number' && remainingCases >= 0) ? remainingCases : 0;
        const validDonationsReceived = (typeof donationsReceived === 'number' && donationsReceived >= 0) ? donationsReceived : 0;
        const sanitizedDescription = (description && description.trim()) || null;

        await db.run(`
            UPDATE events
            SET "eventName" = $1,
                "eventDate" = $2,
                description = $3,
                "initialBoxes" = $4,
                "initialCases" = $5,
                "remainingBoxes" = $6,
                "remainingCases" = $7,
                "donationsReceived" = $8,
                "eventType" = COALESCE($10, "eventType"),
                "startTime" = COALESCE($11, "startTime"),
                "endTime" = COALESCE($12, "endTime"),
                "location" = COALESCE($13, "location"),
                "targetGroup" = COALESCE($14, "targetGroup")
            WHERE id = $9
        `, [
            sanitizedEventName, validEventDate, sanitizedDescription,
            validInitialBoxes, validInitialCases, validRemainingBoxes, validRemainingCases,
            validDonationsReceived, id,
            eventType, startTime, endTime, location, targetGroup
        ]);

        const updatedEvent = await db.getOne('SELECT * FROM events WHERE id = $1', [id]);
        logger.info('Event updated successfully', { eventId: id, userId: req.session.userId });
        res.json(updatedEvent);
    } catch (error) {
        logger.error('Error updating event', { error: error.message, stack: error.stack, eventId: req.params.id });
        res.status(500).json({ error: 'Failed to update event' });
    }
});

// Delete an event (only owner can delete)
app.delete('/api/events/:id', auth.isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        // Check ownership
        const existingEvent = await db.getOne('SELECT "userId" FROM events WHERE id = $1', [id]);
        if (!existingEvent) {
            logger.warn('Attempted to delete non-existent event', { eventId: id });
            return res.status(404).json({ error: 'Event not found' });
        }
        if (existingEvent.userId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        await db.run('DELETE FROM events WHERE id = $1', [id]);

        logger.info('Event deleted successfully', { eventId: id, userId: req.session.userId });
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        logger.error('Error deleting event', { error: error.message, stack: error.stack, eventId: req.params.id });
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

// Import sales from XLSX file
app.post('/api/import', auth.isAuthenticated, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            logger.warn('No file uploaded for import');
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Use ExcelJS to read the workbook
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
            logger.warn('Empty XLSX file uploaded');
            return res.status(400).json({ error: 'No data found in file' });
        }

        // Convert worksheet to array of objects
        const data = [];
        const headers = [];

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) {
                // First row is headers
                row.eachCell((cell, colNumber) => {
                    headers[colNumber] = cell.value?.toString() || '';
                });
            } else {
                // Data rows
                const rowData = {};
                row.eachCell((cell, colNumber) => {
                    const header = headers[colNumber];
                    if (header) {
                        // Handle different cell value types
                        let value = cell.value;
                        if (value && typeof value === 'object') {
                            // Handle rich text, dates, etc.
                            if (value.richText) {
                                value = value.richText.map(rt => rt.text).join('');
                            } else if (value instanceof Date) {
                                value = value;
                            } else if (value.result !== undefined) {
                                value = value.result;
                            }
                        }
                        rowData[header] = value;
                    }
                });
                if (Object.keys(rowData).length > 0) {
                    data.push(rowData);
                }
            }
        });

        if (data.length === 0) {
            logger.warn('Empty XLSX file uploaded');
            return res.status(400).json({ error: 'No data found in file' });
        }

        // Cookie type mapping from XLSX columns to our cookie names
        const cookieColumns = [
            { xlsx: 'Thin Mints', db: 'Thin Mints' },
            { xlsx: 'Samoas', db: 'Samoas' },
            { xlsx: 'Caramel deLites', db: 'Samoas' },
            { xlsx: 'Tagalongs', db: 'Tagalongs' },
            { xlsx: 'Peanut Butter Patties', db: 'Tagalongs' },
            { xlsx: 'Trefoils', db: 'Trefoils' },
            { xlsx: 'Shortbread', db: 'Trefoils' },
            { xlsx: 'Do-si-dos', db: 'Do-si-dos' },
            { xlsx: 'Peanut Butter Sandwich', db: 'Do-si-dos' },
            { xlsx: 'Lemon-Ups', db: 'Lemon-Ups' },
            { xlsx: 'Adventurefuls', db: 'Adventurefuls' },
            { xlsx: 'Exploremores', db: 'Exploremores' },
            { xlsx: 'Toffee-tastic', db: 'Toffee-tastic' }
        ];

        const userId = req.session.userId;

        const insertStmt = db.prepare(`
            INSERT INTO sales (
                cookieType, quantity, customerName, customerAddress, customerPhone,
                date, saleType, unitType, orderNumber, orderType, orderStatus, customerEmail, userId
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let importedCount = 0;

        // Use a transaction for better performance
        const importTransaction = db.transaction((rows) => {
            for (const row of rows) {
                // Get order details
                const orderNumber = String(row['Order Number'] || '');
                const orderDate = row['Order Date'];
                const orderType = row['Order Type'] || '';
                const orderStatus = row['Order Status'] || '';
                const customerName = row['Deliver To'] || '';
                const customerAddress = row['Delivery Address'] || '';
                const customerPhone = row['Customer Phone'] || '';
                const customerEmail = row['Customer Email'] || '';

                // Convert date to ISO string
                let dateStr = new Date().toISOString();
                if (orderDate) {
                    if (orderDate instanceof Date) {
                        dateStr = orderDate.toISOString();
                    } else if (typeof orderDate === 'number') {
                        // Excel date serial number
                        const excelEpoch = new Date(1899, 11, 30);
                        const jsDate = new Date(excelEpoch.getTime() + orderDate * 24 * 60 * 60 * 1000);
                        dateStr = jsDate.toISOString();
                    } else if (typeof orderDate === 'string') {
                        const parsedDate = new Date(orderDate);
                        if (!isNaN(parsedDate.getTime())) {
                            dateStr = parsedDate.toISOString();
                        }
                    }
                }

                // Determine sale type based on order type
                let saleType = 'individual';
                if (orderType.toLowerCase().includes('donation')) {
                    saleType = 'donation';
                }

                // Check for donated cookies column
                const donatedCookies = parseInt(row['Donated Cookies'] || row['Donated Cookies (DO NOT DELIVER)'] || 0);
                if (donatedCookies > 0) {
                    // Add donated cookies as a special entry
                    insertStmt.run(
                        'Donated Cookies',
                        donatedCookies,
                        customerName,
                        customerAddress,
                        customerPhone,
                        dateStr,
                        'donation',
                        'box',
                        orderNumber,
                        orderType,
                        orderStatus,
                        customerEmail,
                        userId
                    );
                    importedCount++;
                }

                // Process each cookie type
                for (const cookie of cookieColumns) {
                    const quantity = parseInt(row[cookie.xlsx] || 0);
                    if (quantity > 0) {
                        insertStmt.run(
                            cookie.db,
                            quantity,
                            customerName,
                            customerAddress,
                            customerPhone,
                            dateStr,
                            saleType,
                            'box',
                            orderNumber,
                            orderType,
                            orderStatus,
                            customerEmail,
                            userId
                        );
                        importedCount++;
                    }
                }
            }
        });

        importTransaction(data);

        logger.info('XLSX import completed', {
            filename: req.file.originalname,
            totalRows: data.length,
            importedSales: importedCount,
            userId
        });

        res.json({
            message: 'Import successful',
            ordersProcessed: data.length,
            salesImported: importedCount
        });
    } catch (error) {
        logger.error('Error importing XLSX', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to import file: ' + error.message });
    }
});

// Get payment methods (filtered by userId)
app.get('/api/payment-methods', auth.isAuthenticated, async (req, res) => {
    try {
        const methods = await db.getAll('SELECT * FROM payment_methods WHERE "userId" = $1 ORDER BY id ASC', [req.session.userId]);
        res.json(methods);
    } catch (error) {
        logger.error('Error fetching payment methods', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch payment methods' });
    }
});

// Add payment method
app.post('/api/payment-methods', auth.isAuthenticated, async (req, res) => {
    try {
        const { name, url } = req.body;

        if (!name || !url) {
            return res.status(400).json({ error: 'Name and URL are required' });
        }

        const newMethod = await db.getOne('INSERT INTO payment_methods (name, url, "userId") VALUES ($1, $2, $3) RETURNING *',
            [name.trim(), url.trim(), req.session.userId]);

        logger.info('Payment method added', { id: newMethod.id, name, userId: req.session.userId });
        res.status(201).json(newMethod);
    } catch (error) {
        logger.error('Error adding payment method', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to add payment method' });
    }
});

// Delete payment method (only owner can delete)
app.delete('/api/payment-methods/:id', auth.isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        // Check ownership
        const existingMethod = await db.getOne('SELECT "userId" FROM payment_methods WHERE id = $1', [id]);
        if (!existingMethod) {
            return res.status(404).json({ error: 'Payment method not found' });
        }
        if (existingMethod.userId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        await db.run('DELETE FROM payment_methods WHERE id = $1', [id]);

        logger.info('Payment method deleted', { id, userId: req.session.userId });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error deleting payment method', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to delete payment method' });
    }
});



// Delete all sales (only current user's sales)
app.delete('/api/sales', auth.isAuthenticated, async (req, res) => {
    try {
        const result = await db.run('DELETE FROM sales WHERE "userId" = $1', [req.session.userId]);
        logger.info('All user sales deleted', { deletedCount: result.rowCount, userId: req.session.userId });
        res.json({ success: true, deletedCount: result.rowCount });
    } catch (error) {
        logger.error('Failed to delete sales', { error: error.message });
        res.status(500).json({ error: 'Failed to delete sales' });
    }
});

// Delete all donations (only current user's donations)
app.delete('/api/donations', auth.isAuthenticated, async (req, res) => {
    try {
        const result = await db.run('DELETE FROM donations WHERE "userId" = $1', [req.session.userId]);
        logger.info('All user donations deleted', { deletedCount: result.rowCount, userId: req.session.userId });
        res.json({ success: true, deletedCount: result.rowCount });
    } catch (error) {
        logger.error('Failed to delete donations', { error: error.message });
        res.status(500).json({ error: 'Failed to delete donations' });
    }
});

// Delete all data (only current user's sales and donations)
app.delete('/api/data', auth.isAuthenticated, async (req, res) => {
    try {
        const salesResult = await db.run('DELETE FROM sales WHERE "userId" = $1', [req.session.userId]);
        const donationsResult = await db.run('DELETE FROM donations WHERE "userId" = $1', [req.session.userId]);

        const results = { salesDeleted: salesResult.rowCount, donationsDeleted: donationsResult.rowCount };
        logger.info('All user data cleared', { ...results, userId: req.session.userId });
        res.json({ success: true, ...results });
    } catch (error) {
        logger.error('Failed to clear data', { error: error.message });
        res.status(500).json({ error: 'Failed to clear data' });
    }
});



// ============================================================================
// Troop Management Routes (Phase 2)
// ============================================================================

// Get all troops for current user (as leader) or all troops (as council_admin)
app.get('/api/troop/my-troops', auth.isAuthenticated, async (req, res) => {
    try {
        let troops;
        if (req.session.userRole === 'council_admin') {
            // Council admin sees all troops
            troops = await db.getAll(`
                SELECT t.*, u."firstName" || ' ' || u."lastName" as "leaderName",
                       (SELECT COUNT(*) FROM troop_members WHERE "troopId" = t.id AND status = 'active') as "memberCount"
                FROM troops t
                LEFT JOIN users u ON t."leaderId" = u.id
                WHERE t."isActive" = true
                ORDER BY t."troopNumber"
            `);
        } else {
            // Troop leader sees only their troops
            troops = await db.getAll(`
                SELECT t.*, u."firstName" || ' ' || u."lastName" as "leaderName",
                       (SELECT COUNT(*) FROM troop_members WHERE "troopId" = t.id AND status = 'active') as "memberCount"
                FROM troops t
                LEFT JOIN users u ON t."leaderId" = u.id
                WHERE t."leaderId" = $1 AND t."isActive" = true
                ORDER BY t."troopNumber"
            `, [req.session.userId]);
        }
        res.json(troops);
    } catch (error) {
        logger.error('Error fetching troops', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch troops' });
    }
});

// Get members of a specific troop with sales summaries
app.get('/api/troop/:troopId/members', auth.isAuthenticated, async (req, res) => {
    try {
        const { troopId } = req.params;

        // Verify user has access to this troop
        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get members with their sales summaries
        const members = await db.getAll(`
            SELECT
                u.id, u.email, u."firstName", u."lastName", u."photoUrl",
                tm.role as "troopRole", tm."joinDate", tm.status,
                COALESCE(SUM(s.quantity), 0) as "totalBoxes",
                COALESCE(SUM(s."amountCollected"), 0) as "totalCollected",
                MAX(s.date) as "lastSaleDate"
            FROM troop_members tm
            JOIN users u ON tm."userId" = u.id
            LEFT JOIN sales s ON s."userId" = u.id
            WHERE tm."troopId" = $1 AND tm.status = 'active'
            GROUP BY u.id, tm.role, tm."joinDate", tm.status
            ORDER BY u."lastName", u."firstName"
        `, [troopId]);

        res.json(members);
    } catch (error) {
        logger.error('Error fetching troop members', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch troop members' });
    }
});

// Get aggregated sales data for a troop
app.get('/api/troop/:troopId/sales', auth.isAuthenticated, async (req, res) => {
    try {
        const { troopId } = req.params;

        // Verify user has access to this troop
        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get sales by cookie type
        const salesByCookie = await db.getAll(`
            SELECT
                s."cookieType",
                SUM(s.quantity) as "totalQuantity",
                SUM(s."amountCollected") as "totalCollected"
            FROM sales s
            JOIN troop_members tm ON s."userId" = tm."userId"
            WHERE tm."troopId" = $1 AND tm.status = 'active'
            GROUP BY s."cookieType"
            ORDER BY "totalQuantity" DESC
        `, [troopId]);

        // Get totals
        const totals = await db.getOne(`
            SELECT
                COALESCE(SUM(s.quantity), 0) as "totalBoxes",
                COALESCE(SUM(s."amountCollected"), 0) as "totalCollected",
                COALESCE(SUM(s."amountDue"), 0) as "totalDue"
            FROM sales s
            JOIN troop_members tm ON s."userId" = tm."userId"
            WHERE tm."troopId" = $1 AND tm.status = 'active'
        `, [troopId]);

        res.json({
            salesByCookie,
            totals
        });
    } catch (error) {
        logger.error('Error fetching troop sales', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch troop sales' });
    }
});

// Get troop events (Calendar)
app.get('/api/troop/:troopId/events', auth.isAuthenticated, async (req, res) => {
    try {
        const { troopId } = req.params;
        const { start, end } = req.query; // Optional date range filtering

        // Verify user has access to this troop
        const member = await db.getOne('SELECT * FROM troop_members WHERE "troopId" = $1 AND "userId" = $2 AND status = \'active\'', [troopId, req.session.userId]);
        
        // Also allow if leader or admin
        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        
        const isLeader = troop && (troop.leaderId === req.session.userId || troop.cookieLeaderId === req.session.userId);
        const isAdmin = req.session.userRole === 'council_admin';
        
        if (!member && !isLeader && !isAdmin) {
             return res.status(403).json({ error: 'Access denied' });
        }

        let query = 'SELECT * FROM events WHERE "troopId" = $1';
        const params = [troopId];
        
        if (start && end) {
            query += ' AND "eventDate" BETWEEN $2 AND $3';
            params.push(start, end);
        }
        
        query += ' ORDER BY "eventDate" ASC, "startTime" ASC';

        const events = await db.getAll(query, params);
        res.json(events);
    } catch (error) {
        logger.error('Error fetching troop events', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Export troop events to .ics
app.get('/api/troop/:troopId/calendar/export', auth.isAuthenticated, async (req, res) => {
    try {
        const { troopId } = req.params;
        
        const member = await db.getOne('SELECT * FROM troop_members WHERE "troopId" = $1 AND "userId" = $2 AND status = \'active\'', [troopId, req.session.userId]);
        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        const isLeader = troop && (troop.leaderId === req.session.userId || troop.cookieLeaderId === req.session.userId);
        const isAdmin = req.session.userRole === 'council_admin';

        if (!member && !isLeader && !isAdmin) {
             return res.status(403).json({ error: 'Access denied' });
        }

        const events = await db.getAll('SELECT * FROM events WHERE "troopId" = $1 ORDER BY "eventDate" ASC', [troopId]);

        let icsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Apex Scout Manager//Troop Calendar//EN\r\n';
        
        events.forEach(event => {
            icsContent += 'BEGIN:VEVENT\r\n';
            icsContent += `UID:event-${event.id}@apexscoutmanager\r\n`;

            // Format timestamps (YYYYMMDDTHHmmssZ)
            const dateStr = new Date(event.eventDate).toISOString().replace(/[-:]/g, '').split('T')[0];
            
            if (event.startTime) {
                const timeStr = event.startTime.replace(':', '') + '00';
                icsContent += `DTSTART:${dateStr}T${timeStr}\r\n`;
            } else {
                icsContent += `DTSTART;VALUE=DATE:${dateStr}\r\n`;
            }
            
            if (event.endTime) {
                const timeStr = event.endTime.replace(':', '') + '00';
                icsContent += `DTEND:${dateStr}T${timeStr}\r\n`;
            }

            icsContent += `SUMMARY:${event.eventName} (${event.targetGroup})\r\n`;
            if (event.description) icsContent += `DESCRIPTION:${event.description}\r\n`;
            if (event.location) icsContent += `LOCATION:${event.location}\r\n`;
            
            icsContent += 'END:VEVENT\r\n';
        });

        icsContent += 'END:VCALENDAR';

        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', `attachment; filename="troop-${troopId}-calendar.ics"`);
        res.send(icsContent);

    } catch (error) {
        logger.error('Error exporting calendar', { error: error.message });
        res.status(500).json({ error: 'Failed to export calendar' });
    }
});

// Get troop goals
app.get('/api/troop/:troopId/goals', auth.isAuthenticated, async (req, res) => {
    try {
        const { troopId } = req.params;

        // Verify user has access to this troop
        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const goals = await db.getAll(`
            SELECT * FROM troop_goals
            WHERE "troopId" = $1
            ORDER BY status, "endDate"
        `, [troopId]);

        res.json(goals);
    } catch (error) {
        logger.error('Error fetching troop goals', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch troop goals' });
    }
});

// Create a new troop
app.post('/api/troop', auth.isAuthenticated, auth.hasRole('troop_leader', 'council_admin'), async (req, res) => {
    try {
        const { troopNumber, troopType, meetingLocation, meetingDay, meetingTime } = req.body;

        if (!troopNumber || !troopType) {
            return res.status(400).json({ error: 'Troop number and type are required' });
        }

        const validTypes = ['daisy', 'brownie', 'junior', 'cadette', 'senior', 'ambassador', 'multi-level'];
        if (!validTypes.includes(troopType)) {
            return res.status(400).json({ error: 'Invalid troop type' });
        }

        const newTroop = await db.getOne(`
            INSERT INTO troops ("troopNumber", "troopType", "leaderId", "meetingLocation", "meetingDay", "meetingTime", "isActive", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
            RETURNING *
        `, [
            troopNumber.trim(),
            troopType,
            req.session.userId,
            meetingLocation?.trim() || null,
            meetingDay?.trim() || null,
            meetingTime?.trim() || null
        ]);

        logger.info('Troop created', { troopId: newTroop.id, troopNumber, userId: req.session.userId });
        res.status(201).json(newTroop);
    } catch (error) {
        logger.error('Error creating troop', { error: error.message });
        res.status(500).json({ error: 'Failed to create troop' });
    }
});

// Update a troop
app.put('/api/troop/:troopId', auth.isAuthenticated, async (req, res) => {
    try {
        const { troopId } = req.params;
        const { troopNumber, troopType, meetingLocation, meetingDay, meetingTime, leaderId } = req.body;

        // Verify user has access
        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        await db.run(`
            UPDATE troops SET
                "troopNumber" = COALESCE($1, "troopNumber"),
                "troopType" = COALESCE($2, "troopType"),
                "meetingLocation" = $3,
                "meetingDay" = $4,
                "meetingTime" = $5,
                "leaderId" = COALESCE($6, "leaderId"),
                "updatedAt" = NOW()
            WHERE id = $7
        `, [
            troopNumber?.trim() || null,
            troopType || null,
            meetingLocation?.trim() || null,
            meetingDay?.trim() || null,
            meetingTime?.trim() || null,
            leaderId || null,
            troopId
        ]);

        const updatedTroop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        logger.info('Troop updated', { troopId, userId: req.session.userId });
        res.json(updatedTroop);
    } catch (error) {
        logger.error('Error updating troop', { error: error.message });
        res.status(500).json({ error: 'Failed to update troop' });
    }
});

// Add member to troop
app.post('/api/troop/:troopId/members', auth.isAuthenticated, async (req, res) => {
    try {
        const { troopId } = req.params;
        const { email, role, firstName, lastName, address, dateOfBirth, den, familyInfo, position, level, roles } = req.body;

        // Verify user has access
        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        let user = null;

        // If email provided, try to find existing user
        if (email) {
            user = await db.getOne('SELECT id, "firstName", "lastName", email FROM users WHERE email = $1', [email]);
        }

        // If no user found, create one with the provided name
        if (!user) {
            if (!firstName || !lastName) {
                return res.status(400).json({ error: 'First name and last name are required' });
            }

            // Determine user role based on position
            let userRole = 'scout';
            if (position === 'Troop Leader' || position === 'Co-Leader') {
                userRole = 'troop_leader';
            } else if (position === 'Troop Volunteer') {
                userRole = 'parent'; // closest existing role for volunteers
            }

            const newUser = await db.getOne(`
                INSERT INTO users ("firstName", "lastName", email, role, "isActive", "dateOfBirth")
                VALUES ($1, $2, $3, $4, TRUE, $5)
                RETURNING id, "firstName", "lastName", email
            `, [firstName, lastName, email || null, userRole, dateOfBirth || null]);

            user = newUser;
        }

        // Map position to troop_members role
        let memberRole = 'member';
        if (position === 'Troop Leader') memberRole = 'troop_leader';
        else if (position === 'Co-Leader') memberRole = 'co-leader';
        else if (position === 'Troop Volunteer') memberRole = 'volunteer';
        else if (role) {
            const validRoles = ['member', 'co-leader', 'assistant', 'parent', 'troop_leader', 'volunteer'];
            memberRole = validRoles.includes(role) ? role : 'member';
        }

        // Check if already a member
        const existingMember = await db.getOne('SELECT * FROM troop_members WHERE "troopId" = $1 AND "userId" = $2', [troopId, user.id]);
        if (existingMember) {
            if (existingMember.status === 'active') {
                return res.status(409).json({ error: 'User is already a member of this troop' });
            }
            // Reactivate if previously inactive
            await db.run(`
                UPDATE troop_members
                SET status = 'active', role = $1, "joinDate" = NOW(),
                    "scoutLevel" = $2, position = $3, "additionalRoles" = $4
                WHERE id = $5
            `, [memberRole, level || null, position || null, JSON.stringify(roles || []), existingMember.id]);
        } else {
            // Add new member
            await db.run(`
                INSERT INTO troop_members ("troopId", "userId", role, "scoutLevel", position, "additionalRoles", "joinDate", status)
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'active')
            `, [troopId, user.id, memberRole, level || null, position || null, JSON.stringify(roles || [])]);
        }

        logger.info('Member added to troop', { troopId, userId: user.id, position, level, addedBy: req.session.userId });
        res.status(201).json({ success: true, member: user });
    } catch (error) {
        logger.error('Error adding troop member', { error: error.message });
        res.status(500).json({ error: 'Failed to add member' });
    }
});

// Add new scout with parent information to troop
app.post('/api/troop/:troopId/members/scout', auth.isAuthenticated, async (req, res) => {
    try {
        const { troopId } = req.params;
        const {
            scoutFirstName,
            scoutLastName,
            scoutLevel,
            scoutDateOfBirth,
            parentFirstName,
            parentLastName,
            parentEmail,
            parentPhone,
            parentRole,
            secondaryParentFirstName,
            secondaryParentLastName,
            secondaryParentEmail,
            secondaryParentPhone,
            secondaryParentRole
        } = req.body;

        // Validate required fields
        if (!scoutFirstName || !scoutLastName) {
            return res.status(400).json({ error: 'Scout first and last name are required' });
        }
        if (!parentFirstName || !parentLastName) {
            return res.status(400).json({ error: 'Parent first and last name are required' });
        }
        if (!parentRole) {
            return res.status(400).json({ error: 'Parent role is required' });
        }

        // Verify user has access to manage this troop
        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Use transaction for multi-step operation
        const result = await db.transaction(async (client) => {
            let parentUserId = null;
            let secondaryParentUserId = null;

            // Create or find primary parent account
            if (parentEmail) {
                // Check if parent already exists by email
                const existingParent = await client.query('SELECT id FROM users WHERE email = $1', [parentEmail]);
                if (existingParent.rows.length > 0) {
                    parentUserId = existingParent.rows[0].id;
                } else {
                    // Create new parent account
                    const parentResult = await client.query(`
                        INSERT INTO users ("firstName", "lastName", email, role, "isActive", "createdAt")
                        VALUES ($1, $2, $3, 'parent', true, NOW())
                        RETURNING id
                    `, [parentFirstName, parentLastName, parentEmail]);
                    parentUserId = parentResult.rows[0].id;
                }
            } else {
                // Create parent account without email (can't login until email added)
                const parentResult = await client.query(`
                    INSERT INTO users ("firstName", "lastName", email, role, "isActive", "createdAt")
                    VALUES ($1, $2, NULL, 'parent', true, NOW())
                    RETURNING id
                `, [parentFirstName, parentLastName]);
                parentUserId = parentResult.rows[0].id;
            }

            // Create secondary parent if provided
            if (secondaryParentFirstName && secondaryParentLastName) {
                if (secondaryParentEmail) {
                    // Check if secondary parent already exists by email
                    const existingSecondary = await client.query('SELECT id FROM users WHERE email = $1', [secondaryParentEmail]);
                    if (existingSecondary.rows.length > 0) {
                        secondaryParentUserId = existingSecondary.rows[0].id;
                    } else {
                        // Create new secondary parent account
                        const secondaryResult = await client.query(`
                            INSERT INTO users ("firstName", "lastName", email, role, "isActive", "createdAt")
                            VALUES ($1, $2, $3, 'parent', true, NOW())
                            RETURNING id
                        `, [secondaryParentFirstName, secondaryParentLastName, secondaryParentEmail]);
                        secondaryParentUserId = secondaryResult.rows[0].id;
                    }
                } else {
                    // Create secondary parent account without email
                    const secondaryResult = await client.query(`
                        INSERT INTO users ("firstName", "lastName", email, role, "isActive", "createdAt")
                        VALUES ($1, $2, NULL, 'parent', true, NOW())
                        RETURNING id
                    `, [secondaryParentFirstName, secondaryParentLastName]);
                    secondaryParentUserId = secondaryResult.rows[0].id;
                }
            }

            // Create scout account (no email required)
            const scoutResult = await client.query(`
                INSERT INTO users ("firstName", "lastName", email, role, "dateOfBirth", "isActive", "createdAt")
                VALUES ($1, $2, NULL, 'scout', $3, true, NOW())
                RETURNING id
            `, [scoutFirstName, scoutLastName, scoutDateOfBirth || null]);
            const scoutUserId = scoutResult.rows[0].id;

            // Add scout to troop
            await client.query(`
                INSERT INTO troop_members ("troopId", "userId", role, "scoutLevel", "linkedParentId", "parentRole", "joinDate", status)
                VALUES ($1, $2, 'member', $3, $4, $5, NOW(), 'active')
            `, [troopId, scoutUserId, scoutLevel || null, parentUserId, parentRole]);

            // Add primary parent to troop
            await client.query(`
                INSERT INTO troop_members ("troopId", "userId", role, "linkedParentId", "parentRole", "joinDate", status)
                VALUES ($1, $2, 'parent', $3, $4, NOW(), 'active')
            `, [troopId, parentUserId, scoutUserId, parentRole]);

            // Add secondary parent to troop if provided
            if (secondaryParentUserId) {
                await client.query(`
                    INSERT INTO troop_members ("troopId", "userId", role, "linkedParentId", "parentRole", "joinDate", status)
                    VALUES ($1, $2, 'parent', $3, $4, NOW(), 'active')
                `, [troopId, secondaryParentUserId, scoutUserId, secondaryParentRole || 'parent']);
            }

            logger.info('Scout and parent(s) added to troop', {
                troopId,
                scoutId: scoutUserId,
                parentId: parentUserId,
                secondaryParentId: secondaryParentUserId,
                addedBy: req.session.userId
            });

            return {
                success: true,
                scout: {
                    id: scoutUserId,
                    firstName: scoutFirstName,
                    lastName: scoutLastName,
                    level: scoutLevel
                },
                parent: {
                    id: parentUserId,
                    firstName: parentFirstName,
                    lastName: parentLastName,
                    role: parentRole,
                    email: parentEmail
                },
                secondaryParent: secondaryParentUserId ? {
                    id: secondaryParentUserId,
                    firstName: secondaryParentFirstName,
                    lastName: secondaryParentLastName,
                    role: secondaryParentRole
                } : null
            };
        });

        res.status(201).json(result);

    } catch (error) {
        logger.error('Error adding scout to troop', { error: error.message });
        res.status(500).json({ error: 'Failed to add scout' });
    }
});

// Remove member from troop
app.delete('/api/troop/:troopId/members/:userId', auth.isAuthenticated, async (req, res) => {
    try {
        const { troopId, userId } = req.params;

        // Verify user has access
        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Set member as inactive (soft delete)
        const result = await db.run(`
            UPDATE troop_members SET status = 'inactive', "leaveDate" = NOW()
            WHERE "troopId" = $1 AND "userId" = $2
        `, [troopId, userId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Member not found in this troop' });
        }

        logger.info('Member removed from troop', { troopId, userId, removedBy: req.session.userId });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error removing troop member', { error: error.message });
        res.status(500).json({ error: 'Failed to remove member' });
    }
});

// Create troop goal
app.post('/api/troop/:troopId/goals', auth.isAuthenticated, async (req, res) => {
    try {
        const { troopId } = req.params;
        const { goalType, targetAmount, startDate, endDate, description } = req.body;

        // Verify user has access
        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const validGoalTypes = ['boxes_sold', 'revenue', 'participation', 'events', 'donations'];
        if (!validGoalTypes.includes(goalType)) {
            return res.status(400).json({ error: 'Invalid goal type' });
        }

        const newGoal = await db.getOne(`
            INSERT INTO troop_goals ("troopId", "goalType", "targetAmount", "startDate", "endDate", description, status, "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, 'in_progress', NOW(), NOW())
            RETURNING *
        `, [troopId, goalType, targetAmount, startDate, endDate, description || null]);

        logger.info('Troop goal created', { goalId: newGoal.id, troopId, goalType });
        res.status(201).json(newGoal);
    } catch (error) {
        logger.error('Error creating troop goal', { error: error.message });
        res.status(500).json({ error: 'Failed to create goal' });
    }
});

// Get all users (for adding members) - council_admin or troop_leader
app.get('/api/users/search', auth.isAuthenticated, auth.hasRole('troop_leader', 'council_admin'), async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json([]);
        }

        const users = await db.getAll(`
            SELECT id, email, "firstName", "lastName", role
            FROM users
            WHERE (email ILIKE $1 OR "firstName" ILIKE $1 OR "lastName" ILIKE $1)
            AND "isActive" = true
            LIMIT 10
        `, [`%${q}%`]);

        res.json(users);
    } catch (error) {
        logger.error('Error searching users', { error: error.message });
        res.status(500).json({ error: 'Failed to search users' });
    }
});

// ============================================================================
// Phase 3: Cookie Catalog and Season Management Routes
// ============================================================================

// Get active season
app.get('/api/seasons/active', auth.isAuthenticated, async (req, res) => {
    try {
        const season = await db.getOne('SELECT * FROM seasons WHERE "isActive" = true');
        res.json(season || null);
    } catch (error) {
        logger.error('Error fetching active season', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch active season' });
    }
});

// Get all seasons
app.get('/api/seasons', auth.isAuthenticated, async (req, res) => {
    try {
        const seasons = await db.getAll(`
            SELECT s.*,
                   (SELECT COUNT(*) FROM cookie_products WHERE season = s.year) as "cookieCount"
            FROM seasons s
            ORDER BY s.year DESC
        `);
        res.json(seasons);
    } catch (error) {
        logger.error('Error fetching seasons', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch seasons' });
    }
});

// Create new season
app.post('/api/seasons', auth.isAuthenticated, auth.hasRole('council_admin'), async (req, res) => {
    try {
        const { year, name, startDate, endDate, pricePerBox, copyFromYear } = req.body;

        if (!year || !name || !startDate || !endDate) {
            return res.status(400).json({ error: 'Year, name, start date, and end date are required' });
        }

        // Check if season already exists
        const existing = await db.getOne('SELECT id FROM seasons WHERE year = $1', [year]);
        if (existing) {
            return res.status(409).json({ error: 'Season already exists' });
        }

        // Create season
        const newSeason = await db.getOne(`
            INSERT INTO seasons (year, name, "startDate", "endDate", "pricePerBox", "isActive", "createdAt")
            VALUES ($1, $2, $3, $4, $5, false, NOW())
            RETURNING *
        `, [year, name, startDate, endDate, pricePerBox || 6.00]);

        // Copy cookies from another season if specified
        if (copyFromYear) {
            const cookiesToCopy = await db.getAll(`
                SELECT "cookieName", "shortName", description, "pricePerBox", "boxesPerCase", "sortOrder", "imageUrl"
                FROM cookie_products WHERE season = $1
            `, [copyFromYear]);

            for (const cookie of cookiesToCopy) {
                await db.run(`
                    INSERT INTO cookie_products (season, "cookieName", "shortName", description, "pricePerBox", "boxesPerCase", "sortOrder", "imageUrl", "isActive")
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
                `, [year, cookie.cookieName, cookie.shortName, cookie.description,
                    cookie.pricePerBox, cookie.boxesPerCase, cookie.sortOrder, cookie.imageUrl]);
            }

            logger.info('Copied cookies from previous season', { fromYear: copyFromYear, toYear: year, count: cookiesToCopy.length });
        }

        logger.info('Season created', { year, name });
        res.status(201).json(newSeason);
    } catch (error) {
        logger.error('Error creating season', { error: error.message });
        res.status(500).json({ error: 'Failed to create season' });
    }
});

// Activate a season
app.put('/api/seasons/:year/activate', auth.isAuthenticated, auth.hasRole('council_admin'), async (req, res) => {
    try {
        const { year } = req.params;

        // Deactivate all seasons
        await db.run('UPDATE seasons SET "isActive" = false');

        // Activate specified season
        const result = await db.run('UPDATE seasons SET "isActive" = true, "updatedAt" = NOW() WHERE year = $1', [year]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Season not found' });
        }

        logger.info('Season activated', { year });
        res.json({ success: true, year });
    } catch (error) {
        logger.error('Error activating season', { error: error.message });
        res.status(500).json({ error: 'Failed to activate season' });
    }
});

// Get all cookies for a season (or active season if not specified)
app.get('/api/cookies', auth.isAuthenticated, async (req, res) => {
    try {
        const { season, includeInactive } = req.query;

        // Get season to query
        let targetSeason = season;
        if (!targetSeason) {
            const active = await db.getOne('SELECT year FROM seasons WHERE "isActive" = true');
            targetSeason = active?.year || '2026';
        }

        // Build query - using PostgreSQL json_agg instead of SQLite json_group_array
        let query = `
            SELECT cp.*,
                   COALESCE(
                       json_agg(
                           json_build_object('id', ca.id, 'type', ca."attributeType", 'value', ca."attributeValue", 'label', ca."displayLabel")
                       ) FILTER (WHERE ca.id IS NOT NULL),
                       '[]'::json
                   ) as "attributesJson"
            FROM cookie_products cp
            LEFT JOIN cookie_attributes ca ON cp.id = ca."productId"
            WHERE cp.season = $1
        `;

        if (!includeInactive) {
            query += ' AND cp."isActive" = true';
        }

        query += ' GROUP BY cp.id ORDER BY cp."sortOrder", cp."cookieName"';

        const cookies = await db.getAll(query, [targetSeason]);

        // Parse attributes JSON
        const result = cookies.map(cookie => {
            let attributes = [];
            try {
                const parsed = typeof cookie.attributesJson === 'string' ? JSON.parse(cookie.attributesJson) : cookie.attributesJson;
                attributes = Array.isArray(parsed) ? parsed.filter(a => a.id !== null) : [];
            } catch (e) {
                attributes = [];
            }
            delete cookie.attributesJson;
            return { ...cookie, attributes };
        });

        res.json(result);
    } catch (error) {
        logger.error('Error fetching cookies', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch cookies' });
    }
});

// Get single cookie with nutrition info
app.get('/api/cookies/:id', auth.isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        const cookie = await db.getOne('SELECT * FROM cookie_products WHERE id = $1', [id]);
        if (!cookie) {
            return res.status(404).json({ error: 'Cookie not found' });
        }

        const attributes = await db.getAll('SELECT * FROM cookie_attributes WHERE "productId" = $1', [id]);
        const nutrition = await db.getOne('SELECT * FROM cookie_nutrition WHERE "productId" = $1', [id]);

        res.json({ ...cookie, attributes, nutrition });
    } catch (error) {
        logger.error('Error fetching cookie', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch cookie' });
    }
});

// Add new cookie
app.post('/api/cookies', auth.isAuthenticated, auth.hasRole('troop_leader', 'council_admin'), async (req, res) => {
    try {
        const { season, cookieName, shortName, description, pricePerBox, boxesPerCase, sortOrder, imageUrl, attributes, nutrition } = req.body;

        if (!season || !cookieName) {
            return res.status(400).json({ error: 'Season and cookie name are required' });
        }

        // Insert cookie
        const newCookie = await db.getOne(`
            INSERT INTO cookie_products (season, "cookieName", "shortName", description, "pricePerBox", "boxesPerCase", "sortOrder", "imageUrl", "isActive", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW())
            RETURNING *
        `, [season, cookieName, shortName || null, description || null, pricePerBox || 6.00, boxesPerCase || 12, sortOrder || 0, imageUrl || null]);

        const productId = newCookie.id;

        // Insert attributes if provided
        if (attributes && Array.isArray(attributes)) {
            for (const attr of attributes) {
                await db.run(`
                    INSERT INTO cookie_attributes ("productId", "attributeType", "attributeValue", "displayLabel")
                    VALUES ($1, $2, $3, $4)
                `, [productId, attr.type, attr.value, attr.label || null]);
            }
        }

        // Insert nutrition if provided
        if (nutrition) {
            await db.run(`
                INSERT INTO cookie_nutrition ("productId", "servingSize", "servingsPerBox", calories, "totalFat", "saturatedFat", "transFat", cholesterol, sodium, "totalCarbs", "dietaryFiber", sugars, protein, ingredients)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `, [productId, nutrition.servingSize, nutrition.servingsPerBox, nutrition.calories, nutrition.totalFat, nutrition.saturatedFat, nutrition.transFat, nutrition.cholesterol, nutrition.sodium, nutrition.totalCarbs, nutrition.dietaryFiber, nutrition.sugars, nutrition.protein, nutrition.ingredients]);
        }

        logger.info('Cookie created', { productId, cookieName, season });
        res.status(201).json(newCookie);
    } catch (error) {
        logger.error('Error creating cookie', { error: error.message });
        res.status(500).json({ error: 'Failed to create cookie' });
    }
});

// Update cookie
app.put('/api/cookies/:id', auth.isAuthenticated, auth.hasRole('troop_leader', 'council_admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { cookieName, shortName, description, pricePerBox, boxesPerCase, sortOrder, imageUrl, isActive, attributes, nutrition } = req.body;

        const existing = await db.getOne('SELECT id FROM cookie_products WHERE id = $1', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Cookie not found' });
        }

        // Update cookie
        await db.run(`
            UPDATE cookie_products SET
                "cookieName" = COALESCE($1, "cookieName"),
                "shortName" = COALESCE($2, "shortName"),
                description = COALESCE($3, description),
                "pricePerBox" = COALESCE($4, "pricePerBox"),
                "boxesPerCase" = COALESCE($5, "boxesPerCase"),
                "sortOrder" = COALESCE($6, "sortOrder"),
                "imageUrl" = COALESCE($7, "imageUrl"),
                "isActive" = COALESCE($8, "isActive"),
                "updatedAt" = NOW()
            WHERE id = $9
        `, [cookieName, shortName, description, pricePerBox, boxesPerCase, sortOrder, imageUrl, isActive, id]);

        // Update attributes if provided (replace all)
        if (attributes && Array.isArray(attributes)) {
            await db.run('DELETE FROM cookie_attributes WHERE "productId" = $1', [id]);
            for (const attr of attributes) {
                await db.run(`
                    INSERT INTO cookie_attributes ("productId", "attributeType", "attributeValue", "displayLabel")
                    VALUES ($1, $2, $3, $4)
                `, [id, attr.type, attr.value, attr.label || null]);
            }
        }

        // Update nutrition if provided
        if (nutrition) {
            await db.run('DELETE FROM cookie_nutrition WHERE "productId" = $1', [id]);
            await db.run(`
                INSERT INTO cookie_nutrition ("productId", "servingSize", "servingsPerBox", calories, "totalFat", "saturatedFat", "transFat", cholesterol, sodium, "totalCarbs", "dietaryFiber", sugars, protein, ingredients)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `, [id, nutrition.servingSize, nutrition.servingsPerBox, nutrition.calories, nutrition.totalFat, nutrition.saturatedFat, nutrition.transFat, nutrition.cholesterol, nutrition.sodium, nutrition.totalCarbs, nutrition.dietaryFiber, nutrition.sugars, nutrition.protein, nutrition.ingredients]);
        }

        const updatedCookie = await db.getOne('SELECT * FROM cookie_products WHERE id = $1', [id]);
        logger.info('Cookie updated', { id });
        res.json(updatedCookie);
    } catch (error) {
        logger.error('Error updating cookie', { error: error.message });
        res.status(500).json({ error: 'Failed to update cookie' });
    }
});

// Deactivate cookie (soft delete)
app.delete('/api/cookies/:id', auth.isAuthenticated, auth.hasRole('troop_leader', 'council_admin'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.run('UPDATE cookie_products SET "isActive" = false, "updatedAt" = NOW() WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Cookie not found' });
        }

        logger.info('Cookie deactivated', { id });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error deactivating cookie', { error: error.message });
        res.status(500).json({ error: 'Failed to deactivate cookie' });
    }
});

// ============================================================================
// Phase 3: Enhanced Troop Goal Routes
// ============================================================================

// Update troop goal
app.put('/api/troop/:troopId/goals/:goalId', auth.isAuthenticated, async (req, res) => {
    try {
        const { troopId, goalId } = req.params;
        const { targetAmount, startDate, endDate, status, description } = req.body;

        // Verify user has access
        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check goal exists
        const goal = await db.getOne('SELECT * FROM troop_goals WHERE id = $1 AND "troopId" = $2', [goalId, troopId]);
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        await db.run(`
            UPDATE troop_goals SET
                "targetAmount" = COALESCE($1, "targetAmount"),
                "startDate" = COALESCE($2, "startDate"),
                "endDate" = COALESCE($3, "endDate"),
                status = COALESCE($4, status),
                description = COALESCE($5, description),
                "updatedAt" = NOW()
            WHERE id = $6
        `, [targetAmount, startDate, endDate, status, description, goalId]);

        const updatedGoal = await db.getOne('SELECT * FROM troop_goals WHERE id = $1', [goalId]);
        logger.info('Troop goal updated', { goalId, troopId });
        res.json(updatedGoal);
    } catch (error) {
        logger.error('Error updating troop goal', { error: error.message });
        res.status(500).json({ error: 'Failed to update goal' });
    }
});

// Delete troop goal
app.delete('/api/troop/:troopId/goals/:goalId', auth.isAuthenticated, async (req, res) => {
    try {
        const { troopId, goalId } = req.params;

        // Verify user has access
        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await db.run('DELETE FROM troop_goals WHERE id = $1 AND "troopId" = $2', [goalId, troopId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        logger.info('Troop goal deleted', { goalId, troopId });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error deleting troop goal', { error: error.message });
        res.status(500).json({ error: 'Failed to delete goal' });
    }
});

// Get troop goal progress
app.get('/api/troop/:troopId/goals/progress', auth.isAuthenticated, async (req, res) => {
    try {
        const { troopId } = req.params;

        // Verify user has access
        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const goals = await db.getAll('SELECT * FROM troop_goals WHERE "troopId" = $1', [troopId]);

        // Calculate actual amounts for each goal
        const goalsWithProgress = await Promise.all(goals.map(async (goal) => {
            let actualAmount = 0;

            switch (goal.goalType) {
                case 'boxes_sold':
                case 'total_boxes':
                    const boxesResult = await db.getOne(`
                        SELECT COALESCE(SUM(CASE WHEN s."unitType" = 'case' THEN s.quantity * 12 ELSE s.quantity END), 0) as total
                        FROM sales s
                        JOIN troop_members tm ON s."userId" = tm."userId"
                        WHERE tm."troopId" = $1 AND tm.status = 'active'
                        AND s.date BETWEEN $2 AND $3
                    `, [troopId, goal.startDate, goal.endDate]);
                    actualAmount = Number(boxesResult?.total || 0);
                    break;

                case 'revenue':
                case 'total_revenue':
                    const revenueResult = await db.getOne(`
                        SELECT COALESCE(SUM(s."amountCollected"), 0) as total
                        FROM sales s
                        JOIN troop_members tm ON s."userId" = tm."userId"
                        WHERE tm."troopId" = $1 AND tm.status = 'active'
                        AND s.date BETWEEN $2 AND $3
                    `, [troopId, goal.startDate, goal.endDate]);
                    actualAmount = Number(revenueResult?.total || 0);
                    break;

                case 'participation':
                    const totalMembers = await db.getOne(`
                        SELECT COUNT(*) as count FROM troop_members WHERE "troopId" = $1 AND status = 'active'
                    `, [troopId]);
                    const activeMembers = await db.getOne(`
                        SELECT COUNT(DISTINCT tm."userId") as count
                        FROM troop_members tm
                        JOIN sales s ON s."userId" = tm."userId"
                        WHERE tm."troopId" = $1 AND tm.status = 'active'
                        AND s.date BETWEEN $2 AND $3
                    `, [troopId, goal.startDate, goal.endDate]);
                    actualAmount = Number(totalMembers?.count || 0) > 0
                        ? Math.round((Number(activeMembers?.count || 0) / Number(totalMembers.count)) * 100)
                        : 0;
                    break;

                case 'events':
                case 'event_count':
                    const eventsResult = await db.getOne(`
                        SELECT COUNT(*) as count FROM events
                        WHERE "troopId" = $1 AND "eventDate" BETWEEN $2 AND $3
                    `, [troopId, goal.startDate, goal.endDate]);
                    actualAmount = Number(eventsResult?.count || 0);
                    break;

                case 'donations':
                    const donationsResult = await db.getOne(`
                        SELECT COALESCE(SUM(d.amount), 0) as total
                        FROM donations d
                        JOIN troop_members tm ON d."userId" = tm."userId"
                        WHERE tm."troopId" = $1 AND tm.status = 'active'
                        AND d.date BETWEEN $2 AND $3
                    `, [troopId, goal.startDate, goal.endDate]);
                    actualAmount = Number(donationsResult?.total || 0);
                    break;
            }

            const progress = goal.targetAmount > 0 ? Math.min((actualAmount / goal.targetAmount) * 100, 100) : 0;

            return {
                ...goal,
                actualAmount,
                progress: Math.round(progress * 10) / 10
            };
        }));

        res.json(goalsWithProgress);
    } catch (error) {
        logger.error('Error fetching goal progress', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch goal progress' });
    }
});

// ============================================================================
// Phase 3: Leaderboard Route
// ============================================================================

app.get('/api/troop/:troopId/leaderboard', auth.isAuthenticated, async (req, res) => {
    try {
        const { troopId } = req.params;
        const { limit = 10, metric = 'boxes' } = req.query;

        // Verify user has access
        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const orderBy = metric === 'revenue' ? '"totalRevenue"' : '"totalBoxes"';

        const leaderboard = await db.getAll(`
            SELECT
                u.id, u."firstName", u."lastName", u."photoUrl",
                COALESCE(SUM(CASE WHEN s."unitType" = 'case' THEN s.quantity * 12 ELSE s.quantity END), 0) as "totalBoxes",
                COALESCE(SUM(s."amountCollected"), 0) as "totalRevenue"
            FROM troop_members tm
            JOIN users u ON tm."userId" = u.id
            LEFT JOIN sales s ON s."userId" = u.id
            WHERE tm."troopId" = $1 AND tm.status = 'active'
            GROUP BY u.id, u."firstName", u."lastName", u."photoUrl"
            ORDER BY ${orderBy} DESC
            LIMIT $2
        `, [troopId, parseInt(limit)]);

        // Add rank
        const rankedLeaderboard = leaderboard.map((member, index) => ({
            ...member,
            rank: index + 1
        }));

        res.json(rankedLeaderboard);
    } catch (error) {
        logger.error('Error fetching leaderboard', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// ============================================================================
// Phase 3: Member Role Update Route
// ============================================================================

app.put('/api/troop/:troopId/members/:userId', auth.isAuthenticated, async (req, res) => {
    try {
        const { troopId, userId } = req.params;
        const { role, linkedScoutId, notes } = req.body;

        // Verify user has access
        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check member exists
        const member = await db.getOne('SELECT * FROM troop_members WHERE "troopId" = $1 AND "userId" = $2', [troopId, userId]);
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }

        // Validate role if provided
        const validRoles = ['member', 'scout', 'parent', 'co-leader', 'assistant', 'cookie_leader'];
        if (role && !validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        await db.run(`
            UPDATE troop_members SET
                role = COALESCE($1, role),
                "linkedScoutId" = COALESCE($2, "linkedScoutId"),
                notes = COALESCE($3, notes)
            WHERE "troopId" = $4 AND "userId" = $5
        `, [role, linkedScoutId, notes, troopId, userId]);

        const updatedMember = await db.getOne(`
            SELECT tm.*, u."firstName", u."lastName", u.email
            FROM troop_members tm
            JOIN users u ON tm."userId" = u.id
            WHERE tm."troopId" = $1 AND tm."userId" = $2
        `, [troopId, userId]);

        logger.info('Troop member updated', { troopId, userId });
        res.json(updatedMember);
    } catch (error) {
        logger.error('Error updating troop member', { error: error.message });
        res.status(500).json({ error: 'Failed to update member' });
    }
});

// ============================================================================
// Phase 3: Invitation System Routes
// ============================================================================

// Send invitation
app.post('/api/troop/:troopId/invite', auth.isAuthenticated, async (req, res) => {
    try {
        const { troopId } = req.params;
        const { email, role } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Verify user has access
        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check if user exists
        const user = await db.getOne('SELECT id FROM users WHERE email = $1', [email]);

        // Check for existing pending invitation
        const existingInvite = await db.getOne(`
            SELECT id FROM troop_invitations
            WHERE "troopId" = $1 AND "invitedEmail" = $2 AND status = 'pending'
        `, [troopId, email]);

        if (existingInvite) {
            return res.status(409).json({ error: 'Pending invitation already exists for this email' });
        }

        // Generate unique token
        const token = require('crypto').randomBytes(32).toString('hex');

        // Set expiry (7 days)
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        // Validate role
        const validRoles = ['member', 'scout', 'parent', 'co-leader', 'assistant', 'cookie_leader'];
        const inviteRole = validRoles.includes(role) ? role : 'member';

        // Create invitation
        const newInvite = await db.getOne(`
            INSERT INTO troop_invitations ("troopId", "invitedEmail", "invitedUserId", "invitedRole", "invitedBy", token, "expiresAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [troopId, email.toLowerCase(), user?.id || null, inviteRole, req.session.userId, token, expiresAt]);

        // Create notification for user if they exist
        if (user) {
            auth.createNotification(
                db,
                user.id,
                'info',
                'Troop Invitation',
                `You've been invited to join Troop ${troop.troopNumber} as a ${inviteRole}.`,
                `/invitations`
            );
        }

        logger.info('Invitation sent', { troopId, email, invitedBy: req.session.userId });
        res.status(201).json({
            success: true,
            message: user ? 'Invitation sent to existing user' : 'Invitation sent (user will receive it after registration)',
            invitationId: newInvite.id
        });
    } catch (error) {
        logger.error('Error sending invitation', { error: error.message });
        res.status(500).json({ error: 'Failed to send invitation' });
    }
});

// Get user's pending invitations
app.get('/api/invitations', auth.isAuthenticated, async (req, res) => {
    try {
        const user = await db.getOne('SELECT email FROM users WHERE id = $1', [req.session.userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const invitations = await db.getAll(`
            SELECT ti.*, t."troopNumber", t."troopType", t."troopName",
                   u."firstName" as "inviterFirstName", u."lastName" as "inviterLastName"
            FROM troop_invitations ti
            JOIN troops t ON ti."troopId" = t.id
            JOIN users u ON ti."invitedBy" = u.id
            WHERE (ti."invitedUserId" = $1 OR LOWER(ti."invitedEmail") = LOWER($2))
            AND ti.status = 'pending'
            AND ti."expiresAt" > NOW()
            ORDER BY ti."createdAt" DESC
        `, [req.session.userId, user.email]);

        res.json(invitations);
    } catch (error) {
        logger.error('Error fetching invitations', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch invitations' });
    }
});

// Accept invitation
app.post('/api/invitations/:id/accept', auth.isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        const user = await db.getOne('SELECT id, email FROM users WHERE id = $1', [req.session.userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get invitation
        const invitation = await db.getOne(`
            SELECT * FROM troop_invitations WHERE id = $1
        `, [id]);

        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        // Verify invitation belongs to user
        if (invitation.invitedUserId !== user.id && invitation.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
            return res.status(403).json({ error: 'This invitation is not for you' });
        }

        // Check if expired
        if (new Date(invitation.expiresAt) < new Date()) {
            await db.run('UPDATE troop_invitations SET status = $1 WHERE id = $2', ['expired', id]);
            return res.status(410).json({ error: 'Invitation has expired' });
        }

        // Check if already a member
        const existingMember = await db.getOne(`
            SELECT id FROM troop_members WHERE "troopId" = $1 AND "userId" = $2 AND status = 'active'
        `, [invitation.troopId, user.id]);

        if (existingMember) {
            return res.status(409).json({ error: 'You are already a member of this troop' });
        }

        // Add to troop
        await db.run(`
            INSERT INTO troop_members ("troopId", "userId", role, status, "joinDate")
            VALUES ($1, $2, $3, 'active', NOW())
            ON CONFLICT ("troopId", "userId") DO UPDATE SET status = 'active', role = $3, "joinDate" = NOW()
        `, [invitation.troopId, user.id, invitation.invitedRole]);

        // Update invitation status
        await db.run(`
            UPDATE troop_invitations SET status = 'accepted', "respondedAt" = NOW()
            WHERE id = $1
        `, [id]);

        // Notify troop leader
        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [invitation.troopId]);
        if (troop?.leaderId) {
            auth.createNotification(
                db,
                troop.leaderId,
                'success',
                'Invitation Accepted',
                `${user.email} has joined Troop ${troop.troopNumber}.`
            );
        }

        logger.info('Invitation accepted', { invitationId: id, userId: user.id, troopId: invitation.troopId });
        res.json({ success: true, message: 'You have joined the troop!' });
    } catch (error) {
        logger.error('Error accepting invitation', { error: error.message });
        res.status(500).json({ error: 'Failed to accept invitation' });
    }
});

// Decline invitation
app.post('/api/invitations/:id/decline', auth.isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        const user = await db.getOne('SELECT id, email FROM users WHERE id = $1', [req.session.userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get invitation
        const invitation = await db.getOne('SELECT * FROM troop_invitations WHERE id = $1', [id]);

        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        // Verify invitation belongs to user
        if (invitation.invitedUserId !== user.id && invitation.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
            return res.status(403).json({ error: 'This invitation is not for you' });
        }

        // Update invitation status
        await db.run(`
            UPDATE troop_invitations SET status = 'declined', "respondedAt" = NOW()
            WHERE id = $1
        `, [id]);

        logger.info('Invitation declined', { invitationId: id, userId: user.id });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error declining invitation', { error: error.message });
        res.status(500).json({ error: 'Failed to decline invitation' });
    }
});

// ============================================================================
// Phase 3: Roster Bulk Import Route
// ============================================================================

app.post('/api/troop/:troopId/roster/import', auth.isAuthenticated, upload.single('file'), async (req, res) => {
    try {
        const { troopId } = req.params;

        // Verify user has access
        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Parse CSV
        const csvContent = req.file.buffer.toString('utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
            return res.status(400).json({ error: 'CSV file must have at least a header and one data row' });
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        // Validate required headers
        const requiredHeaders = ['firstname', 'lastname', 'email'];
        for (const required of requiredHeaders) {
            if (!headers.includes(required)) {
                return res.status(400).json({ error: `Missing required column: ${required}` });
            }
        }

        const results = { created: 0, skipped: 0, errors: [] };

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            headers.forEach((header, idx) => {
                row[header] = values[idx] || '';
            });

            try {
                // Check if user already exists
                let user = await db.getOne('SELECT id FROM users WHERE email = $1', [row.email]);

                if (!user) {
                    // Create user
                    const isMinorValue = row.dateofbirth ? auth.isMinor(row.dateofbirth) : false;
                    const tempPassword = require('crypto').randomBytes(16).toString('hex');
                    const passwordHash = await auth.hashPassword(tempPassword);

                    user = await db.getOne(`
                        INSERT INTO users (email, password_hash, "firstName", "lastName", "dateOfBirth", "isMinor", "parentEmail", role, "isActive", "emailVerified")
                        VALUES ($1, $2, $3, $4, $5, $6, $7, 'scout', true, false)
                        RETURNING id
                    `, [
                        row.email,
                        passwordHash,
                        row.firstname,
                        row.lastname,
                        row.dateofbirth || null,
                        isMinorValue,
                        row.parentemail || null
                    ]);

                    // Create profile
                    await db.run(`
                        INSERT INTO profile ("userId", "scoutName", email)
                        VALUES ($1, $2, $3)
                    `, [user.id, `${row.firstname} ${row.lastname}`.trim(), row.email]);
                }

                // Check if already member
                const existingMember = await db.getOne(`
                    SELECT id FROM troop_members WHERE "troopId" = $1 AND "userId" = $2
                `, [troopId, user.id]);

                if (existingMember) {
                    results.skipped++;
                } else {
                    // Add to troop
                    await db.run(`
                        INSERT INTO troop_members ("troopId", "userId", role, status, "joinDate")
                        VALUES ($1, $2, 'member', 'active', NOW())
                    `, [troopId, user.id]);

                    results.created++;
                }

                // Handle parent linking if parent email provided
                if (row.parentemail && row.parentfirstname && row.parentlastname) {
                    let parent = await db.getOne('SELECT id FROM users WHERE email = $1', [row.parentemail]);

                    if (!parent) {
                        const tempPassword = require('crypto').randomBytes(16).toString('hex');
                        const passwordHash = await auth.hashPassword(tempPassword);

                        parent = await db.getOne(`
                            INSERT INTO users (email, password_hash, "firstName", "lastName", role, "isActive", "emailVerified")
                            VALUES ($1, $2, $3, $4, 'parent', true, false)
                            RETURNING id
                        `, [row.parentemail, passwordHash, row.parentfirstname, row.parentlastname]);
                    }

                    // Add parent to troop with linkedScoutId
                    const existingParentMember = await db.getOne(`
                        SELECT id FROM troop_members WHERE "troopId" = $1 AND "userId" = $2
                    `, [troopId, parent.id]);

                    if (!existingParentMember) {
                        await db.run(`
                            INSERT INTO troop_members ("troopId", "userId", role, "linkedScoutId", status, "joinDate")
                            VALUES ($1, $2, 'parent', $3, 'active', NOW())
                        `, [troopId, parent.id, user.id]);
                    }
                }

            } catch (rowError) {
                results.errors.push({ row: i + 1, error: rowError.message });
            }
        }

        logger.info('Roster import completed', { troopId, ...results });
        res.json(results);
    } catch (error) {
        logger.error('Error importing roster', { error: error.message });
        res.status(500).json({ error: 'Failed to import roster' });
    }
});

// ==============================================
// PHASE 3.1: SCOUT PROFILE MANAGEMENT ENDPOINTS
// ==============================================

// GET /api/organizations
// List all scout organizations
app.get('/api/organizations', auth.isAuthenticated, async (req, res) => {
    try {
        const organizations = await db.getAll(`
            SELECT * FROM scout_organizations
            WHERE "isActive" = $1
            ORDER BY "orgName"
        `, [true]);

        logger.info('Organizations fetched', { count: organizations.length, userId: req.session.userId });
        res.json(organizations);
    } catch (error) {
        logger.error('Error fetching organizations', { error: error.message, userId: req.session.userId });
        res.status(500).json({ error: 'Failed to fetch organizations' });
    }
});

// GET /api/organizations/:orgCode
// Get organization details
app.get('/api/organizations/:orgCode', auth.isAuthenticated, async (req, res) => {
    try {
        const { orgCode } = req.params;

        const organization = await db.getOne(`
            SELECT * FROM scout_organizations WHERE "orgCode" = $1
        `, [orgCode]);

        if (!organization) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        logger.info('Organization fetched', { orgCode, userId: req.session.userId });
        res.json(organization);
    } catch (error) {
        logger.error('Error fetching organization', { error: error.message, userId: req.session.userId });
        res.status(500).json({ error: 'Failed to fetch organization' });
    }
});

// GET /api/organizations/:orgCode/levels
// Get scout levels for organization
app.get('/api/organizations/:orgCode/levels', auth.isAuthenticated, async (req, res) => {
    try {
        const { orgCode } = req.params;

        const levels = await db.getAll(`
            SELECT sl.*
            FROM scout_levels sl
            JOIN level_systems ls ON ls.id = sl."levelSystemId"
            JOIN scout_organizations so ON so.id = ls."organizationId"
            WHERE so."orgCode" = $1
              AND sl."isActive" = $2
            ORDER BY sl."sortOrder"
        `, [orgCode, true]);

        if (levels.length === 0) {
            return res.status(404).json({ error: 'Organization or levels not found' });
        }

        logger.info('Levels fetched', { orgCode, count: levels.length, userId: req.session.userId });
        res.json(levels);
    } catch (error) {
        logger.error('Error fetching levels', { error: error.message, userId: req.session.userId });
        res.status(500).json({ error: 'Failed to fetch levels' });
    }
});

// GET /api/organizations/:orgCode/colors
// Get color palette for organization
app.get('/api/organizations/:orgCode/colors', auth.isAuthenticated, async (req, res) => {
    try {
        const { orgCode } = req.params;

        const colors = await db.getAll(`
            SELECT cd.*
            FROM color_definitions cd
            JOIN color_palettes cp ON cp.id = cd."paletteId"
            JOIN scout_organizations so ON so.id = cp."organizationId"
            WHERE so."orgCode" = $1
            ORDER BY cd."colorName"
        `, [orgCode]);

        if (colors.length === 0) {
            return res.status(404).json({ error: 'Organization colors not found' });
        }

        logger.info('Colors fetched', { orgCode, count: colors.length, userId: req.session.userId });
        res.json(colors);
    } catch (error) {
        logger.error('Error fetching colors', { error: error.message, userId: req.session.userId });
        res.status(500).json({ error: 'Failed to fetch colors' });
    }
});

// GET /api/scouts/:userId/profile
// Get scout profile with organization and level details
app.get('/api/scouts/:userId/profile', auth.isAuthenticated, async (req, res) => {
    try {
        const { userId } = req.params;

        // Check access: own profile or troop leader/council admin
        if (req.session.userId !== userId &&
            !['troop_leader', 'council_admin'].includes(req.session.userRole)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const profile = await db.getOne(`
            SELECT
                sp.*,
                so."orgName",
                so."orgCode",
                sl."displayName" as "levelName",
                sl."levelCode",
                sl."uniformColor",
                sl."gradeRange",
                sl."ageRange",
                t."troopNumber",
                t."troopName",
                u."firstName",
                u."lastName",
                u."email"
            FROM scout_profiles sp
            JOIN scout_organizations so ON so.id = sp."organizationId"
            LEFT JOIN scout_levels sl ON sl.id = sp."currentLevelId"
            LEFT JOIN troops t ON t.id = sp."troopId"
            LEFT JOIN users u ON u.id = sp."userId"
            WHERE sp."userId" = $1
        `, [userId]);

        if (!profile) {
            return res.status(404).json({ error: 'Scout profile not found' });
        }

        logger.info('Scout profile fetched', { userId, orgCode: profile.orgCode });
        res.json(profile);
    } catch (error) {
        logger.error('Error fetching scout profile', { error: error.message, userId: req.params.userId });
        res.status(500).json({ error: 'Failed to fetch scout profile' });
    }
});

// PUT /api/scouts/:userId/level
// Update scout level (troop leaders and council admins only)
app.put('/api/scouts/:userId/level', auth.isAuthenticated, auth.hasRole('troop_leader', 'council_admin'), async (req, res) => {
    try {
        const { userId } = req.params;
        const { levelId } = req.body;

        if (!levelId) {
            return res.status(400).json({ error: 'levelId is required' });
        }

        // Verify the level exists
        const level = await db.getOne(`SELECT id FROM scout_levels WHERE id = $1`, [levelId]);
        if (!level) {
            return res.status(404).json({ error: 'Level not found' });
        }

        // Verify the scout profile exists
        const profile = await db.getOne(`SELECT id FROM scout_profiles WHERE "userId" = $1`, [userId]);
        if (!profile) {
            return res.status(404).json({ error: 'Scout profile not found' });
        }

        const updated = await db.getOne(`
            UPDATE scout_profiles
            SET "currentLevelId" = $1,
                "levelSince" = $2,
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "userId" = $3
            RETURNING *
        `, [levelId, new Date().toISOString().split('T')[0], userId]);

        logger.info('Scout level updated', { userId, levelId, updatedBy: req.session.userId });
        res.json(updated);
    } catch (error) {
        logger.error('Error updating scout level', { error: error.message, userId: req.params.userId });
        res.status(500).json({ error: 'Failed to update scout level' });
    }
});

// GET /api/scouts/:userId/badges
// Get badges earned by scout
app.get('/api/scouts/:userId/badges', auth.isAuthenticated, async (req, res) => {
    try {
        const { userId } = req.params;

        // Check access: own badges or troop leader/council admin
        if (req.session.userId !== userId &&
            !['troop_leader', 'council_admin'].includes(req.session.userRole)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const badges = await db.getAll(`
            SELECT
                sb.*,
                b."badgeName",
                b."badgeType",
                b."imageUrl",
                b."badgeCode",
                verifier."firstName" || ' ' || verifier."lastName" as "verifiedByName"
            FROM scout_badges sb
            JOIN badges b ON b.id = sb."badgeId"
            LEFT JOIN users verifier ON verifier.id = sb."verifiedBy"
            WHERE sb."userId" = $1
            ORDER BY sb."earnedDate" DESC
        `, [userId]);

        logger.info('Scout badges fetched', { userId, count: badges.length });
        res.json(badges);
    } catch (error) {
        logger.error('Error fetching scout badges', { error: error.message, userId: req.params.userId });
        res.status(500).json({ error: 'Failed to fetch badges' });
    }
});

// POST /api/scouts/:userId/badges
// Award a badge to scout (troop leaders and council admins only)
app.post('/api/scouts/:userId/badges', auth.isAuthenticated, auth.hasRole('troop_leader', 'council_admin'), async (req, res) => {
    try {
        const { userId } = req.params;
        const { badgeId, earnedDate, notes } = req.body;

        if (!badgeId || !earnedDate) {
            return res.status(400).json({ error: 'badgeId and earnedDate are required' });
        }

        // Verify scout profile exists
        const profile = await db.getOne(`
            SELECT "troopId" FROM scout_profiles WHERE "userId" = $1
        `, [userId]);

        if (!profile) {
            return res.status(404).json({ error: 'Scout profile not found' });
        }

        // Verify badge exists
        const badge = await db.getOne(`SELECT id, "badgeName" FROM badges WHERE id = $1`, [badgeId]);
        if (!badge) {
            return res.status(404).json({ error: 'Badge not found' });
        }

        const awardedBadge = await db.getOne(`
            INSERT INTO scout_badges (
                "userId", "badgeId", "troopId", "earnedDate",
                "verifiedBy", "verifiedDate", notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            userId,
            badgeId,
            profile.troopId,
            earnedDate,
            req.session.userId,
            new Date().toISOString().split('T')[0],
            notes || null
        ]);

        logger.info('Badge awarded', { userId, badgeId, badgeName: badge.badgeName, awardedBy: req.session.userId });

        // Create achievement notification for scout
        await db.run(`
            INSERT INTO notifications (
                "userId", type, title, message, "actionUrl"
            ) VALUES ($1, $2, $3, $4, $5)
        `, [
            userId,
            'achievement',
            'New Badge Earned!',
            `You've earned the ${badge.badgeName} badge!`,
            '/profile'
        ]);

        res.status(201).json(awardedBadge);
    } catch (error) {
        if (error.message.includes('duplicate key') || error.code === '23505') {
            return res.status(409).json({ error: 'Badge already awarded on this date' });
        }
        logger.error('Error awarding badge', { error: error.message, userId: req.params.userId });
        res.status(500).json({ error: 'Failed to award badge' });
    }
});

// GET /api/badge-catalogs
// List all badge catalogs (optionally filtered by organization)
app.get('/api/badge-catalogs', auth.isAuthenticated, async (req, res) => {
    try {
        const { orgCode } = req.query;

        let query = `
            SELECT bc.*, so."orgName", so."orgCode"
            FROM badge_catalogs bc
            JOIN scout_organizations so ON so.id = bc."organizationId"
            WHERE bc."isActive" = $1
        `;
        const params = [true];

        if (orgCode) {
            query += ` AND so."orgCode" = $${params.length + 1}`;
            params.push(orgCode);
        }

        query += ` ORDER BY bc."catalogYear" DESC, bc."catalogName"`;

        const catalogs = await db.getAll(query, params);
        logger.info('Badge catalogs fetched', { count: catalogs.length, orgCode: orgCode || 'all' });
        res.json(catalogs);
    } catch (error) {
        logger.error('Error fetching badge catalogs', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch badge catalogs' });
    }
});

// GET /api/badge-catalogs/:catalogId/badges
// Get all badges in a catalog (with filters)
app.get('/api/badge-catalogs/:catalogId/badges', auth.isAuthenticated, async (req, res) => {
    try {
        const { catalogId } = req.params;
        const { level, type, search } = req.query;

        let query = `
            SELECT b.*
            FROM badges b
            WHERE b."badgeCatalogId" = $1
              AND b."isActive" = $2
        `;
        const params = [catalogId, true];

        // Filter by level if provided
        if (level) {
            query += ` AND b."applicableLevels" @> $${params.length + 1}`;
            params.push(JSON.stringify([level]));
        }

        // Filter by type if provided
        if (type) {
            query += ` AND b."badgeType" = $${params.length + 1}`;
            params.push(type);
        }

        // Search by name if provided
        if (search) {
            query += ` AND b."badgeName" ILIKE $${params.length + 1}`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY b."sortOrder", b."badgeName"`;

        const badges = await db.getAll(query, params);
        logger.info('Catalog badges fetched', { catalogId, count: badges.length, level, type });
        res.json(badges);
    } catch (error) {
        logger.error('Error fetching catalog badges', { error: error.message, catalogId: req.params.catalogId });
        res.status(500).json({ error: 'Failed to fetch catalog badges' });
    }
});

// GET /api/scouts/:userId/available-badges
// Get badges available for scout's current level (not yet earned)
app.get('/api/scouts/:userId/available-badges', auth.isAuthenticated, async (req, res) => {
    try {
        const { userId } = req.params;

        // Check access
        if (req.session.userId !== userId &&
            !['troop_leader', 'council_admin'].includes(req.session.userRole)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get scout profile with level and organization
        const profile = await db.getOne(`
            SELECT sp."currentLevelId", sl."levelCode", so.id as "orgId"
            FROM scout_profiles sp
            JOIN scout_levels sl ON sl.id = sp."currentLevelId"
            JOIN level_systems ls ON ls.id = sl."levelSystemId"
            JOIN scout_organizations so ON so.id = ls."organizationId"
            WHERE sp."userId" = $1
        `, [userId]);

        if (!profile) {
            return res.status(404).json({ error: 'Scout profile not found' });
        }

        // Get badges applicable to scout's level that they haven't earned yet
        const availableBadges = await db.getAll(`
            SELECT b.*
            FROM badges b
            JOIN badge_catalogs bc ON bc.id = b."badgeCatalogId"
            WHERE bc."organizationId" = $1
              AND b."applicableLevels" @> $2
              AND b."isActive" = true
              AND b.id NOT IN (
                  SELECT "badgeId" FROM scout_badges WHERE "userId" = $3
              )
            ORDER BY b."sortOrder", b."badgeName"
        `, [profile.orgId, JSON.stringify([profile.levelCode]), userId]);

        logger.info('Available badges fetched', { userId, count: availableBadges.length, level: profile.levelCode });
        res.json(availableBadges);
    } catch (error) {
        logger.error('Error fetching available badges', { error: error.message, userId: req.params.userId });
        res.status(500).json({ error: 'Failed to fetch available badges' });
    }
});

// ============================================================================
// Privilege Management Routes
// ============================================================================

// Helper: build effective privileges for a member
function buildEffectivePrivileges(troopRole, overrides) {
    const roleDefaults = ROLE_PRIVILEGE_DEFAULTS[troopRole] || ROLE_PRIVILEGE_DEFAULTS.member;
    const overrideMap = {};
    for (const o of overrides) {
        overrideMap[o.privilegeCode] = o.scope;
    }
    return PRIVILEGE_DEFINITIONS.map(priv => {
        const defaultScope = roleDefaults[priv.code] || 'none';
        const hasOverride = priv.code in overrideMap;
        return {
            code: priv.code,
            name: priv.name,
            category: priv.category,
            future: priv.future || false,
            defaultScope,
            effectiveScope: hasOverride ? overrideMap[priv.code] : defaultScope,
            hasOverride
        };
    });
}

// Get effective privileges for a troop member
app.get('/api/troop/:troopId/members/:userId/privileges', auth.isAuthenticated, async (req, res) => {
    try {
        const { troopId, userId } = req.params;

        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) return res.status(404).json({ error: 'Troop not found' });
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const member = await db.getOne(`
            SELECT tm.role as "troopRole", u.id, u."firstName", u."lastName"
            FROM troop_members tm
            JOIN users u ON tm."userId" = u.id
            WHERE tm."troopId" = $1 AND tm."userId" = $2 AND tm.status = 'active'
        `, [troopId, userId]);
        if (!member) return res.status(404).json({ error: 'Member not found' });

        const overrides = await db.getAll(
            'SELECT "privilegeCode", scope FROM privilege_overrides WHERE "troopId" = $1 AND "userId" = $2',
            [troopId, userId]
        );

        res.json({
            member: { id: member.id, firstName: member.firstName, lastName: member.lastName, troopRole: member.troopRole },
            privileges: buildEffectivePrivileges(member.troopRole, overrides)
        });
    } catch (error) {
        logger.error('Error fetching member privileges', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch privileges' });
    }
});

// Save privilege overrides for a troop member
app.put('/api/troop/:troopId/members/:userId/privileges', auth.isAuthenticated, async (req, res) => {
    try {
        const { troopId, userId } = req.params;
        const { overrides } = req.body;

        if (!Array.isArray(overrides)) {
            return res.status(400).json({ error: 'overrides must be an array' });
        }

        // Self-elevation block
        if (userId === req.session.userId) {
            return res.status(403).json({ error: 'Cannot modify your own privileges' });
        }

        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) return res.status(404).json({ error: 'Troop not found' });
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const member = await db.getOne(`
            SELECT tm.role as "troopRole", u.id
            FROM troop_members tm JOIN users u ON tm."userId" = u.id
            WHERE tm."troopId" = $1 AND tm."userId" = $2 AND tm.status = 'active'
        `, [troopId, userId]);
        if (!member) return res.status(404).json({ error: 'Member not found' });

        const roleDefaults = ROLE_PRIVILEGE_DEFAULTS[member.troopRole] || ROLE_PRIVILEGE_DEFAULTS.member;

        // Validate all overrides
        for (const o of overrides) {
            if (!VALID_PRIVILEGE_CODES.includes(o.code)) {
                return res.status(400).json({ error: `Invalid privilege code: ${o.code}` });
            }
            if (!VALID_SCOPES.includes(o.scope)) {
                return res.status(400).json({ error: `Invalid scope: ${o.scope}` });
            }
        }

        await db.transaction(async (client) => {
            for (const o of overrides) {
                const defaultScope = roleDefaults[o.code] || 'none';
                if (o.scope === defaultScope) {
                    // Remove override if it matches the default
                    await client.query(
                        'DELETE FROM privilege_overrides WHERE "troopId" = $1 AND "userId" = $2 AND "privilegeCode" = $3',
                        [troopId, userId, o.code]
                    );
                } else {
                    // Upsert override
                    await client.query(`
                        INSERT INTO privilege_overrides ("troopId", "userId", "privilegeCode", scope, "grantedBy")
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT ("troopId", "userId", "privilegeCode")
                        DO UPDATE SET scope = $4, "grantedBy" = $5, "updatedAt" = CURRENT_TIMESTAMP
                    `, [troopId, userId, o.code, o.scope, req.session.userId]);
                }
            }
        });

        await auth.logAuditEvent(db, req.session.userId, 'update_privileges', req, {
            resourceType: 'privileges',
            resourceId: userId,
            troopId,
            overrideCount: overrides.length
        });

        // Return updated state
        const updatedOverrides = await db.getAll(
            'SELECT "privilegeCode", scope FROM privilege_overrides WHERE "troopId" = $1 AND "userId" = $2',
            [troopId, userId]
        );

        res.json({
            member: { id: member.id, troopRole: member.troopRole },
            privileges: buildEffectivePrivileges(member.troopRole, updatedOverrides)
        });
    } catch (error) {
        logger.error('Error saving privilege overrides', { error: error.message });
        res.status(500).json({ error: 'Failed to save privileges' });
    }
});

// Reset all privilege overrides for a troop member
app.delete('/api/troop/:troopId/members/:userId/privileges', auth.isAuthenticated, async (req, res) => {
    try {
        const { troopId, userId } = req.params;

        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) return res.status(404).json({ error: 'Troop not found' });
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        await db.run(
            'DELETE FROM privilege_overrides WHERE "troopId" = $1 AND "userId" = $2',
            [troopId, userId]
        );

        await auth.logAuditEvent(db, req.session.userId, 'reset_privileges', req, {
            resourceType: 'privileges',
            resourceId: userId,
            troopId
        });

        res.json({ success: true });
    } catch (error) {
        logger.error('Error resetting privilege overrides', { error: error.message });
        res.status(500).json({ error: 'Failed to reset privileges' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'connected' });
});

// Graceful shutdown
let isShuttingDown = false;

function shutdown(signal) {
    if (isShuttingDown) {
        return;
    }
    isShuttingDown = true;
    
    logger.info(`${signal} received, closing database...`);
    db.close();
    logger.info('Database closed successfully');
    process.exitCode = 0;
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Apex Scout Manager server running on port ${PORT}`);
    logger.info('PostgreSQL database connected', {
        host: process.env.POSTGRES_HOST || 'localhost',
        database: process.env.POSTGRES_DB || 'apex_scout_manager'
    });
});
