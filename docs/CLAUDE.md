# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Run Commands

### Docker (Recommended)
```bash
docker-compose up -d          # Start the application (accessible at http://localhost:8282)
docker-compose down           # Stop the application
docker-compose up -d --build  # Rebuild and start
```

### Local Development
```bash
npm install                   # Install dependencies
npm start                     # Start server (runs node server.js)
```
- Server runs on port 3000 (or `PORT` env var)
- Data stored in `/data` directory (or `DATA_DIR` env var)

### Screenshot Generation
```bash
npm run capture-screenshots   # Generate screenshots using Playwright
```

## Architecture

### Tech Stack
- **Backend**: Node.js with Express, SQLite (better-sqlite3)
- **Frontend**: Pure HTML/CSS/JavaScript (no frameworks)
- **Logging**: Winston with daily rotation
- **Container**: Docker with Alpine Node 18

### Key Files
- `server.js` - Express API server with SQLite database initialization and migrations
- `logger.js` - Winston logger configuration with colored console output and file rotation
- `public/` - Frontend assets served as static files
  - `index.html`, `script.js`, `styles.css`

### Database
- Location: `/data/gsctracker.db`
- Tables: `sales`, `profile`, `donations`, `events`
- Migrations run automatically on startup (see `server.js` lines 78-103)

### API Endpoints
All endpoints under `/api/` with rate limiting (100 requests/15 minutes):
- `GET/POST/DELETE /api/sales` - Cookie sales CRUD
- `GET/PUT /api/profile` - User profile with goals
- `GET/POST/DELETE /api/donations` - Donation tracking
- `GET/POST/PUT/DELETE /api/events` - Event sales tracking
- `GET /api/health` - Health check

## Development Conventions

- Use the `logger` module instead of `console.log` in backend code
- Use prepared statements for all database queries
- API routes should try/catch and return appropriate HTTP status codes (400, 404, 500)
- Frontend uses fetch API calls to `/api/*` endpoints
