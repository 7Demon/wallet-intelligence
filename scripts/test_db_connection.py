import asyncio
from packages.database.connection import engine
from sqlalchemy import text


async def main():
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT current_database(), current_user, version()"))
        row = result.fetchone()
        print("Database:", row[0])
        print("User:", row[1])
        print("Version:", row[2])

        tables = await conn.execute(
            text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name")
        )
        print("\nCreated Tables in public schema:")
        for t in tables:
            print(f"- {t[0]}")


if __name__ == "__main__":
    asyncio.run(main())
