from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class SupportTicketCreate(BaseModel):
    subject: str
    message: str


class SupportTicketResponse(BaseModel):
    id:                  UUID
    user_id:             UUID
    ticket_id:           str
    subject:             str
    message:             str
    status:              str
    follow_up_requested: bool
    follow_up_count:     int
    created_at:          datetime

    class Config:
        from_attributes = True


class FollowUpRequest(BaseModel):
    ticket_id: str