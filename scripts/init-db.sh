#!/bin/bash
set -e

# Initialize PostgreSQL database with pgvector extension
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Enable pgvector extension
    CREATE EXTENSION IF NOT EXISTS vector;
    
    -- Create additional extensions if needed
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    -- Log success
    SELECT 'Database initialized with pgvector extension' AS status;
EOSQL

echo "PostgreSQL initialization complete with pgvector extension"


