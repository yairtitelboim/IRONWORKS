#!/bin/bash
# Quick script to query the scanner database from phase1 directory

DB_PATH="../../scanner/scanner.db"

if [ ! -f "$DB_PATH" ]; then
    echo "❌ Database not found at: $DB_PATH"
    echo "   Current directory: $(pwd)"
    echo "   Looking for: $(cd ../.. && pwd)/scanner/scanner.db"
    exit 1
fi

# Default query if no arguments
if [ $# -eq 0 ]; then
    sqlite3 "$DB_PATH" -header -column -box "
    SELECT 
        headline,
        lane,
        event_type,
        confidence,
        url
    FROM signals 
    ORDER BY ingested_at DESC
    LIMIT 10;"
else
    # Run custom query
    sqlite3 "$DB_PATH" -header -column -box "$@"
fi

