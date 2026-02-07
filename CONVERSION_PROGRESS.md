# PostgreSQL Conversion Progress

## COMPLETED Routes (26/57 total)

### Authentication Routes
- ✅ POST /api/auth/login (already async)
- ✅ POST /api/auth/logout (no DB operations)
- ✅ GET /api/auth/me

### Notification Routes
- ✅ GET /api/notifications
- ✅ PUT /api/notifications/:id/read

### Sales Routes
- ✅ GET /api/sales
- ✅ POST /api/sales
- ✅ PUT /api/sales/:id
- ✅ DELETE /api/sales/:id
- ✅ DELETE /api/sales (bulk delete)

### Profile Routes
- ✅ GET /api/profile
- ✅ PUT /api/profile

### Donation Routes
- ✅ GET /api/donations
- ✅ POST /api/donations
- ✅ DELETE /api/donations/:id
- ✅ DELETE /api/donations (bulk delete)

### Event Routes
- ✅ GET /api/events
- ✅ POST /api/events
- ✅ PUT /api/events/:id
- ✅ DELETE /api/events/:id

### Payment Method Routes
- ✅ GET /api/payment-methods
- ✅ POST /api/payment-methods
- ✅ DELETE /api/payment-methods/:id

### Data Management
- ✅ DELETE /api/data (bulk delete)
- ✅ POST /api/import (already async)

### Troop Routes
- ✅ GET /api/troop/my-troops

## REMAINING Routes (31 routes)

### Troop Management (20 routes)
- ⬜ GET /api/troop/:troopId/members
- ⬜ GET /api/troop/:troopId/sales
- ⬜ GET /api/troop/:troopId/goals
- ⬜ POST /api/troop
- ⬜ PUT /api/troop/:troopId
- ⬜ POST /api/troop/:troopId/members
- ⬜ POST /api/troop/:troopId/members/scout (complex transaction)
- ⬜ DELETE /api/troop/:troopId/members/:userId
- ⬜ POST /api/troop/:troopId/goals
- ⬜ PUT /api/troop/:troopId/goals/:goalId
- ⬜ DELETE /api/troop/:troopId/goals/:goalId
- ⬜ GET /api/troop/:troopId/goals/progress (complex query)
- ⬜ GET /api/troop/:troopId/leaderboard
- ⬜ PUT /api/troop/:troopId/members/:userId
- ⬜ POST /api/troop/:troopId/invite
- ⬜ GET /api/invitations
- ⬜ POST /api/invitations/:id/accept
- ⬜ POST /api/invitations/:id/decline
- ⬜ POST /api/troop/:troopId/roster/import (already async but has SQLite queries)
- ⬜ GET /api/users/search

### Season & Cookie Management (10 routes)
- ⬜ GET /api/seasons/active
- ⬜ GET /api/seasons
- ⬜ POST /api/seasons
- ⬜ PUT /api/seasons/:year/activate
- ⬜ GET /api/cookies
- ⬜ GET /api/cookies/:id
- ⬜ POST /api/cookies
- ⬜ PUT /api/cookies/:id
- ⬜ DELETE /api/cookies/:id

### Other
- ⬜ GET /api/health (no DB operations)

## Conversion Patterns Used

1. Route handler: `(req, res)` → `async (req, res)`
2. Query methods:
   - `db.prepare('...').get(...)` → `await db.getOne('...', [...])`
   - `db.prepare('...').all(...)` → `await db.getAll('...', [...])`
   - `db.prepare('...').run(...)` → `await db.run('...', [...])`
3. Placeholders: `?` → `$1, $2, $3, ...`
4. Column names: camelCase → `"camelCase"`
5. Boolean: `0/1` → `true/false`
6. Timestamps: `datetime('now')` → `NOW()`
7. INSERT RETURNING: `result.lastInsertRowid` → `result.id` (use RETURNING *)
8. Result checking: `result.changes` → `result.rowCount`
9. Transactions: Need to be rewritten (no direct db.transaction() equivalent)
