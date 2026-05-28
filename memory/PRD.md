# PRD - Gestión de Órdenes de Trabajo (IBM Maximo) — Multi-usuario

## Problema Original
Aplicación personal en español para registrar y gestionar Órdenes de Trabajo (OTs) de IBM Maximo. Cada usuario tiene su propio espacio aislado de OTs. Acceso vía email/contraseña con recuperación por pregunta de seguridad. **Portable** — pensada para deploy en GitHub + Vercel/Render/Railway/Netlify, sin lock-in.

## Stack
- Backend: FastAPI + Motor (MongoDB async) + aiofiles + pandas/openpyxl + reportlab + bcrypt + PyJWT
- Frontend: React Router + Tailwind + shadcn/ui + @hello-pangea/dnd + react-hook-form + zod
- DB: MongoDB

## Implementado
- **2026-03/05 (iters 1-5)**: CRUD, búsqueda/filtros, adjuntos, Excel/PDF, reorder drag-and-drop, estados, JWT auth multi-usuario, recuperación por pregunta de seguridad, paginación, stats, atajos de teclado, página de perfil, rol admin con vista global.
- **2026-05-28 (iter 6 - code quality + deploy ready)**:
  - Memoización completa de Dashboard (useCallback en todos los handlers, useMemo en value/shortcuts/accents)
  - Extracción de `useKeyboardShortcuts` hook y constantes `STAT_ACCENTS` / `SHORTCUT_HELP_ROWS`
  - AuthContext: login/logout/register en useCallback, value en useMemo, logout con error log dev-guarded
  - ProtectedRoute: navState en useMemo
  - console.error/warn protegidos por `process.env.NODE_ENV === 'development'`
  - Keys estables (no usa índices) en mapas
- **2026-05-28 (iter 7 - GitHub deploy ready)**:
  - `public/index.html` limpio: removido emergent badge, emergent main script, PostHog tracking; título y descripción propios; idioma "es"
  - Agregados `public/favicon.svg`, `public/manifest.json`, `public/robots.txt`
  - Removido `emergentintegrations` de `requirements.txt` (no usado)
  - Removido `@emergentbase/visual-edits` de `package.json` (CDN privado)
  - Creados `backend/.env.example` y `frontend/.env.example`
  - `README.md` reescrito con guía completa de deploy (Render/Railway/Vercel/Netlify)
  - `.github/workflows/ci.yml` agregado (pytest + frontend build en PRs/push)
  - Build de producción verificado limpio (sin referencias a emergent.sh)

## Auth (JWT portable)
- bcrypt + JWT access (24h) + refresh (30d) en cookies httpOnly Secure SameSite=None
- Brute-force lockout: 5 fallos consecutivos → 15min (HTTP 429)
- Admin seed automático (`ADMIN_EMAIL`/`ADMIN_PASSWORD` en `.env`)

## API
### Auth `/api/auth`
- POST `/register`, `/login`, `/logout`, `/refresh`
- GET `/me`
- POST `/forgot-password`, `/reset-password`
- PUT `/profile`, POST `/change-password`, PUT `/security-question`

### Work Orders `/api/workorders` (auth required, scoped by user_id)
- GET `/`, `/stats`, `/{id}`
- POST `/`, PUT `/{id}`, DELETE `/{id}`
- POST `/reorder`, POST `/{id}/upload`, GET `/{id}/attachment`
- GET `/export/excel`, GET `/export/pdf`

## Schemas
- users: `{id, email(unique), password_hash, name, role, created_at, security_question:{question, answer_hash}}`
- workorders: `{id, user_id, ot_number, created_at, status, requestor, task_detail, service_desk_number, observations, attachment_filename, attachment_url, _stored_filename, sort_order}`
- login_attempts: `{identifier(ip:email), count, locked_until}`

## Testing
- Backend: 44/44 pytest passing
- Frontend: e2e validado en todos los flujos críticos

## Validación de upload (cliente + servidor)
- Max 10 MB · Allowlist: .pdf .png .jpg .jpeg .gif .webp .xlsx .docx .xls .doc .txt .csv .zip
- Mime type validado además de extensión
- Chunked upload (1MB) sin cargar archivos grandes en RAM
- Borrado del archivo anterior al reemplazar

## Backlog (P3)
- Mostrar owner en sheet de detalles cuando está en vista global admin
- Refactor server.py en routers separados
- Dockerfile + docker-compose para self-hosted con un solo comando
- Login con Google portable (descartado por el usuario)
- Validator custom de email para aceptar TLDs reservadas (.test/.localhost)
