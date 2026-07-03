"""User profile and preference API endpoints."""

import json
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.routes import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.city import City
from app.models.prefs import UserPref, UserTaste
from app.models.rate_limit import RateLimitBucket
from app.models.user import User
from app.models.verification import EmailVerificationToken

router = APIRouter(prefix="/api/me", tags=["user"])


# ── Schemas ──

class UserProfile(BaseModel):
    id: int
    email: str
    email_verified: bool
    role: str
    display_name: str | None = None


class TasteEntry(BaseModel):
    kind: str  # like | soft_dislike | cuisine | spice | learned
    value: str
    weight: float = 1.0
    source: str = "onboarding"


class PreferencesUpdate(BaseModel):
    default_condition: str | None = None
    default_conditions: list[str] = []
    default_sex: str | None = None
    default_city_id: int | None = None
    daily_budget_idr: int | None = None
    per_meal_budget_idr: int | None = None
    variety_appetite: float | None = Field(None, ge=0, le=1)
    prep_lean: str | None = None  # buy_ready | simple_cook | balanced
    exclusions: list[str] | None = None
    tastes: list[TasteEntry] | None = None  # rich preference entries


class PreferencesResponse(BaseModel):
    default_condition: str | None = None
    default_conditions: list[str] = []
    default_sex: str | None = None
    default_city_id: int | None = None
    daily_budget_idr: int | None = None
    per_meal_budget_idr: int | None = None
    variety_appetite: float | None = None
    prep_lean: str | None = None
    exclusions: list[str] = []
    tastes: list[TasteEntry] = []


# ── Endpoints ──

@router.get("", response_model=UserProfile)
async def get_profile(user: User = Depends(get_current_user)):
    """Return the current user's profile."""
    return UserProfile(
        id=user.id,
        email=user.email,
        email_verified=bool(user.email_verified),
        role=user.role,
        display_name=user.display_name,
    )


@router.get("/preferences", response_model=PreferencesResponse)
async def get_preferences(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's taste preferences."""
    result = await db.execute(select(UserPref).where(UserPref.user_id == user.id))
    pref = result.scalar_one_or_none()

    result = await db.execute(
        select(UserTaste).where(UserTaste.user_id == user.id)
    )
    tastes = result.scalars().all()

    exclusions = []
    if pref and pref.exclusions_json:
        exclusions = json.loads(pref.exclusions_json)

    # Decode default_condition (comma-separated) into list
    default_conditions = []
    if pref and pref.default_condition:
        default_conditions = [c.strip() for c in pref.default_condition.split(",") if c.strip()]

    return PreferencesResponse(
        default_condition=pref.default_condition if pref else None,
        default_conditions=default_conditions,
        default_sex=pref.default_sex if pref else None,
        default_city_id=pref.default_city_id if pref else None,
        daily_budget_idr=pref.daily_budget_idr if pref else None,
        per_meal_budget_idr=pref.per_meal_budget_idr if pref else None,
        variety_appetite=pref.variety_appetite if pref else None,
        prep_lean=pref.prep_lean if pref else None,
        exclusions=exclusions,
        tastes=[
            TasteEntry(kind=t.kind, value=t.value, weight=t.weight, source=t.source)
            for t in tastes
        ],
    )


@router.put("/preferences", response_model=PreferencesResponse)
async def update_preferences(
    body: PreferencesUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's taste preferences."""
    # Upsert UserPref
    result = await db.execute(select(UserPref).where(UserPref.user_id == user.id))
    pref = result.scalar_one_or_none()

    if pref:
        for field in ("default_condition", "default_sex", "default_city_id",
                       "daily_budget_idr", "per_meal_budget_idr",
                       "variety_appetite", "prep_lean"):
            val = getattr(body, field, None)
            if val is not None:
                setattr(pref, field, val)
        # If default_conditions (list) is provided, encode it as comma-separated
        if body.default_conditions:
            pref.default_condition = ",".join(body.default_conditions)
        if body.exclusions is not None:
            pref.exclusions_json = json.dumps(body.exclusions)
    else:
        # Determine condition field: prefer default_conditions list, fall back to string
        condition_str = body.default_condition
        if body.default_conditions:
            condition_str = ",".join(body.default_conditions)
        pref = UserPref(
            user_id=user.id,
            default_condition=condition_str,
            default_sex=body.default_sex,
            default_city_id=body.default_city_id,
            daily_budget_idr=body.daily_budget_idr,
            per_meal_budget_idr=body.per_meal_budget_idr,
            variety_appetite=body.variety_appetite,
            prep_lean=body.prep_lean,
            exclusions_json=json.dumps(body.exclusions) if body.exclusions else None,
        )
        db.add(pref)

    # Replace tastes if provided
    if body.tastes is not None:
        # Delete old tastes
        old = await db.execute(select(UserTaste).where(UserTaste.user_id == user.id))
        for t in old.scalars().all():
            await db.delete(t)

        for entry in body.tastes:
            taste = UserTaste(
                user_id=user.id,
                kind=entry.kind,
                value=entry.value,
                weight=entry.weight,
                source=entry.source,
            )
            db.add(taste)

    await db.flush()
    await db.refresh(pref)

    # Fetch updated tastes
    result = await db.execute(
        select(UserTaste).where(UserTaste.user_id == user.id)
    )
    tastes = result.scalars().all()

    exclusions = []
    if pref.exclusions_json:
        exclusions = json.loads(pref.exclusions_json)

    # Decode default_condition (comma-separated) into list
    default_conditions = []
    if pref.default_condition:
        default_conditions = [c.strip() for c in pref.default_condition.split(",") if c.strip()]

    return PreferencesResponse(
        default_condition=pref.default_condition,
        default_conditions=default_conditions,
        default_sex=pref.default_sex,
        default_city_id=pref.default_city_id,
        daily_budget_idr=pref.daily_budget_idr,
        per_meal_budget_idr=pref.per_meal_budget_idr,
        variety_appetite=pref.variety_appetite,
        prep_lean=pref.prep_lean,
        exclusions=exclusions,
        tastes=[
            TasteEntry(kind=t.kind, value=t.value, weight=t.weight, source=t.source)
            for t in tastes
        ],
    )


# ── Email verification ──

@router.post("/send-verification")
async def send_verification_email(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate and return a verification token (SMTP not configured → show inline)."""
    if user.email_verified:
        return {"message": "Email already verified"}

    # Invalidate old tokens
    old = await db.execute(
        select(EmailVerificationToken).where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.used == False,  # noqa: E712
        )
    )
    for t in old.scalars().all():
        t.used = True

    # Create new token
    token = secrets.token_urlsafe(48)
    verification = EmailVerificationToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(verification)
    await db.flush()

    # If SMTP is configured, send real email
    if settings.smtp_host:
        # TODO: implement SMTP sending
        pass

    return {
        "message": "Verification token generated",
        "verification_url": f"{settings.app_url or 'http://localhost:8000'}/api/auth/verify-email?token={token}",
        "token": token,  # In production, send via email only
    }


@router.get("/verify-email")
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Verify email using a one-time token."""
    result = await db.execute(
        select(EmailVerificationToken).where(
            EmailVerificationToken.token == token,
            EmailVerificationToken.used == False,  # noqa: E712
        )
    )
    verification = result.scalar_one_or_none()

    if not verification:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    if datetime.now(timezone.utc) > verification.expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token expired")

    # Mark token used and verify user
    verification.used = True
    user_result = await db.execute(select(User).where(User.id == verification.user_id))
    user = user_result.scalar_one()
    user.email_verified = True
    await db.flush()

    return {"message": "Email verified successfully"}


# ── Change Password ──


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the current user's password."""
    from app.core.security import hash_password, verify_password

    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password lama salah",
        )

    if body.old_password == body.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password baru harus berbeda dari password lama",
        )

    user.password_hash = hash_password(body.new_password)
    await db.flush()

    return {"message": "Password berhasil diubah"}


# ── Rate limit check ──

async def check_rate_limit(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Middleware-like dependency for rate limiting plan/chat endpoints."""
    today = datetime.now(timezone.utc).date()
    path = request.url.path

    result = await db.execute(
        select(RateLimitBucket).where(
            RateLimitBucket.user_id == user.id,
            RateLimitBucket.day == today,
        )
    )
    bucket = result.scalar_one_or_none()

    if not bucket:
        bucket = RateLimitBucket(user_id=user.id, day=today)
        db.add(bucket)
        await db.flush()

    if "/api/plan" in path and bucket.plan_count >= settings.daily_plan_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily plan limit reached ({settings.daily_plan_limit})",
        )
    if "/api/chat" in path and bucket.chat_count >= settings.daily_chat_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily chat limit reached ({settings.daily_chat_limit})",
        )

    return user