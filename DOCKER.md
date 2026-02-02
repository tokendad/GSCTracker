# Apex Scout Manager - Docker Hub Repository

**neuman1812/apex-scout-manager**

A multi-user Girl Scout cookie sales tracking and troop management platform with built-in authentication, role-based access control, and comprehensive troop organization features.

## Quick Start

```bash
# Production Deployment
docker run -d \
  --name asm \
  -p 8282:3000 \
  -e SESSION_SECRET=your-secure-secret-here \
  -e CORS_ORIGIN=http://your-domain:8282 \
  -v asm_data:/data \
  neuman1812/apex-scout-manager:latest
```

Access at `http://localhost:8282`

## Features

### 👥 Multi-User & Authentication
- Email/password login with bcryptjs hashing
- Google OAuth 2.0 integration
- Role-based access control (Scout, Parent, Troop Leader, Council Admin)
- Session management with audit logging
- COPPA compliance for minors

### 🏕️ Troop Management
- Organize troops within councils
- Scout-parent linking for family accounts
- Support for all Girl Scout levels
- Role-based troop permissions
- Track troop goals and achievements

### 🍪 Sales Tracking
- Track individual and event-based cookie sales
- 9 cookie types with inventory management
- Payment status tracking
- Excel import/export for bulk operations
- Donation tracking

### 📊 Dashboard & Reporting
- Real-time sales summary
- Cookie breakdown analytics
- Event performance tracking
- Individual scout profiles with goals
- Multi-user data isolation

### 🎯 Additional Features
- Mobile-first responsive design
- Dark mode support
- PWA-ready (add to home screen)
- Automatic database backups
- Comprehensive audit logging
- API-first architecture

## Requirements

- Docker Engine 20.10+
- 256MB RAM minimum
- 100MB disk space

## Environment Variables

**Required:**
- `SESSION_SECRET` - Generate a random string for session security

**Recommended:**
- `NODE_ENV` - Set to `production` for HTTPS deployments
- `CORS_ORIGIN` - Your application URL (default: `http://localhost:3000`)
- `GOOGLE_CLIENT_ID` - For Google OAuth support
- `GOOGLE_CLIENT_SECRET` - For Google OAuth support
- `GOOGLE_CALLBACK_URL` - OAuth redirect URL

**Optional:**
- `PORT` - Internal container port (default: `3000`)
- `DATA_DIR` - Data directory in container (default: `/data`)
- `TZ` - Timezone (default: `America/New_York`)

## Data Persistence

Mount a volume to `/data` to persist database and logs:

```bash
docker run -v asm_data:/data neuman1812/apex-scout-manager:latest
```

This ensures your data survives container restarts.

## Docker Compose

For production with proper configuration:

```yaml
services:
  asm:
    image: neuman1812/apex-scout-manager:latest
    container_name: asm
    restart: unless-stopped
    ports:
      - "8282:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - SESSION_SECRET=change-this-to-random-secret
      - CORS_ORIGIN=http://localhost:8282
      - TZ=America/New_York
    volumes:
      - asm_data:/data
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  asm_data:
```

## Initial Setup

1. **First Access**: Visit `http://localhost:8282`
2. **Create Account**: Click "Sign Up" or login with Google OAuth
3. **Organization**: Set up your council and troops
4. **Invite Members**: Add scouts, parents, and troop leaders

## Database

- SQLite database (`asm.db`) - no external database server required
- Automatic backups created on startup
- Located in `/data/` directory
- Backward compatible with v1.0 data

## Upgrading

```bash
# Pull latest image
docker pull neuman1812/apex-scout-manager:latest

# Stop old container
docker stop asm

# Remove old container
docker rm asm

# Run with same volume to preserve data
docker run -d \
  --name asm \
  -p 8282:3000 \
  -v asm_data:/data \
  -e SESSION_SECRET=your-secure-secret-here \
  neuman1812/apex-scout-manager:latest
```

## Logs

View container logs:

```bash
docker logs asm -f
```

Application logs stored in `/data/logs/` within the container:
- `asm-YYYY-MM-DD.log` - All logs
- `error-YYYY-MM-DD.log` - Errors only

## Support & Documentation

- **GitHub Repository**: https://github.com/tokendad/Apex-Scout-Manager
- **Issues & Bugs**: https://github.com/tokendad/Apex-Scout-Manager/issues
- **Documentation**: See GitHub repository for complete documentation

## Version Information

- **Current Version**: 2.0.0
- **Latest Features**: Multi-user authentication, troop management, COPPA compliance
- **Database**: SQLite with v2.0 schema

## License

MIT

---

**v2.0.0** - Multi-user Girl Scout cookie sales tracker with troop management
