# PRD - Gestión de Órdenes de Trabajo (IBM Maximo) — Multi-usuario

## Problema Original
Aplicación personal en español para registrar y gestionar Órdenes de Trabajo (OTs) de IBM Maximo. Cada usuario tiene su propio espacio aislado de OTs. Acceso vía email/contraseña con recuperación por pregunta de seguridad. Pensada para deploy portable (no atada a Emergent).

## Stack
- Backend: FastAPI + Motor (MongoDB async) + aiofiles + pandas/openpyxl + reportlab + bcrypt + PyJWT
- Frontend: React Router + Tailwind + shadcn/ui + @hello-pangea/dnd + react-hook-form + zod
- DB: MongoDB

## Auth (JWT portable, sin Emergent lock-in)
- bcrypt para hash de password y de respuesta de pregunta de seguridad (normalizada lowercase+trim)
- JWT access (24h) + refresh (30d) en cookies httpOnly Secure SameSite=None
- Brute-force lockout: 5 fallos consecutivos → 15min bloqueado (HTTP 429)
- Admin seed automático al startup (`ADMIN_EMAIL`/`ADMIN_PASSWORD` en `.env`)

## Implementado
- **2026-03**: CRUD básico, búsqueda, filtros, adjuntos, exportación Excel.
- **2026-05-28 (auth + features)**: 
  - JWT auth completo: register, login, logout, /me, refresh, forgot-password, reset-password
  - Recuperación por pregunta de seguridad (5 plantillas + custom)
  - Aislamiento total: OTs scopedas por user_id (404 al cross-access)
  - Drag-and-drop con `@hello-pangea/dnd` + endpoint `POST /api/workorders/reorder` (scopeado por usuario)
  - Estados de OT: pending / in_progress / completed con badges de color
  - Filtro por estado en el panel de filtros
  - Exportación a PDF (reportlab, A4 horizontal con tabla coloreada)
  - Exportación a Excel con columna Estado (respeta filtros + orden manual)
  - Paginación servidor: `GET /api/workorders?page=N&page_size=20` con envelope `{items,total,page,total_pages}`
  - User menu (avatar con inicial) + logout
  - Diseño renovado: header con gradiente azul, badges de estado, layout en cards con drag handle e índice global
  - AlertDialog confirmación al eliminar (reemplaza window.confirm)
- **Testing**: 29/29 pytest backend, frontend e2e validado.

## API
### Auth `/api/auth`
- POST `/register`  `{email, password, name, security_question:{question, answer}}`
- POST `/login`     `{email, password}` → cookies httpOnly + JSON con access_token
- POST `/logout`
- GET  `/me`
- POST `/refresh`
- POST `/forgot-password`  `{email}` → `{question}`
- POST `/reset-password`   `{email, security_answer, new_password}`

### Work Orders `/api/workorders` (auth required, scoped por user_id)
- GET `/` (?search, ?requestor, ?status, ?date_from, ?date_to, ?page, ?page_size) → envelope paginado
- POST `/`, GET `/{id}`, PUT `/{id}`, DELETE `/{id}`
- POST `/reorder` `{ordered_ids:[...]}`
- POST `/{id}/upload`, GET `/{id}/attachment`
- GET `/export/excel`, GET `/export/pdf`

## Schemas
```
users: { id, email (unique), password_hash, name, role,
         created_at, security_question:{question, answer_hash} }
workorders: { id, user_id, ot_number, created_at, status,
              requestor, task_detail, service_desk_number,
              observations, attachment_filename, attachment_url,
              _stored_filename, sort_order }
login_attempts: { identifier (ip:email), count, locked_until }
```

## Backlog
- P1: Login con Google (requiere que el usuario provea su Google OAuth client_id para mantener portabilidad)
- P2: Compartir/exportar OTs entre usuarios (rol admin con visibilidad cross-user)
- P2: Validación de tipo/tamaño de archivo en upload (max 10MB, mime allowlist)
- P2: Página de perfil para que el usuario pueda cambiar contraseña / pregunta de seguridad
- P3: Refactor server.py en routers (auth/, workorders/, exports/)
- P3: Cambiar EmailStr a un validator custom para aceptar TLDs reservadas (.test/.localhost) o documentar el comportamiento
