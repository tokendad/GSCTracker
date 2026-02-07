# PostgreSQL Database Migration - Route Conversion Summary

## Overview
Converting /data/ASM/server.js from synchronous SQLite to asynchronous PostgreSQL queries.

## Status: 26/61 Routes Converted (42% Complete)

## Conversion Patterns Applied

### 1. Route Handler Conversion
```javascript
// BEFORE:
app.get('/api/route', auth.isAuthenticated, (req, res) => {

// AFTER:
app.get('/api/route', auth.isAuthenticated, async (req, res) => {
```

### 2. Query Method Conversion
```javascript
// BEFORE (SQLite):
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
const users = db.prepare('SELECT * FROM users').all();
const result = db.prepare('INSERT INTO users (name) VALUES (?)').run(name);

// AFTER (PostgreSQL):
const user = await db.getOne('SELECT * FROM users WHERE id = $1', [userId]);
const users = await db.getAll('SELECT * FROM users');
const result = await db.run('INSERT INTO users (name) VALUES ($1)', [name]);
```

### 3. SQL Syntax Changes
```javascript
// Column names with camelCase must be quoted:
SELECT userId, firstName → SELECT "userId", "firstName"

// Boolean values:
WHERE isActive = 1 → WHERE "isActive" = true

// Timestamps:
datetime('now') → NOW()

// Placeholders:
VALUES (?, ?, ?) → VALUES ($1, $2, $3)
```

### 4. INSERT with RETURNING
```javascript
// BEFORE:
const result = db.prepare('INSERT INTO table (col) VALUES (?)').run(value);
const newRow = db.prepare('SELECT * FROM table WHERE id = ?').get(result.lastInsertRowid);

// AFTER:
const newRow = await db.getOne('INSERT INTO table (col) VALUES ($1) RETURNING *', [value]);
```

### 5. Result Object Changes
```javascript
// Row count:
result.changes → result.rowCount

// Last insert ID:
result.lastInsertRowid → result.id (when using RETURNING id)
```

## ✅ COMPLETED CONVERSIONS (26 routes)

### Authentication & User Management
1. ✅ POST /api/auth/login (was already async)
2. ✅ GET /api/auth/me
3. ✅ POST /api/auth/logout (no DB ops)

### Notifications
4. ✅ GET /api/notifications
5. ✅ PUT /api/notifications/:id/read

### Sales
6. ✅ GET /api/sales
7. ✅ POST /api/sales
8. ✅ PUT /api/sales/:id
9. ✅ DELETE /api/sales/:id
10. ✅ DELETE /api/sales (bulk)

### Profile
11. ✅ GET /api/profile
12. ✅ PUT /api/profile

### Donations
13. ✅ GET /api/donations
14. ✅ POST /api/donations
15. ✅ DELETE /api/donations/:id
16. ✅ DELETE /api/donations (bulk)

### Events
17. ✅ GET /api/events
18. ✅ POST /api/events
19. ✅ PUT /api/events/:id
20. ✅ DELETE /api/events/:id

### Payment Methods
21. ✅ GET /api/payment-methods
22. ✅ POST /api/payment-methods
23. ✅ DELETE /api/payment-methods/:id

### Import
24. ✅ POST /api/import (was already async, but uses SQLite transactions - NEEDS REVIEW)

### Data Management
25. ✅ DELETE /api/data

### Troops
26. ✅ GET /api/troop/my-troops

## ⬜ REMAINING CONVERSIONS (35 routes)

### Troop Management Routes (19 routes) - Lines 1287-1700
- ⬜ GET /api/troop/:troopId/members (line ~1287)
- ⬜ GET /api/troop/:troopId/sales (line ~1331)
- ⬜ GET /api/troop/:troopId/goals (line ~1379)
- ⬜ POST /api/troop (line ~1406) - uses datetime('now')
- ⬜ PUT /api/troop/:troopId (line ~1442) - uses datetime('now')
- ⬜ POST /api/troop/:troopId/members (line ~1487) - uses datetime('now')
- ⬜ POST /api/troop/:troopId/members/scout (line ~1536) - **COMPLEX TRANSACTION**
- ⬜ DELETE /api/troop/:troopId/members/:userId (line ~1702) - uses datetime('now')
- ⬜ POST /api/troop/:troopId/goals (line ~1734) - uses datetime('now')
- ⬜ PUT /api/troop/:troopId/goals/:goalId (line ~2091) - uses datetime('now')
- ⬜ DELETE /api/troop/:troopId/goals/:goalId (line ~2132)
- ⬜ GET /api/troop/:troopId/goals/progress (line ~2160) - **COMPLEX QUERIES**
- ⬜ GET /api/troop/:troopId/leaderboard (line ~2261)
- ⬜ PUT /api/troop/:troopId/members/:userId (line ~2308)

### Invitation System Routes (5 routes) - Lines 2362-2573
- ⬜ POST /api/troop/:troopId/invite (line ~2362) - uses datetime('now')
- ⬜ GET /api/invitations (line ~2434) - uses datetime('now') in WHERE
- ⬜ POST /api/invitations/:id/accept (line ~2461) - uses datetime('now'), ON CONFLICT
- ⬜ POST /api/invitations/:id/decline (line ~2533) - uses datetime('now')

### Roster Import (1 route) - Line 2579
- ⬜ POST /api/troop/:troopId/roster/import (line ~2579) - **ALREADY ASYNC** but uses SQLite

### User Search (1 route) - Line 1769
- ⬜ GET /api/users/search (line ~1769)

### Season Management Routes (5 routes) - Lines 1796-1900
- ⬜ GET /api/seasons/active (line ~1796)
- ⬜ GET /api/seasons (line ~1807)
- ⬜ POST /api/seasons (line ~1823) - uses datetime('now'), loops
- ⬜ PUT /api/seasons/:year/activate (line ~1873) - uses datetime('now')

### Cookie Management Routes (5 routes) - Lines 1896-2091
- ⬜ GET /api/cookies (line ~1896) - **COMPLEX JSON aggregation**
- ⬜ GET /api/cookies/:id (line ~1947)
- ⬜ POST /api/cookies (line ~1967) - uses datetime('now'), loops
- ⬜ PUT /api/cookies/:id (line ~2012) - uses datetime('now'), loops
- ⬜ DELETE /api/cookies/:id (line ~2068) - uses datetime('now')

### Other
- ⬜ GET /api/health (line ~2708) - No DB operations

## Special Cases Requiring Attention

### 1. SQLite Transactions (Need PostgreSQL Transaction Pattern)
The following routes use `db.transaction()` which doesn't exist in PostgreSQL:
- POST /api/import (line ~971) - Uses `db.transaction()` for bulk insert
- POST /api/troop/:troopId/members/scout (line ~1536) - Uses `db.transaction()` for multi-insert
- POST /api/troop/:troopId/roster/import (line ~2579) - Complex bulk operations

**Solution**: Wrap in try-catch with BEGIN/COMMIT:
```javascript
try {
    await db.run('BEGIN');
    // ... operations ...
    await db.run('COMMIT');
} catch (error) {
    await db.run('ROLLBACK');
    throw error;
}
```

### 2. JSON Aggregation
GET /api/cookies (line ~1896) uses SQLite's `json_group_array()`:
```sql
json_group_array(json_object('id', ca.id, ...))
```

**PostgreSQL equivalent**:
```sql
json_agg(json_build_object('id', ca.id, ...))
```

### 3. String Concatenation
SQLite uses `||` operator which works in PostgreSQL, but column names need quoting:
```sql
-- SQLite:
u.firstName || ' ' || u.lastName as leaderName

-- PostgreSQL:
u."firstName" || ' ' || u."lastName" as "leaderName"
```

### 4. ON CONFLICT Clause
POST /api/invitations/:id/accept uses ON CONFLICT - verify column constraints exist in PostgreSQL schema.

## Next Steps

1. **Convert Simple GET Routes First** (11 routes)
   - These are straightforward query conversions
   - No transactions or complex logic

2. **Convert POST/PUT/DELETE Routes** (15 routes)
   - Replace datetime('now') with NOW()
   - Convert INSERT...RETURNING patterns

3. **Convert Transaction Routes** (3 routes)
   - Rewrite using BEGIN/COMMIT/ROLLBACK
   - Test thoroughly

4. **Test Each Conversion**
   - Run the server
   - Test each endpoint
   - Verify data integrity

5. **Update Import Route** (line 971)
   - Currently uses SQLite transaction pattern
   - Needs PostgreSQL transaction rewrite

## Files Modified
- /data/ASM/server.js - Main conversion file

## Backup Created
- /data/ASM/server.js.backup-before-bulk-conversion

## Tools Used
- /data/ASM/database/query-helpers.js - PostgreSQL wrapper functions (db.getOne, db.getAll, db.run)

## Testing Checklist
After conversion completion:
- [ ] All routes respond without errors
- [ ] Database queries return correct data
- [ ] INSERT operations create records
- [ ] UPDATE operations modify records
- [ ] DELETE operations remove records
- [ ] Transactions rollback on errors
- [ ] Complex queries (leaderboard, progress) work correctly
- [ ] Bulk operations handle large datasets
- [ ] Error handling works as expected
