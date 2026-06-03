import asyncio
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import AccessDeniedError
from src.cruds.chat.chat_crud import chatcrud, messageattachmentcrud, messagecrud
from src.models.model import Chat, User
from src.schemas.chat.chat_schema import ChatMessageCreate
from src.services.files.file_storage_service import (
    FileStorageError,
    FileValidationError,
    StoredFile,
    file_storage_service,
)


def utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class ChatService:
    def __init__(self):
        self.chatcrud = chatcrud
        self.messagecrud = messagecrud
        self.messageattachmentcrud = messageattachmentcrud
        self.file_storage_service = file_storage_service

    def _get_last_message(self, chat: Chat):
        if not chat.messages:
            return None

        return sorted(
            chat.messages,
            key=lambda message: message.created_at,
        )[-1]

    def _is_applicant_chat_member(
        self,
        chat: Chat,
        applicant_id: int,
    ) -> bool:
        application = chat.application

        if not application:
            return False

        resume = application.resume

        if not resume:
            return False

        return resume.applicant_id == applicant_id

    def _is_company_chat_member(
        self,
        chat: Chat,
        company_id: int,
    ) -> bool:
        application = chat.application

        if not application:
            return False

        vacancy = application.vacancy

        if not vacancy:
            return False

        return vacancy.company_id == company_id

    def _check_chat_access(
        self,
        chat: Chat,
        current_user: User,
    ) -> None:
        if current_user.applicant_id:
            if self._is_applicant_chat_member(
                chat=chat,
                applicant_id=current_user.applicant_id,
            ):
                return

        if current_user.company_id:
            if self._is_company_chat_member(
                chat=chat,
                company_id=current_user.company_id,
            ):
                return

        raise AccessDeniedError("У вас нет доступа к этому чату")

    @staticmethod
    def _safe_attr(obj: Any, *names: str) -> Any:
        if not obj:
            return None

        for name in names:
            value = getattr(obj, name, None)
            if value:
                return value

        return None

    def _build_full_name(self, obj: Any) -> str:
        if not obj:
            return ""

        full_name = self._safe_attr(obj, "full_name", "name")
        if full_name:
            return str(full_name).strip()

        parts = [
            getattr(obj, "last_name", None),
            getattr(obj, "first_name", None),
            getattr(obj, "middle_name", None),
        ]

        return " ".join(str(part).strip() for part in parts if part).strip()

    def _extract_file_url(self, value: Any) -> Optional[str]:
        """
        Достаёт URL из обычного строкового поля или из связанной модели файла/картинки.
        Нужно потому, что в разных моделях проекта аватар/логотип может храниться
        как строка или как объект с file_url/url/path.
        """
        if not value:
            return None

        if isinstance(value, str):
            return value.strip() or None

        return self._safe_attr(
            value,
            "file_url",
            "url",
            "path",
            "src",
            "image_url",
            "photo_url",
            "avatar_url",
            "logo_url",
        )

    def _avatar_url(self, obj: Any) -> Optional[str]:
        if not obj:
            return None

        # 1. Сначала пробуем прямые строковые поля.
        direct_value = self._safe_attr(
            obj,
            "avatar_url",
            "avatar",
            "photo_url",
            "photo",
            "image_url",
            "image",
            "logo_url",
            "logo",
            "file_url",
            "photo_file_url",
            "logo_file_url",
            "avatar_file_url",
            "picture_url",
            "picture",
        )

        extracted_direct = self._extract_file_url(direct_value)
        if extracted_direct:
            return extracted_direct

        # 2. Потом пробуем частые имена связанных объектов.
        for relation_name in (
            "avatar_file",
            "photo_file",
            "image_file",
            "logo_file",
            "avatar_image",
            "photo_image",
            "company_logo",
            "logo_image",
            "file",
            "attachment",
        ):
            extracted_relation = self._extract_file_url(getattr(obj, relation_name, None))
            if extracted_relation:
                return extracted_relation

        return None

    def _serialize_user_like(self, obj: Any, fallback_id: Optional[int] = None) -> Optional[dict[str, Any]]:
        if not obj:
            return None

        user = getattr(obj, "user", None) or obj
        user_id = getattr(user, "id", None) or fallback_id or getattr(obj, "id", None)

        if not user_id:
            return None

        full_name = self._build_full_name(obj) or self._build_full_name(user)

        return {
            "id": user_id,
            "email": getattr(user, "email", None),
            "name": full_name or getattr(obj, "name", None),
            "first_name": getattr(obj, "first_name", None) or getattr(user, "first_name", None),
            "last_name": getattr(obj, "last_name", None) or getattr(user, "last_name", None),
            "middle_name": getattr(obj, "middle_name", None) or getattr(user, "middle_name", None),
            "full_name": full_name,
            "avatar_url": self._avatar_url(obj) or self._avatar_url(user),
            "photo_url": self._safe_attr(obj, "photo_url") or self._safe_attr(user, "photo_url"),
            "image_url": self._safe_attr(obj, "image_url") or self._safe_attr(user, "image_url"),
            "is_online": bool(getattr(user, "is_online", False)),
            "last_seen_at": getattr(user, "last_seen_at", None),
        }

    def _get_application_resume_title(self, application: Any) -> str:
        resume = getattr(application, "resume", None)
        profession = getattr(resume, "profession", None) if resume else None

        return (
            self._safe_attr(application, "resume_title")
            or self._safe_attr(resume, "title", "profession_name")
            or self._safe_attr(profession, "name")
            or self._safe_attr(application, "profession_name")
            or ""
        )

    def _get_application_vacancy_title(self, application: Any) -> str:
        vacancy = getattr(application, "vacancy", None)
        profession = getattr(vacancy, "profession", None) if vacancy else None

        return (
            self._safe_attr(application, "vacancy_title")
            or self._safe_attr(vacancy, "title", "profession_name")
            or self._safe_attr(profession, "name")
            or self._safe_attr(application, "profession_name")
            or ""
        )

    def _serialize_application(self, application: Any) -> Optional[dict[str, Any]]:
        if not application:
            return None

        vacancy = getattr(application, "vacancy", None)
        resume = getattr(application, "resume", None)
        applicant = getattr(resume, "applicant", None) if resume else None
        company = getattr(vacancy, "company", None) if vacancy else None
        profession = getattr(resume, "profession", None) or getattr(vacancy, "profession", None)
        vacancy_status = getattr(vacancy, "status", None)

        applicant_name = self._build_full_name(applicant)
        company_name = self._safe_attr(company, "name", "company_name")

        return {
            "id": application.id,
            "vacancy_id": application.vacancy_id,
            "resume_id": application.resume_id,
            "status": application.status,
            "created_at": application.created_at,
            "vacancy_title": self._get_application_vacancy_title(application),
            "resume_title": self._get_application_resume_title(application),
            "profession_name": self._safe_attr(profession, "name"),
            "applicant_name": applicant_name,
            "applicant_full_name": applicant_name,
            "applicant": self._serialize_user_like(applicant),
            "resume": {
                "id": getattr(resume, "id", None),
                "title": self._safe_attr(resume, "title"),
                "profession_name": self._safe_attr(profession, "name"),
                "applicant_name": applicant_name,
                "applicant_full_name": applicant_name,
                "applicant": self._serialize_user_like(applicant),
            } if resume else None,
            "vacancy": {
                "id": getattr(vacancy, "id", None),
                "title": self._safe_attr(vacancy, "title"),
                "company_name": company_name,
                "profession_name": self._safe_attr(profession, "name"),
                "company_logo_url": self._avatar_url(company),
                "logo_url": self._avatar_url(company),
                "image_url": self._safe_attr(company, "image_url"),
                "status_id": getattr(vacancy_status, "id", None) or getattr(vacancy, "status_id", None),
                "status_name": self._safe_attr(vacancy_status, "name") or self._safe_attr(vacancy, "status_name"),
            } if vacancy else None,
        }

    def _get_companion(self, chat: Chat, current_user: Optional[User] = None) -> Optional[dict[str, Any]]:
        application = chat.application

        if not application:
            return None

        resume = getattr(application, "resume", None)
        vacancy = getattr(application, "vacancy", None)
        applicant = getattr(resume, "applicant", None) if resume else None
        company = getattr(vacancy, "company", None) if vacancy else None

        if current_user and current_user.company_id:
            return self._serialize_user_like(applicant)

        if current_user and current_user.applicant_id:
            return self._serialize_user_like(company)

        return self._serialize_user_like(applicant) or self._serialize_user_like(company)

    def _serialize_message(self, message) -> dict[str, Any]:
        return {
            "id": message.id,
            "chat_id": message.chat_id,
            "sender_id": message.sender_id,
            "text": message.text,
            "created_at": message.created_at,
            "read_at": message.read_at,
            "sender": self._serialize_user_like(
                getattr(message.sender, "applicant", None)
                or getattr(message.sender, "company", None)
                or message.sender
            ),
            "attachments": [
                {
                    "id": attachment.id,
                    "file_url": attachment.file_url,
                    "file_name": attachment.file_name,
                    "file_type": attachment.file_type,
                    "file_size": attachment.file_size,
                    "created_at": attachment.created_at,
                }
                for attachment in message.attachments
            ],
        }

    async def _serialize_chat_list_item(
        self,
        db: AsyncSession,
        chat: Chat,
        current_user: User,
    ) -> dict[str, Any]:
        last_message = self._get_last_message(chat)

        unread_count = await self.messagecrud.count_unread_by_chat_id(
            db=db,
            chat_id=chat.id,
            current_user_id=current_user.id,
        )

        return {
            "id": chat.id,
            "application_id": chat.application_id,
            "created_at": chat.created_at,
            "application": self._serialize_application(chat.application),
            "last_message": self._serialize_message(last_message) if last_message else None,
            "unread_count": unread_count,
            "companion": self._get_companion(chat, current_user),
            "can_write": True,
            "is_rejected": str(getattr(chat.application, "status", "")).lower() in ("rejected", "отказ"),
            "lock_reason": None,
        }

    def _serialize_chat_detail(
        self,
        chat: Chat,
        current_user: Optional[User] = None,
    ) -> dict[str, Any]:
        return {
            "id": chat.id,
            "application_id": chat.application_id,
            "created_at": chat.created_at,
            "application": self._serialize_application(chat.application),
            "messages": [
                self._serialize_message(message)
                for message in sorted(
                    chat.messages,
                    key=lambda item: item.created_at,
                )
            ],
            "companion": self._get_companion(chat, current_user),
            "can_write": True,
            "is_rejected": str(getattr(chat.application, "status", "")).lower() in ("rejected", "отказ"),
            "lock_reason": None,
        }

    async def get_unread_count(
        self,
        db: AsyncSession,
        current_user: User,
    ) -> dict[str, int]:
        unread_count = await self.messagecrud.count_total_unread_for_user(
            db=db,
            current_user_id=current_user.id,
            applicant_id=current_user.applicant_id,
            company_id=current_user.company_id,
        )

        return {
            "unread_count": unread_count,
        }

    async def get_my_chats(
        self,
        db: AsyncSession,
        current_user: User,
        skip: int = 0,
        limit: int = 20,
    ):
        if current_user.applicant_id:
            chats = await self.chatcrud.get_by_applicant_id(
                db=db,
                applicant_id=current_user.applicant_id,
                skip=skip,
                limit=limit,
            )

            result = []

            for chat in chats:
                result.append(
                    await self._serialize_chat_list_item(
                        db=db,
                        chat=chat,
                        current_user=current_user,
                    )
                )

            return result

        if current_user.company_id:
            chats = await self.chatcrud.get_by_company_id(
                db=db,
                company_id=current_user.company_id,
                skip=skip,
                limit=limit,
            )

            result = []

            for chat in chats:
                result.append(
                    await self._serialize_chat_list_item(
                        db=db,
                        chat=chat,
                        current_user=current_user,
                    )
                )

            return result

        raise AccessDeniedError("У пользователя нет профиля соискателя или компании")

    async def get_chat_detail(
        self,
        db: AsyncSession,
        chat_id: int,
        current_user: User,
    ):
        chat = await self.chatcrud.get_with_details(
            db=db,
            chat_id=chat_id,
        )

        if not chat:
            raise AccessDeniedError("Чат не найден или нет доступа")

        self._check_chat_access(
            chat=chat,
            current_user=current_user,
        )

        return self._serialize_chat_detail(chat, current_user)

    async def get_chat_messages(
        self,
        db: AsyncSession,
        chat_id: int,
        current_user: User,
        skip: int = 0,
        limit: int = 50,
    ):
        chat = await self.chatcrud.get_with_details(
            db=db,
            chat_id=chat_id,
        )

        if not chat:
            raise AccessDeniedError("Чат не найден или нет доступа")

        self._check_chat_access(
            chat=chat,
            current_user=current_user,
        )

        messages = await self.messagecrud.get_by_chat_id(
            db=db,
            chat_id=chat_id,
            skip=skip,
            limit=limit,
        )

        return [
            self._serialize_message(message)
            for message in messages
        ]

    async def _create_message_with_uploaded_attachments(
        self,
        db: AsyncSession,
        chat_id: int,
        current_user: User,
        text: Optional[str],
        uploaded_files: list[StoredFile],
    ) -> dict:
        normalized_text = (text or "").strip() or None

        if not normalized_text and not uploaded_files:
            raise ValueError("Сообщение не может быть пустым")

        now = utc_now_naive()

        message = await self.messagecrud.create(
            db=db,
            obj_data={
                "chat_id": chat_id,
                "sender_id": current_user.id,
                "text": normalized_text,
                "created_at": now,
                "read_at": None,
            },
        )

        await self.messageattachmentcrud.create_many_for_message(
            db=db,
            message_id=message.id,
            attachments_data=[
                {
                    "file_url": uploaded.file_url,
                    "file_name": uploaded.file_name,
                    "file_type": uploaded.file_type,
                    "file_size": uploaded.file_size,
                    "created_at": now,
                }
                for uploaded in uploaded_files
            ],
        )

        await db.commit()

        created_message = await self.messagecrud.get_by_id_with_details(
            db=db,
            message_id=message.id,
        )

        if not created_message:
            raise ValueError("Не удалось получить созданное сообщение")

        return self._serialize_message(created_message)

    async def send_message(
        self,
        db: AsyncSession,
        chat_id: int,
        current_user: User,
        message_data: ChatMessageCreate,
    ):
        chat = await self.chatcrud.get_with_details(
            db=db,
            chat_id=chat_id,
        )

        if not chat:
            raise AccessDeniedError("Чат не найден или нет доступа")

        self._check_chat_access(
            chat=chat,
            current_user=current_user,
        )

        text = message_data.text.strip()

        if not text:
            raise ValueError("Сообщение не может быть пустым")

        return await self._create_message_with_uploaded_attachments(
            db=db,
            chat_id=chat_id,
            current_user=current_user,
            text=text,
            uploaded_files=[],
        )

    async def send_message_with_files(
        self,
        db: AsyncSession,
        chat_id: int,
        current_user: User,
        text: Optional[str],
        files: list[UploadFile],
    ):
        chat = await self.chatcrud.get_with_details(
            db=db,
            chat_id=chat_id,
        )

        if not chat:
            raise AccessDeniedError("Чат не найден или нет доступа")

        self._check_chat_access(
            chat=chat,
            current_user=current_user,
        )

        normalized_text = (text or "").strip()

        if len(normalized_text) > 5000:
            raise ValueError("Сообщение должно быть не длиннее 5000 символов")

        clean_files = [file for file in files if file and file.filename]

        if len(clean_files) > self.file_storage_service.max_chat_files_per_message:
            raise ValueError(
                f"Можно отправить не больше "
                f"{self.file_storage_service.max_chat_files_per_message} файлов за раз"
            )

        if not normalized_text and not clean_files:
            raise ValueError("Добавьте текст или файл")

        uploaded_files: list[StoredFile] = []

        try:
            if clean_files:
                uploaded_files = list(
                    await asyncio.gather(
                        *(
                            self.file_storage_service.upload_chat_file(
                                chat_id=chat_id,
                                file=file,
                            )
                            for file in clean_files
                        )
                    )
                )

            return await self._create_message_with_uploaded_attachments(
                db=db,
                chat_id=chat_id,
                current_user=current_user,
                text=normalized_text,
                uploaded_files=uploaded_files,
            )

        except (FileValidationError, FileStorageError) as e:
            for uploaded in uploaded_files:
                await self.file_storage_service.delete_file(uploaded.object_key)

            await db.rollback()
            raise ValueError(str(e))

        except Exception:
            for uploaded in uploaded_files:
                await self.file_storage_service.delete_file(uploaded.object_key)

            await db.rollback()
            raise

    async def mark_chat_as_read(
        self,
        db: AsyncSession,
        chat_id: int,
        current_user: User,
    ):
        chat = await self.chatcrud.get_with_details(
            db=db,
            chat_id=chat_id,
        )

        if not chat:
            raise AccessDeniedError("Чат не найден или нет доступа")

        self._check_chat_access(
            chat=chat,
            current_user=current_user,
        )

        read_at = utc_now_naive()

        read_messages_count = await self.messagecrud.mark_chat_messages_as_read(
            db=db,
            chat_id=chat_id,
            current_user_id=current_user.id,
            read_at=read_at,
        )

        await db.commit()

        return {
            "chat_id": chat_id,
            "read_messages_count": read_messages_count,
            "read_at": read_at,
        }

    async def delete_chat_files_from_storage(
        self,
        db: AsyncSession,
        chat_id: int,
        *,
        commit: bool = True,
    ) -> int:
        """
        Удаляет все файлы/фото конкретного чата из S3/MinIO и удаляет записи attachments из БД.

        Миграция не нужна: берём attachment.file_url, а file_storage_service.delete_file()
        уже умеет доставать object_key из публичного URL.
        """
        attachments = await self.messageattachmentcrud.get_by_chat_id(
            db=db,
            chat_id=chat_id,
        )

        deleted_count = 0

        for attachment in attachments:
            file_url = getattr(attachment, "file_url", None)

            if not file_url:
                continue

            await self.file_storage_service.delete_file(file_url)
            deleted_count += 1

        await self.messageattachmentcrud.delete_by_chat_id(
            db=db,
            chat_id=chat_id,
        )

        if commit:
            await db.commit()
        else:
            await db.flush()

        return deleted_count

    async def delete_application_chat_files_from_storage(
        self,
        db: AsyncSession,
        application_id: int,
        *,
        commit: bool = True,
    ) -> int:
        """
        Удаляет файлы чата по отклику.
        Вызывай после изменения статуса отклика на rejected/отказ.
        """
        chat = await self.chatcrud.get_by_application_id(
            db=db,
            application_id=application_id,
        )

        if not chat:
            return 0

        return await self.delete_chat_files_from_storage(
            db=db,
            chat_id=chat.id,
            commit=commit,
        )

    async def delete_vacancy_chat_files_from_storage(
        self,
        db: AsyncSession,
        vacancy_id: int,
        *,
        commit: bool = True,
    ) -> int:
        """
        Удаляет файлы всех чатов по вакансии.
        Вызывай после удаления или архивации вакансии.
        """
        chats = await self.chatcrud.get_by_vacancy_id(
            db=db,
            vacancy_id=vacancy_id,
        )

        deleted_count = 0

        for chat in chats:
            deleted_count += await self.delete_chat_files_from_storage(
                db=db,
                chat_id=chat.id,
                commit=False,
            )

        if commit:
            await db.commit()
        else:
            await db.flush()

        return deleted_count

    async def check_user_has_chat_access(
        self,
        db: AsyncSession,
        chat_id: int,
        current_user: User,
    ) -> Chat:
        chat = await self.chatcrud.get_with_details(
            db=db,
            chat_id=chat_id,
        )

        if not chat:
            raise AccessDeniedError("Чат не найден или нет доступа")

        self._check_chat_access(
            chat=chat,
            current_user=current_user,
        )

        return chat


chat_service = ChatService()