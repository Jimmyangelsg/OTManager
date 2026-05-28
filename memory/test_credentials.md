# Test Credentials

## Admin (seeded on startup)
- Email: `admin@local.test`
- Password: `admin123`
- Role: `admin`
- Pregunta de seguridad: "Pregunta por defecto del admin (cambiar luego)"
- Respuesta: `admin`

## Auth endpoints (prefix `/api/auth`)
- POST `/api/auth/register` - body: `{email, password, name, security_question:{question, answer}}`
- POST `/api/auth/login` - body: `{email, password}` (sets httpOnly cookies)
- POST `/api/auth/logout`
- GET  `/api/auth/me` (requires auth)
- POST `/api/auth/refresh`
- POST `/api/auth/forgot-password` - body: `{email}` -> returns `{question}`
- POST `/api/auth/reset-password` - body: `{email, security_answer, new_password}`

## Notes
- The auth answer is normalized (lowercase + trim) when checking; the user does not need to remember exact case.
- Tokens are sent both as httpOnly cookies (preferred) and a JSON access_token (for clients that need to read it).
- All `/api/workorders/*` routes require auth and are scoped to the calling user.
