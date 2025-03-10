#!/bin/bash
set -e

# Wait for ClickHouse to be ready
until clickhouse-client --host localhost --query "SELECT 1"; do
  echo "Waiting for ClickHouse to be ready..."
  sleep 1
done

# Apply our initialization SQL
clickhouse-client --host localhost < /etc/clickhouse-server/config.d/init-db.sql

echo "ClickHouse initialization completed successfully"