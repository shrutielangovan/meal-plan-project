from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.database import get_db
from app.models.chat import ChatSession, ChatMessage
from app.schemas.chat import (
    ChatSessionCreate, ChatSessionResponse,
    ChatMessageCreate, ChatMessageResponse
)
from typing import List
from uuid import UUID

router = APIRouter()


@router.post("/{user_id}/sessions", response_model=ChatSessionResponse)
def create_session(user_id: UUID, session_in: ChatSessionCreate, db: Session = Depends(get_db)):
    session = ChatSession(user_id=user_id, title=session_in.title)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/{user_id}/sessions", response_model=List[ChatSessionResponse])
def get_sessions(
    user_id: UUID,
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db)
):
    return db.query(ChatSession).filter_by(
        user_id=user_id
    ).order_by(
        ChatSession.updated_at.desc()
    ).offset(offset).limit(limit).all()


@router.get("/{user_id}/sessions/{session_id}", response_model=ChatSessionResponse)
def get_session(user_id: UUID, session_id: UUID, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter_by(
        id=session_id, user_id=user_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/{user_id}/sessions/{session_id}/messages", response_model=ChatMessageResponse)
def add_message(
    user_id: UUID,
    session_id: UUID,
    message_in: ChatMessageCreate,
    db: Session = Depends(get_db)
):
    session = db.query(ChatSession).filter_by(
        id=session_id, user_id=user_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if message_in.role not in ["user", "assistant"]:
        raise HTTPException(status_code=400, detail="Role must be 'user' or 'assistant'")

    message = ChatMessage(
        session_id=session_id,
        role=message_in.role,
        content=message_in.content,
        intent=message_in.intent,
        extra_data=message_in.extra_data,
    )
    db.add(message)

    if not session.title and message_in.role == "user":
        session.title = message_in.content[:60]

    session.updated_at = func.now()
    db.commit()
    db.refresh(message)
    return message


@router.get("/{user_id}/sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
def get_messages(
    user_id: UUID,
    session_id: UUID,
    db: Session = Depends(get_db)
):
    session = db.query(ChatSession).filter_by(
        id=session_id, user_id=user_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return db.query(ChatMessage).filter_by(
        session_id=session_id
    ).order_by(ChatMessage.created_at.asc()).all()


@router.delete("/{user_id}/sessions/{session_id}")
def delete_session(user_id: UUID, session_id: UUID, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter_by(
        id=session_id, user_id=user_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"message": "Session deleted"}