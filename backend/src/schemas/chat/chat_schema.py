from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ChatAttachmentResponse(BaseModel):
    id: int
    file_url: str
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatMessageSenderResponse(BaseModel):
    id: int
    email: Optional[str] = None
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    photo_url: Optional[str] = None
    image_url: Optional[str] = None
    is_online: bool = False
    last_seen_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ChatMessageCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)


class ChatMessageResponse(BaseModel):
    id: int
    chat_id: int
    sender_id: int
    text: Optional[str] = None
    created_at: datetime
    read_at: Optional[datetime] = None
    sender: Optional[ChatMessageSenderResponse] = None
    attachments: list[ChatAttachmentResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class ChatResumeInfo(BaseModel):
    id: Optional[int] = None
    title: Optional[str] = None
    profession_name: Optional[str] = None
    applicant_name: Optional[str] = None
    applicant_full_name: Optional[str] = None
    applicant: Optional[ChatMessageSenderResponse] = None

    class Config:
        from_attributes = True


class ChatVacancyInfo(BaseModel):
    id: Optional[int] = None
    title: Optional[str] = None
    company_name: Optional[str] = None
    profession_name: Optional[str] = None
    company_logo_url: Optional[str] = None
    logo_url: Optional[str] = None
    image_url: Optional[str] = None
    status_id: Optional[int] = None
    status_name: Optional[str] = None

    class Config:
        from_attributes = True


class ChatApplicationInfo(BaseModel):
    id: int
    vacancy_id: int
    resume_id: int
    status: str
    created_at: datetime

    vacancy_title: Optional[str] = None
    resume_title: Optional[str] = None
    profession_name: Optional[str] = None
    applicant_name: Optional[str] = None
    applicant_full_name: Optional[str] = None

    vacancy: Optional[ChatVacancyInfo] = None
    resume: Optional[ChatResumeInfo] = None
    applicant: Optional[ChatMessageSenderResponse] = None

    class Config:
        from_attributes = True


class ChatListItemResponse(BaseModel):
    id: int
    application_id: int
    created_at: datetime

    application: Optional[ChatApplicationInfo] = None
    last_message: Optional[ChatMessageResponse] = None
    unread_count: int = 0
    companion: Optional[ChatMessageSenderResponse] = None
    can_write: bool = True
    is_rejected: bool = False
    lock_reason: Optional[str] = None

    class Config:
        from_attributes = True


class ChatDetailResponse(BaseModel):
    id: int
    application_id: int
    created_at: datetime

    application: Optional[ChatApplicationInfo] = None
    messages: list[ChatMessageResponse] = Field(default_factory=list)
    companion: Optional[ChatMessageSenderResponse] = None
    can_write: bool = True
    is_rejected: bool = False
    lock_reason: Optional[str] = None

    class Config:
        from_attributes = True


class ChatReadResponse(BaseModel):
    chat_id: int
    read_messages_count: int
    read_at: datetime


class ChatUnreadCountResponse(BaseModel):
    unread_count: int = 0
