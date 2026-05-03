import uuid
from sqlalchemy import Column, String, Integer, TIMESTAMP, Text, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class SupportTicket(Base):
    """
    Support ticket submitted by a user.
    Linked to users table via CASCADE delete.
    """
    __tablename__ = "support_tickets"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id             = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ticket_id           = Column(String(20), unique=True, nullable=False)  # e.g. TKT-00001
    subject             = Column(String(255), nullable=False)
    message             = Column(Text, nullable=False)
    status              = Column(String(50), default="open")               # open / resolved / closed
    follow_up_requested = Column(Boolean, default=False)
    follow_up_count     = Column(Integer, default=0)
    created_at          = Column(TIMESTAMP, server_default=func.now())
    updated_at          = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="support_tickets")