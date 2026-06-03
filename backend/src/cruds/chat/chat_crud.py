from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.cruds.base_crud import BaseCrud
from src.models.model import (
    Applicant,
    Application,
    Chat,
    MessageAttachment,
    Message,
    Company,
    Resume,
    User,
    Vacancy,
)


class ChatCrud(BaseCrud):
    def __init__(self):
        super().__init__(Chat)

    def _details_options(self):
        return (
            selectinload(Chat.application)
            .selectinload(Application.vacancy)
            .selectinload(Vacancy.status),

            selectinload(Chat.application)
            .selectinload(Application.vacancy)
            .selectinload(Vacancy.company)
            .selectinload(Company.user),

            selectinload(Chat.application)
            .selectinload(Application.vacancy)
            .selectinload(Vacancy.profession),

            selectinload(Chat.application)
            .selectinload(Application.resume)
            .selectinload(Resume.profession),

            selectinload(Chat.application)
            .selectinload(Application.resume)
            .selectinload(Resume.applicant)
            .selectinload(Applicant.user),

            selectinload(Chat.messages)
            .selectinload(Message.sender)
            .selectinload(User.applicant),

            selectinload(Chat.messages)
            .selectinload(Message.sender)
            .selectinload(User.company),

            selectinload(Chat.messages)
            .selectinload(Message.attachments),
        )

    async def get_with_details(
        self,
        db: AsyncSession,
        chat_id: int,
    ) -> Chat | None:
        stmt = (
            select(Chat)
            .where(Chat.id == chat_id)
            .options(*self._details_options())
        )

        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_applicant_id(
        self,
        db: AsyncSession,
        applicant_id: int,
        skip: int = 0,
        limit: int = 20,
    ) -> list[Chat]:
        stmt = (
            select(Chat)
            .join(Chat.application)
            .join(Application.resume)
            .where(Resume.applicant_id == applicant_id)
            .options(*self._details_options())
            .order_by(Chat.created_at.desc(), Chat.id.desc())
            .offset(skip)
            .limit(limit)
        )

        result = await db.execute(stmt)
        return list(result.scalars().unique().all())

    async def get_by_company_id(
        self,
        db: AsyncSession,
        company_id: int,
        skip: int = 0,
        limit: int = 20,
    ) -> list[Chat]:
        stmt = (
            select(Chat)
            .join(Chat.application)
            .join(Application.vacancy)
            .where(Vacancy.company_id == company_id)
            .options(*self._details_options())
            .order_by(Chat.created_at.desc(), Chat.id.desc())
            .offset(skip)
            .limit(limit)
        )

        result = await db.execute(stmt)
        return list(result.scalars().unique().all())

    async def get_by_application_id(
        self,
        db: AsyncSession,
        application_id: int,
    ) -> Chat | None:
        stmt = (
            select(Chat)
            .where(Chat.application_id == application_id)
            .options(*self._details_options())
        )

        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_vacancy_id(
        self,
        db: AsyncSession,
        vacancy_id: int,
    ) -> list[Chat]:
        stmt = (
            select(Chat)
            .join(Chat.application)
            .where(Application.vacancy_id == vacancy_id)
            .options(*self._details_options())
        )

        result = await db.execute(stmt)
        return list(result.scalars().unique().all())


class MessageCrud(BaseCrud):
    def __init__(self):
        super().__init__(Message)

    def _details_options(self):
        return (
            selectinload(Message.sender).selectinload(User.applicant),
            selectinload(Message.sender).selectinload(User.company),
            selectinload(Message.attachments),
        )

    async def get_by_chat_id(
        self,
        db: AsyncSession,
        chat_id: int,
        skip: int = 0,
        limit: int = 50,
    ) -> list[Message]:
        stmt = (
            select(Message)
            .where(Message.chat_id == chat_id)
            .options(*self._details_options())
            .order_by(Message.created_at.asc(), Message.id.asc())
            .offset(skip)
            .limit(limit)
        )

        result = await db.execute(stmt)
        return list(result.scalars().unique().all())

    async def get_by_id_with_details(
        self,
        db: AsyncSession,
        message_id: int,
    ) -> Message | None:
        stmt = (
            select(Message)
            .where(Message.id == message_id)
            .options(*self._details_options())
        )

        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def count_unread_by_chat_id(
        self,
        db: AsyncSession,
        chat_id: int,
        current_user_id: int,
    ) -> int:
        result = await db.execute(
            select(func.count(Message.id)).where(
                Message.chat_id == chat_id,
                Message.sender_id != current_user_id,
                Message.read_at.is_(None),
            )
        )

        return int(result.scalar_one() or 0)

    async def count_total_unread_for_user(
        self,
        db: AsyncSession,
        current_user_id: int,
        applicant_id: int | None = None,
        company_id: int | None = None,
    ) -> int:
        stmt = (
            select(func.count(Message.id))
            .join(Chat, Chat.id == Message.chat_id)
            .join(Application, Application.id == Chat.application_id)
            .where(
                Message.sender_id != current_user_id,
                Message.read_at.is_(None),
            )
        )

        if applicant_id:
            stmt = stmt.join(Resume, Resume.id == Application.resume_id).where(
                Resume.applicant_id == applicant_id,
            )
        elif company_id:
            stmt = stmt.join(Vacancy, Vacancy.id == Application.vacancy_id).where(
                Vacancy.company_id == company_id,
            )
        else:
            return 0

        result = await db.execute(stmt)
        return int(result.scalar() or 0)

    async def mark_chat_messages_as_read(
        self,
        db: AsyncSession,
        chat_id: int,
        current_user_id: int,
        read_at,
    ) -> int:
        result = await db.execute(
            select(Message).where(
                Message.chat_id == chat_id,
                Message.sender_id != current_user_id,
                Message.read_at.is_(None),
            )
        )

        messages = list(result.scalars().all())

        for message in messages:
            message.read_at = read_at

        await db.flush()

        return len(messages)

    async def create(
        self,
        db: AsyncSession,
        obj_data: dict,
    ) -> Message:
        item = Message(**obj_data)
        db.add(item)
        await db.flush()
        return item


class MessageAttachmentCrud(BaseCrud):
    def __init__(self):
        super().__init__(MessageAttachment)

    async def create_many_for_message(
        self,
        db: AsyncSession,
        message_id: int,
        attachments_data: list[dict],
    ) -> list[MessageAttachment]:
        items = [
            MessageAttachment(
                message_id=message_id,
                **attachment_data,
            )
            for attachment_data in attachments_data
        ]

        db.add_all(items)
        await db.flush()

        return items

    async def get_by_chat_id(
        self,
        db: AsyncSession,
        chat_id: int,
    ) -> list[MessageAttachment]:
        stmt = (
            select(MessageAttachment)
            .join(Message, Message.id == MessageAttachment.message_id)
            .where(Message.chat_id == chat_id)
        )

        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def delete_by_chat_id(
        self,
        db: AsyncSession,
        chat_id: int,
    ) -> None:
        stmt = (
            delete(MessageAttachment)
            .where(
                MessageAttachment.message_id.in_(
                    select(Message.id).where(Message.chat_id == chat_id)
                )
            )
        )

        await db.execute(stmt)


chatcrud = ChatCrud()
messagecrud = MessageCrud()
messageattachmentcrud = MessageAttachmentCrud() 