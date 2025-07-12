#!/bin/sh

# Make sure init-db.sh script is executable
chmod +x /docker-entrypoint-initdb.d/init-db.sh

# Run the original PostgreSQL entrypoint with postgres as argument
exec docker-entrypoint.sh postgres