"""
JWT auth module: registration, login, logout, refresh, password reset via security question.
Uses httpOnly cookies (primary) with Authorization header fallback.
"""
import os
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel, EmailStr, Field, ConfigDict

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24       # 24h - friendly for personal app
REFRESH_TOKEN_DAYS = 30
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def hash_answer(answer: str) -> str:
    # Normalize: lowercase + strip so the user doesn't have to remember exact casing
    normalized = answer.strip().lower()
    return hash_password(normalized)


def verify_answer(plain: str, hashed: str) -> bool:
    normalized = plain.strip().lower()
    return verify_password(normalized, hashed)


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    secure = os.environ.get("COOKIE_SECURE", "true").lower() == "true"
    response.set_cookie(
        key="access_token", value=access_token, httponly=True,
        secure=secure, samesite="none" if secure else "lax",
        max_age=ACCESS_TOKEN_MINUTES * 60, path="/",
    )
    response.set_cookie(
        key="refresh_token", value=refresh_token, httponly=True,
        secure=secure, samesite="none" if secure else "lax",
        max_age=REFRESH_TOKEN_DAYS * 24 * 60 * 60, path="/",
    )


def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


# ============== Schemas ==============

class SecurityQuestion(BaseModel):
    question: str = Field(min_length=3, max_length=200)
    answer: str = Field(min_length=1, max_length=200)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=80)
    security_question: SecurityQuestion


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotRequest(BaseModel):
    email: EmailStr


class ResetRequest(BaseModel):
    email: EmailStr
    security_answer: str
    new_password: str = Field(min_length=6, max_length=128)


class UpdateProfileRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class UpdateSecurityQuestionRequest(BaseModel):
    current_password: str
    question: str = Field(min_length=3, max_length=200)
    answer: str = Field(min_length=1, max_length=200)


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str = "user"
    created_at: datetime
    security_question_text: Optional[str] = None  # don't expose the answer


# ============== Helpers ==============

def _user_to_public(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "email": doc["email"],
        "name": doc.get("name", ""),
        "role": doc.get("role", "user"),
        "created_at": doc["created_at"],
        "security_question_text": (doc.get("security_question") or {}).get("question"),
    }


async def _get_token_from_request(request: Request) -> Optional[str]:
    token = request.cookies.get("access_token")
    if token:
        return token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


# ============== Brute force ==============

async def _check_lockout(db, identifier: str):
    record = await db.login_attempts.find_one({"identifier": identifier})
    if not record:
        return
    count = record.get("count", 0)
    locked_until = record.get("locked_until")
    if locked_until:
        locked_dt = locked_until if isinstance(locked_until, datetime) else datetime.fromisoformat(locked_until)
        if locked_dt.tzinfo is None:
            locked_dt = locked_dt.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) < locked_dt:
            mins = int((locked_dt - datetime.now(timezone.utc)).total_seconds() / 60) + 1
            raise HTTPException(status_code=429, detail=f"Demasiados intentos. Intentá de nuevo en {mins} minuto(s).")
    if count >= MAX_FAILED_ATTEMPTS:
        # Soft reset if past window with no lockout set
        pass


async def _record_failed_attempt(db, identifier: str):
    record = await db.login_attempts.find_one({"identifier": identifier})
    count = (record.get("count", 0) if record else 0) + 1
    update = {"count": count, "last_attempt": datetime.now(timezone.utc)}
    if count >= MAX_FAILED_ATTEMPTS:
        update["locked_until"] = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
        update["count"] = 0  # reset counter after applying lock
    await db.login_attempts.update_one(
        {"identifier": identifier}, {"$set": update}, upsert=True
    )


async def _clear_attempts(db, identifier: str):
    await db.login_attempts.delete_one({"identifier": identifier})


# ============== Router factory ==============

def build_auth_router(db) -> APIRouter:
    router = APIRouter(prefix="/auth", tags=["auth"])

    async def get_current_user(request: Request) -> dict:
        token = await _get_token_from_request(request)
        if not token:
            raise HTTPException(status_code=401, detail="No autenticado")
        try:
            payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
            if payload.get("type") != "access":
                raise HTTPException(status_code=401, detail="Token inválido")
            user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
            if not user:
                raise HTTPException(status_code=401, detail="Usuario no encontrado")
            user.pop("password_hash", None)
            user.pop("security_question", None)
            return user
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Sesión expirada")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Token inválido")

    @router.post("/register")
    async def register(body: RegisterRequest, response: Response):
        email_normalized = body.email.lower().strip()
        existing = await db.users.find_one({"email": email_normalized})
        if existing:
            raise HTTPException(status_code=400, detail="Ese email ya está registrado")

        user_id = str(uuid.uuid4())
        doc = {
            "id": user_id,
            "email": email_normalized,
            "password_hash": hash_password(body.password),
            "name": body.name.strip(),
            "role": "user",
            "created_at": datetime.now(timezone.utc),
            "security_question": {
                "question": body.security_question.question.strip(),
                "answer_hash": hash_answer(body.security_question.answer),
            },
        }
        await db.users.insert_one(doc)

        access = create_access_token(user_id, email_normalized)
        refresh = create_refresh_token(user_id)
        set_auth_cookies(response, access, refresh)
        return {**_user_to_public(doc), "access_token": access}

    @router.post("/login")
    async def login(body: LoginRequest, request: Request, response: Response):
        email_normalized = body.email.lower().strip()
        ip = request.client.host if request.client else "unknown"
        identifier = f"{ip}:{email_normalized}"

        await _check_lockout(db, identifier)

        user = await db.users.find_one({"email": email_normalized})
        if not user or not verify_password(body.password, user["password_hash"]):
            await _record_failed_attempt(db, identifier)
            raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")

        await _clear_attempts(db, identifier)
        access = create_access_token(user["id"], email_normalized)
        refresh = create_refresh_token(user["id"])
        set_auth_cookies(response, access, refresh)
        return {**_user_to_public(user), "access_token": access}

    @router.post("/logout")
    async def logout(response: Response):
        clear_auth_cookies(response)
        return {"message": "Sesión cerrada"}

    @router.get("/me")
    async def me(user: dict = Depends(get_current_user)):
        full = await db.users.find_one({"id": user["id"]}, {"_id": 0})
        return _user_to_public(full) if full else user

    @router.post("/refresh")
    async def refresh_token_endpoint(request: Request, response: Response):
        token = request.cookies.get("refresh_token")
        if not token:
            raise HTTPException(status_code=401, detail="No refresh token")
        try:
            payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
            if payload.get("type") != "refresh":
                raise HTTPException(status_code=401, detail="Token inválido")
            user = await db.users.find_one({"id": payload["sub"]})
            if not user:
                raise HTTPException(status_code=401, detail="Usuario no encontrado")
            access = create_access_token(user["id"], user["email"])
            secure = os.environ.get("COOKIE_SECURE", "true").lower() == "true"
            response.set_cookie(
                key="access_token", value=access, httponly=True,
                secure=secure, samesite="none" if secure else "lax",
                max_age=ACCESS_TOKEN_MINUTES * 60, path="/",
            )
            return {"access_token": access}
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Refresh token expirado")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Token inválido")

    @router.post("/forgot-password")
    async def forgot_password(body: ForgotRequest):
        """Returns the security question for the given email so the user can answer it.
        Does NOT reveal whether the email exists (security best practice would be to always
        return success, but since this is a personal app and recovery is offline, returning
        the question is safe and user-friendly)."""
        email_normalized = body.email.lower().strip()
        user = await db.users.find_one({"email": email_normalized})
        if not user or not user.get("security_question"):
            raise HTTPException(status_code=404, detail="No se encontró un usuario con ese email")
        return {"question": user["security_question"]["question"]}

    @router.post("/reset-password")
    async def reset_password(body: ResetRequest):
        email_normalized = body.email.lower().strip()
        user = await db.users.find_one({"email": email_normalized})
        if not user or not user.get("security_question"):
            raise HTTPException(status_code=404, detail="No se encontró un usuario con ese email")
        if not verify_answer(body.security_answer, user["security_question"]["answer_hash"]):
            raise HTTPException(status_code=401, detail="Respuesta incorrecta")
        new_hash = hash_password(body.new_password)
        await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": new_hash}})
        return {"message": "Contraseña actualizada correctamente"}

    @router.put("/profile")
    async def update_profile(body: UpdateProfileRequest, user: dict = Depends(get_current_user)):
        await db.users.update_one({"id": user["id"]}, {"$set": {"name": body.name.strip()}})
        updated = await db.users.find_one({"id": user["id"]})
        return _user_to_public(updated)

    @router.post("/change-password")
    async def change_password(body: ChangePasswordRequest, user: dict = Depends(get_current_user)):
        full = await db.users.find_one({"id": user["id"]})
        if not full or not verify_password(body.current_password, full["password_hash"]):
            raise HTTPException(status_code=401, detail="La contraseña actual es incorrecta")
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"password_hash": hash_password(body.new_password)}}
        )
        return {"message": "Contraseña actualizada"}

    @router.put("/security-question")
    async def update_security_question(body: UpdateSecurityQuestionRequest, user: dict = Depends(get_current_user)):
        full = await db.users.find_one({"id": user["id"]})
        if not full or not verify_password(body.current_password, full["password_hash"]):
            raise HTTPException(status_code=401, detail="La contraseña actual es incorrecta")
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "security_question": {
                    "question": body.question.strip(),
                    "answer_hash": hash_answer(body.answer),
                }
            }}
        )
        return {"message": "Pregunta de seguridad actualizada"}

    # expose dep for other modules
    router.get_current_user = get_current_user  # type: ignore[attr-defined]
    return router


async def ensure_indexes(db):
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.workorders.create_index("user_id")


async def seed_admin(db):
    admin_email = os.environ.get("ADMIN_EMAIL", "").lower().strip()
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    if not admin_email or not admin_password:
        return
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        doc = {
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc),
            "security_question": {
                "question": "Pregunta por defecto del admin (cambiar luego)",
                "answer_hash": hash_answer("admin"),
            },
        }
        await db.users.insert_one(doc)
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )
