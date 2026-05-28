# PRD - Gestión de Órdenes de Trabajo (IBM Maximo) — Multi-usuario

## Problema Original
Aplicación personal en español para registrar y gestionar Órdenes de Trabajo (OTs) de IBM Maximo. Cada usuario tiene su propio espacio aislado de OTs. Acceso vía email/contraseña con recuperación por pregunta de seguridad. Portable para deploy en cualquier plataforma.

## Stack
- Backend: FastAPI + Motor (MongoDB async) + aiofiles + pandas/openpyxl + reportlab + bcrypt + PyJWT
- Frontend: React Router + Tailwind + shadcn/ui + @hello-pangea/dnd + react-hook-form + zod
- DB: MongoDB

## Implementado
- **2026-03 / 2026-05-28 (iters 1-4)**: CRUD OTs, búsqueda/filtros, adjuntos, Excel/PDF, reorder drag-and-drop, estados con badges, JWT auth con recuperación por pregunta de seguridad, aislamiento por usuario, paginación servidor.
- **2026-05-28 (iter 5 - P2 + sugerencias)**:
  - **Stats cards**: Total / Pendientes / En curso / Completadas en dashboard
  - **Atajos de teclado**: `N` nueva OT, `/` o `Ctrl+K` buscar, `Esc` cerrar, `?` ayuda; suprimidos cuando hay un input enfocado
  - **Página /profile**: cambiar nombre, contraseña (con verificación de actual), pregunta de seguridad
  - **Validación de upload** (server + cliente): max 10MB, extensión + mime allowlist (pdf, imágenes, Office, txt/csv/zip), feedback de tamaño con `formatBytes`
  - **Rol admin** con visibilidad cross-user: toggle "Vista global / Vista personal", owner mostrado en cada OT, edit/delete y reorder ocultos en vista global

## Auth (JWT portable)
- bcrypt + JWT access (24h) + refresh (30d) en cookies httpOnly Secure SameSite=None
- Brute-force lockout: 5 fallos consecutivos → 15min bloqueado
- Admin seed automático (`ADMIN_EMAIL`/`ADMIN_PASSWORD`)

## API
### Auth `/api/auth`
- POST `/register`, `/login`, `/logout`, `/refresh`
- GET  `/me`
- POST `/forgot-password`, `/reset-password`
- PUT  `/profile`               body: `{name}`
- POST `/change-password`       body: `{current_password, new_password}`
- PUT  `/security-question`     body: `{current_password, question, answer}`

### Work Orders `/api/workorders` (auth required)
- GET `/` (search, requestor, status, date_from, date_to, page, page_size, all_users[admin])
- GET `/stats` (?all_users=true para admin) → `{pending,in_progress,completed,total,with_attachment}`
- POST `/`, GET `/{id}`, PUT `/{id}`, DELETE `/{id}`
- POST `/reorder`, POST `/{id}/upload`, GET `/{id}/attachment`
- GET `/export/excel`, GET `/export/pdf`

## Validación de upload
- Max: 10 MB
- Extensiones: .pdf .png .jpg .jpeg .gif .webp .xlsx .docx .xls .doc .txt .csv .zip
- Mime types validados además de extensión (allow octet-stream si la extensión está OK)
- Chunked upload (1MB) para no cargar archivos grandes en RAM
- Borra el archivo anterior del disco al reemplazar

## Testing
- 44/44 pytest backend
- Frontend e2e: 100% en todos los flujos
- Suites:
  - `/app/backend/tests/test_auth_and_workorders.py` (29 tests)
  - `/app/backend/tests/test_new_features_iter5.py` (15 tests)

## Backlog
- P2: Login con Google portable (descartado por usuario por ahora)
- P3: Refactor server.py en routers separados (auth/, workorders/, exports/, profile/)
- P3: Aceptar TLDs reservadas (.test/.localhost) en EmailStr para entornos de testing
- P3: Sincronizar la pagination cuando el toggle admin cambia los filtros
- P3: Vista de detalle de OT cross-user en modo admin (mostrar owner en el sheet)
