"""
Database Schema Initializer for Wallet Intelligence
Creates all required tables, composite indexes, and foreign keys.
Run with: python scripts/init_db.py
"""

import asyncio
import sys
from pathlib import Path

# Add project root to sys.path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from packages.database.connection import engine
from packages.database.models import Base


async def init_database():
    print("Connecting to database...")
    async with engine.begin() as conn:
        print("Creating all tables and indexes defined in Base.metadata...")
        await conn.run_sync(Base.metadata.create_all)
    print("[SUCCESS] All database tables & indexes have been created successfully!")


if __name__ == "__main__":
    asyncio.run(init_database())
