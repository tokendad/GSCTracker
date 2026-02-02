# Changelog

All notable changes to Apex Scout Manager will be documented in this file.

## [2.0.0] - 2026-02-02

### Major Release: Multi-User Authentication & Troop Management Foundation

This major release transforms Apex Scout Manager from a single-user application into a comprehensive multi-user troop management platform with enterprise-grade security.

### Added

**Authentication & Security:**
- Multi-user authentication system with email/password and Google OAuth 2.0 support
- Session-based authentication with HTTP-only cookies and IP tracking
- Password hashing with bcryptjs (12 salt rounds)
- Rate limiting on authentication endpoints
- COPPA compliance features for minors (age verification, parental consent tracking)
- Audit logging system for all user actions

**User Management:**
- User registration and login system
- User roles: Scout, Parent, Troop Leader, Council Admin
- Multi-user data isolation - users only see their own data
- Account lockout after failed login attempts

**Organization & Troop Management:**
- Council organization structure
- Multiple troops per council with troop details (number, type, leadership)
- Scout levels support (Daisy, Brownie, Junior, Cadette, Senior, Ambassador)
- Troop membership with role-based permissions
- Scout-parent linking for family account management
- Troop goals tracking (boxes sold, revenue, participation, events)
- Troop invitations and member management

**Database Enhancements:**
- New multi-user schema with foreign key relationships
- Automatic database migration from v1.0 to v2.0
- New tables: users, sessions, councils, troops, troop_members, troop_goals, audit_log, notifications
- Backward compatibility with v1.0 data

**Data Backup & Safety:**
- Automatic timestamped database backups on application startup
- Migration verification script to ensure data integrity
- Backup retention (keeps last 5 backups)

### Changed

**Architecture:**
- Refactored authentication from custom middleware to Passport.js
- Updated all API endpoints to include user context filtering
- All database queries now respect user isolation boundaries
- Docker configuration updated for production deployment

**Data Model:**
- Added `userId` foreign key to: sales, profile, donations, events tables
- Added `troopId` to events for troop-specific tracking
- Profile table now linked to multi-user system
- All existing v1.0 data automatically migrated with admin user assignment

**Frontend:**
- Added login.html and register.html for authentication
- User info displayed in dashboard header
- Added logout functionality
- Session management integrated

### Security

- Implemented role-based access control (RBAC)
- Passport.js authentication strategies (local + Google OAuth)
- Audit trail for compliance and security monitoring
- Removed hardcoded credentials - uses environment variables
- COPPA-compliant minor tracking

### Migration

- Automatic v1.0 → v2.0 database migration with backup
- Default admin user created from v1.0 profile
- All existing sales, donations, and events linked to admin user
- Existing data fully preserved and accessible

### Breaking Changes

- Database schema updated (migration required)
- Login now required to access application
- All API endpoints now require authentication
- User context required for all data operations

## [1.2.0] - 2026-01-21

### Removed
- **Digital Cookie Sync (Scraping)** removed to comply with Digital Cookie Terms of Service.
- **Puppeteer dependencies** removed to reduce application size and complexity.

## [1.1.0] - 2026-01-20

### Added
- **Edit Order functionality** for manual orders - edit customer info, cookies, payment details
- **Status color coding** for Recent Sales table:
  - Green: Complete/Delivered orders
  - Yellow: Shipped orders
  - Blue: In-Person delivery orders
  - Red: Awaiting Payment orders
- **Status legend** below Recent Sales table
- **Order Complete button** replaced checkbox with styled button
- **Multiple payment methods** support with dynamic QR code generation
- **Bordered settings sections** for better visual organization in Settings page

### Changed
- **Digital Cookie Sync** no longer requires Orders Page URL - automatically detected after login
- **Scraper performance** improved with parallel tab processing (3x-5x faster)
- **Cookie Breakdown** now shows individual cookie types instead of "Assorted" for synced orders
- **Online orders** from Digital Cookie sync are automatically marked as Paid
- **Upload Photo button** renamed to "Upload Profile Photo" and moved above Store URL
- **README** updated with corrected Digital Cookie sync instructions

### Fixed
- **Order details extraction** from Digital Cookie - now captures phone, email, address correctly
- **Security vulnerabilities** - replaced vulnerable `xlsx` package with `exceljs`

### Security
- Resolved Dependabot alerts:
  - GHSA-4r6h-8v6p-xvw6 (Prototype Pollution in SheetJS)
  - GHSA-5pgg-2g8v-p4x9 (SheetJS ReDoS vulnerability)

## [1.0.0] - 2026-01-19

### Added
- Initial release
- Cookie sales tracking with individual and event sales
- Digital Cookie sync integration
- Profile management with photo upload
- QR code generation for store links
- Dark mode support
- SQLite database storage
- Docker support
