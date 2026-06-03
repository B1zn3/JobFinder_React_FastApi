from typing import TypeVar, Generic, Type, Optional, Union, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import DeclarativeBase

ModelType = TypeVar("ModelType", bound=DeclarativeBase)

class BaseCrud(Generic[ModelType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    async def get(self, db: AsyncSession, id: int) -> Optional[ModelType]:
        result = await db.execute(select(self.model).where(self.model.id == id))
        return result.scalar_one_or_none()

    async def get_all(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[ModelType]:
        result = await db.execute(select(self.model).offset(skip).limit(limit))
        return result.scalars().all()

    async def create(self, db: AsyncSession, obj_data: Union[Dict, Any]) -> ModelType:
        if isinstance(obj_data, dict):
            instance = self.model(**obj_data)
        else:
            instance = self.model(**obj_data.model_dump())
        db.add(instance)
        await db.flush()
        await db.refresh(instance)
        return instance

    async def update(self, db: AsyncSession, obj_data: Union[Dict, Any], id: int) -> Optional[ModelType]:
        db_obj = await self.get(db, id)
        if db_obj:
            if isinstance(obj_data, dict):
                update_data = obj_data
            else:
                update_data = obj_data.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(db_obj, key, value)
            await db.flush()
            await db.refresh(db_obj)
        return db_obj

    async def delete(self, db: AsyncSession, id: int) -> bool:
        db_obj = await self.get(db, id)
        if db_obj:
            await db.delete(db_obj)
            await db.flush()
            return True
        return False