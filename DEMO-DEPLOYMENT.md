# Demo Deployment Instructions

This guide explains how to deploy the GSCTracker demo with pre-seeded test data.

## Quick Start

The demo branch includes a pre-populated database with sample sales, events, and profile data.

### Deploy with Docker Compose

```bash
# Pull the latest demo image
docker pull neuman1812/gsctracker:demo

# Start the demo container
docker-compose -f docker-compose.demo.yml up -d

# View logs
docker-compose -f docker-compose.demo.yml logs -f
```

Access the demo at: http://localhost:8282

### Stop the Demo

```bash
docker-compose -f docker-compose.demo.yml down
```

### Reset Demo Data

To reset the demo to original test data:

```bash
# Stop and remove container with volume
docker-compose -f docker-compose.demo.yml down -v

# Pull fresh image
docker pull neuman1812/gsctracker:demo

# Start again
docker-compose -f docker-compose.demo.yml up -d
```

## Demo Data Contents

The pre-seeded database includes:

- **25 sales records** with realistic customer names and addresses
- **4 events**: Spring Community Fair, Summer Farmers Market, School Fundraiser Night, Library Book Sale
- **Profile**: Goal of 500 boxes / $3,000
- Sample data across all cookie types (Thin Mints, Samoas, Tagalongs, etc.)

## Important Notes

### Volume Configuration

**DO NOT use `docker-compose.yml` for demo deployment!**

The standard `docker-compose.yml` mounts the local `./data` directory, which **overwrites** the pre-seeded demo database.

Always use `docker-compose.demo.yml` which:
- Uses a named Docker volume (`demo_data`)
- Preserves the pre-seeded database from the image
- Allows data persistence across container restarts

### Differences from Production Deployment

| Aspect | Production (`docker-compose.yml`) | Demo (`docker-compose.demo.yml`) |
|--------|-----------------------------------|----------------------------------|
| Image | `neuman1812/gsctracker:latest` | `neuman1812/gsctracker:demo` |
| Data Volume | `./data:/data` (host mount) | `demo_data:/data` (named volume) |
| Database | Empty on first run | Pre-seeded with test data |
| Use Case | Personal cookie tracking | Testing, demos, screenshots |

## Rebuilding Demo Data

If you need to regenerate the demo database:

```bash
# Ensure you're on the demo branch
git checkout demo

# Run the seed script (requires Node.js and better-sqlite3)
node seed-demo-data.js

# The database is created at: demo-data/gsctracker.db

# Rebuild the Docker image
docker build -f Dockerfile.demo -t neuman1812/gsctracker:demo .

# Push to DockerHub (requires authentication)
docker push neuman1812/gsctracker:demo
```

Or trigger the GitHub Action:
```bash
# Push to demo branch triggers automatic build
git push origin demo

# Or manually trigger via GitHub Actions UI
```

## Troubleshooting

### No Data Shows Up

**Problem**: You deployed using `docker-compose.yml` instead of `docker-compose.demo.yml`

**Solution**:
```bash
# Stop wrong deployment
docker-compose down -v

# Start with correct file
docker-compose -f docker-compose.demo.yml up -d
```

### Data Persists After Reset

**Problem**: Named volume still exists

**Solution**:
```bash
# Remove volume explicitly
docker-compose -f docker-compose.demo.yml down -v

# Verify volume is removed
docker volume ls | grep demo_data

# If still exists, force remove
docker volume rm gsctracker_demo_data
```

### Want Fresh Demo Data Every Time

Use `--renew-anon-volumes` flag:
```bash
docker-compose -f docker-compose.demo.yml up -d --renew-anon-volumes
```

Or remove the volume before starting:
```bash
docker-compose -f docker-compose.demo.yml down -v && \
docker-compose -f docker-compose.demo.yml up -d
```

## Production Deployment

For your own Girl Scout cookie tracking (not demo), use the main branch and standard docker-compose.yml:

```bash
git checkout main
docker-compose up -d
```

This will create an empty database for your personal data.
