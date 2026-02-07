#!/usr/bin/env python3
"""
Complete the PostgreSQL conversion for remaining routes in server.js
This script applies the conversion patterns systematically.
"""

import re
import sys

def convert_route_to_async(route_content):
    """Convert a route from synchronous SQLite to asynchronous PostgreSQL"""

    # Step 1: Make route handler async
    route_content = re.sub(
        r'\((req, res(?:, next)?)\)\s*=>',
        r'async (\1) =>',
        route_content
    )

    route_content = re.sub(
        r'function\s*\((req, res(?:, next)?)\)',
        r'async function (\1)',
        route_content
    )

    # Step 2: Convert db.prepare().get() to await db.getOne()
    route_content = re.sub(
        r'db\.prepare\(([^)]+)\)\.get\(([^)]*)\)',
        r'await db.getOne(\1, [\2])',
        route_content
    )

    # Step 3: Convert db.prepare().all() to await db.getAll()
    route_content = re.sub(
        r'db\.prepare\(([^)]+)\)\.all\(([^)]*)\)',
        r'await db.getAll(\1, [\2])',
        route_content
    )

    # Step 4: Convert db.prepare().run() to await db.run()
    route_content = re.sub(
        r'const\s+(\w+)\s*=\s*db\.prepare\(([^)]+)\);\s*\1\.run\(([^)]*)\)',
        r'await db.run(\2, [\3])',
        route_content
    )

    route_content = re.sub(
        r'db\.prepare\(([^)]+)\)\.run\(([^)]*)\)',
        r'await db.run(\1, [\2])',
        route_content
    )

    # Step 5: Convert result.changes to result.rowCount
    route_content = re.sub(
        r'result\.changes',
        r'result.rowCount',
        route_content
    )

    # Step 6: Convert result.lastInsertRowid pattern
    # This needs manual review as it's complex

    return route_content

def main():
    print("PostgreSQL Route Conversion Script")
    print("=" * 60)
    print("\nThis script helps convert remaining SQLite routes to PostgreSQL.")
    print("Note: Complex routes with transactions need manual review!\n")

    # Read server.js
    try:
        with open('/data/ASM/server.js', 'r') as f:
            content = f.read()
    except FileNotFoundError:
        print("ERROR: server.js not found!")
        sys.exit(1)

    # Count routes
    all_routes = len(re.findall(r'app\.(get|post|put|delete)\([^,]+,.*?\(req, res', content))
    async_routes = len(re.findall(r'app\.(get|post|put|delete)\([^,]+,.*?async \(req, res', content))

    print(f"Total routes: {all_routes}")
    print(f"Async routes: {async_routes}")
    print(f"Remaining: {all_routes - async_routes}")
    print(f"\nProgress: {async_routes}/{all_routes} ({async_routes*100//all_routes}%)")

if __name__ == '__main__':
    main()
