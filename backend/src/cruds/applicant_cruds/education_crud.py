from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from src.cruds.base_crud import BaseCrud
from src.models.model import Education

class EducationCrud(BaseCrud):
    def __init__(self):
        super().__init__(Education)

    async def get_with_institution(self, db: AsyncSession, education_id: int) -> Education | None:
        stmt = select(Education).where(Education.id == education_id).options(selectinload(Education.institution))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_applicant(self, db: AsyncSession, applicant_id: int) -> list[Education]:
        stmt = select(Education).where(Education.applicant_id == applicant_id).options(selectinload(Education.institution))
        result = await db.execute(stmt)
        return result.scalars().all()

educationcrud = EducationCrud()