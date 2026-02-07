-- Enable UUID extension for PostgreSQL
-- This allows us to use uuid_generate_v4() for automatic UUID generation

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify extension is installed
SELECT extname, extversion FROM pg_extension WHERE extname = 'uuid-ossp';
