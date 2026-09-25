import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from apps.api.main import app
from packages.database.connection import DATABASE_URL, get_db


@pytest.fixture(autouse=True)
def override_db_dependency():
    """Override database dependency with NullPool engine to prevent event loop connection leaks in tests."""
    test_engine = create_async_engine(DATABASE_URL, poolclass=NullPool)
    test_session_factory = async_sessionmaker(
        bind=test_engine, class_=AsyncSession, expire_on_commit=False
    )

    async def _get_test_db():
        async with test_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_db] = _get_test_db
    yield
    app.dependency_overrides.clear()
