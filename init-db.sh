#!/bin/bash
set -e

# This script runs inside the PostgreSQL container as part of its initialization.
# It substitutes environment variables into the SQL template and then executes the SQL.

echo "Running custom PostgreSQL initialization script..."

# Ensure the template file exists
if [ ! -f "/docker-entrypoint-initdb.d/init.sql.template" ]; then
    echo "Error: init.sql.template not found in /docker-entrypoint-initdb.d/"
    exit 1
fi

# Use envsubst to substitute variables into the SQL template
# and pipe the result to psql
# The -f flag for psql means "execute commands from file"
# We're piping the output of envsubst as if it were a file.
envsubst < "/docker-entrypoint-initdb.d/init.sql.template" | psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"

echo "Custom PostgreSQL initialization complete."
