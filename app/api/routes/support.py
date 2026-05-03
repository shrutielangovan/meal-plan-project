"""
Support system API routes for NutriSync.

Endpoints:
  POST /api/support/submit              — user submits a ticket
  POST /api/support/followup            — user flags a follow-up
  GET  /api/support/tickets/{user_id}   — list user's tickets
"""

import smtplib
import uuid as uuid_lib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.models.support import SupportTicket
from app.models.user import User
from app.schemas.support import SupportTicketCreate, SupportTicketResponse, FollowUpRequest
from app.core.config import settings

router = APIRouter()


# ── Email helper ──────────────────────────────────────────────────────────────

def send_email(to: str, subject: str, html_body: str):
    """Send email via Gmail SMTP using credentials from .env"""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = settings.SUPPORT_EMAIL
        msg["To"]      = to
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(settings.SUPPORT_EMAIL, settings.GMAIL_APP_PASSWORD)
            server.sendmail(settings.SUPPORT_EMAIL, to, msg.as_string())
    except Exception as e:
        print(f"[Support] Email failed: {e}")


def generate_ticket_id(db: Session) -> str:
    count = db.query(SupportTicket).count()
    return f"TKT-{str(count + 1).zfill(5)}"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/submit", response_model=SupportTicketResponse)
def submit_ticket(
    user_id: UUID,
    body: SupportTicketCreate,
    db: Session = Depends(get_db),
):
    """
    User submits a support ticket.
    Sends confirmation email to user and notification to support inbox.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    ticket_id = generate_ticket_id(db)

    ticket = SupportTicket(
        user_id   = user.id,
        ticket_id = ticket_id,
        subject   = body.subject.strip(),
        message   = body.message.strip(),
        status    = "open",
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # Email to user — confirmation
    user_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;padding:32px;background:#f9f9f9;border-radius:12px">
      <h2 style="color:#6d28d9">NutriSync Support</h2>
      <p>We received your support request. Here are your ticket details:</p>
      <div style="background:#fff;border-radius:8px;padding:16px;margin:16px 0">
        <p><strong>Ticket ID:</strong> {ticket_id}</p>
        <p><strong>Subject:</strong> {body.subject}</p>
        <p><strong>Message:</strong> {body.message}</p>
      </div>
      <p style="color:#6b7280;font-size:14px">Our team will get back to you as soon as possible.</p>
    </div>
    """
    send_email(to=user.email, subject=f"Support ticket received — {ticket_id}", html_body=user_html)

    # Email to support inbox — full details
    support_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;padding:32px;background:#f9f9f9;border-radius:12px">
      <h2 style="color:#6d28d9">New Support Ticket</h2>
      <p><strong>Ticket ID:</strong> {ticket_id}</p>
      <p><strong>From:</strong> {user.email}</p>
      <p><strong>User ID:</strong> {user.id}</p>
      <p><strong>Subject:</strong> {body.subject}</p>
      <p><strong>Message:</strong> {body.message}</p>
    </div>
    """
    send_email(to=settings.SUPPORT_EMAIL, subject=f"[NutriSync] New ticket {ticket_id} from {user.email}", html_body=support_html)

    return ticket


@router.post("/followup")
def flag_followup(
    user_id: UUID,
    body: FollowUpRequest,
    db: Session = Depends(get_db),
):
    """
    User flags a follow-up on an existing ticket.
    Sends priority email to support inbox.
    Button is disabled on frontend after follow-up sent.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    ticket = db.query(SupportTicket).filter(
        SupportTicket.ticket_id == body.ticket_id,
        SupportTicket.user_id   == user_id,
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.follow_up_requested:
        raise HTTPException(status_code=400, detail="Follow-up already sent for this ticket")

    ticket.follow_up_requested = True
    ticket.follow_up_count    += 1
    db.commit()

    followup_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;padding:32px;background:#fef3c7;border-radius:12px">
      <h2 style="color:#d97706">⚠️ Follow-up Requested</h2>
      <p><strong>Ticket ID:</strong> {ticket.ticket_id}</p>
      <p><strong>From:</strong> {user.email}</p>
      <p><strong>Subject:</strong> {ticket.subject}</p>
      <p><strong>Original Message:</strong> {ticket.message}</p>
      <p style="color:#92400e">This user has not received a response and is requesting a follow-up.</p>
    </div>
    """
    send_email(
        to=settings.SUPPORT_EMAIL,
        subject=f"[FOLLOW-UP] Ticket {ticket.ticket_id} — {user.email}",
        html_body=followup_html,
    )

    return {"success": True, "message": "Follow-up flagged and support team notified"}


@router.get("/tickets/{user_id}", response_model=list[SupportTicketResponse])
def get_user_tickets(user_id: UUID, db: Session = Depends(get_db)):
    """List all support tickets submitted by a user, newest first."""
    tickets = (
        db.query(SupportTicket)
        .filter(SupportTicket.user_id == user_id)
        .order_by(SupportTicket.created_at.desc())
        .all()
    )
    return tickets