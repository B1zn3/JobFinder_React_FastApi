from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.cruds.base_crud import BaseCrud
from src.models.model import Status, Vacancy


class VacancyCrud(BaseCrud):
    ACTIVE_STATUS_NAME = "Активна"
    ARCHIVED_STATUS_NAME = "В архиве"
    DELETED_STATUS_NAME = "Удалена"

    def __init__(self):
        super().__init__(Vacancy)

    async def get_active(
        self,
        db: AsyncSession,
        vacancy_id: int,
    ) -> Vacancy | None:
        stmt = (
            select(Vacancy)
            .join(Vacancy.status)
            .where(
                Vacancy.id == vacancy_id,
                Status.name == self.ACTIVE_STATUS_NAME,
            )
            .options(
                selectinload(Vacancy.status),
                selectinload(Vacancy.company),
                selectinload(Vacancy.city),
                selectinload(Vacancy.profession),
                selectinload(Vacancy.employment_type),
                selectinload(Vacancy.work_schedule),
                selectinload(Vacancy.currency),
                selectinload(Vacancy.experience),
                selectinload(Vacancy.skills),
            )
        )

        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_company(
        self,
        db: AsyncSession,
        company_id: int,
        include_deleted: bool = False,
    ) -> list[Vacancy]:
        stmt = (
            select(Vacancy)
            .where(Vacancy.company_id == company_id)
            .outerjoin(Vacancy.status)
            .options(
                selectinload(Vacancy.status),
                selectinload(Vacancy.company),
                selectinload(Vacancy.city),
                selectinload(Vacancy.profession),
                selectinload(Vacancy.employment_type),
                selectinload(Vacancy.work_schedule),
                selectinload(Vacancy.currency),
                selectinload(Vacancy.experience),
                selectinload(Vacancy.skills),
            )
        )

        if not include_deleted:
            stmt = stmt.where(Status.name != self.DELETED_STATUS_NAME)

        stmt = stmt.order_by(Vacancy.created_at.desc(), Vacancy.id.desc())

        result = await db.execute(stmt)
        return list(result.scalars().unique().all())

    async def get_deleted_status_id(self, db: AsyncSession) -> int:
        result = await db.execute(
            select(Status.id).where(Status.name == self.DELETED_STATUS_NAME)
        )

        status_id = result.scalar_one_or_none()

        if not status_id:
            raise ValueError('Статус "Удалена" не найден в справочнике statuses')

        return status_id

    async def get_archived_status_id(self, db: AsyncSession) -> int:
        result = await db.execute(
            select(Status.id).where(Status.name == self.ARCHIVED_STATUS_NAME)
        )

        status_id = result.scalar_one_or_none()

        if not status_id:
            raise ValueError('Статус "В архиве" не найден в справочнике statuses')

        return status_id

    async def get_active_status_id(self, db: AsyncSession) -> int:
        result = await db.execute(
            select(Status.id).where(Status.name == self.ACTIVE_STATUS_NAME)
        )

        status_id = result.scalar_one_or_none()

        if not status_id:
            raise ValueError('Статус "Активна" не найден в справочнике statuses')

        return status_id


vacancycrud = VacancyCrud()