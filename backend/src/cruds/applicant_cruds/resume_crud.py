from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.cruds.base_crud import BaseCrud
from src.models.model import Resume


class ResumeCrud(BaseCrud):
    def __init__(self):
        super().__init__(Resume)

    async def get_by_applicant(
        self,
        db: AsyncSession,
        applicant_id: int,
        include_inactive: bool = False,
    ) -> list[Resume]:
        stmt = select(Resume).where(Resume.applicant_id == applicant_id)

        if not include_inactive:
            stmt = stmt.where(Resume.is_active.is_(True))

        stmt = stmt.order_by(Resume.created_at.desc(), Resume.id.desc())

        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_with_details(
        self,
        db: AsyncSession,
        resume_id: int,
        include_inactive: bool = True,
    ) -> Resume | None:
        stmt = (
            select(Resume)
            .where(Resume.id == resume_id)
            .options(
                selectinload(Resume.profession),
                selectinload(Resume.skills),
                selectinload(Resume.work_experiences),
            )
        )

        if not include_inactive:
            stmt = stmt.where(Resume.is_active.is_(True))

        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_applicant_with_details(
        self,
        db: AsyncSession,
        applicant_id: int,
        include_inactive: bool = False,
    ) -> list[Resume]:
        stmt = (
            select(Resume)
            .where(Resume.applicant_id == applicant_id)
            .options(
                selectinload(Resume.profession),
                selectinload(Resume.skills),
                selectinload(Resume.work_experiences),
            )
        )

        if not include_inactive:
            stmt = stmt.where(Resume.is_active.is_(True))

        stmt = stmt.order_by(Resume.created_at.desc(), Resume.id.desc())

        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_applicant_with_details_paginated(
        self,
        db: AsyncSession,
        applicant_id: int,
        skip: int = 0,
        limit: int = 10,
        include_inactive: bool = False,
    ) -> list[Resume]:
        stmt = (
            select(Resume)
            .where(Resume.applicant_id == applicant_id)
            .options(
                selectinload(Resume.profession),
                selectinload(Resume.skills),
                selectinload(Resume.work_experiences),
            )
        )

        if not include_inactive:
            stmt = stmt.where(Resume.is_active.is_(True))

        stmt = (
            stmt
            .order_by(Resume.created_at.desc(), Resume.id.desc())
            .offset(skip)
            .limit(limit)
        )

        result = await db.execute(stmt)
        return list(result.scalars().all())


resumecrud = ResumeCrud()