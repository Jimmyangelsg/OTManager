# Órdenes de Trabajo · IBM Maximo

Aplicación web personal (multi-usuario) en español para registrar y gestionar Órdenes de Trabajo (OTs) provenientes de IBM Maximo. Pensada para uso diario de alto volumen.

- **Backend**: FastAPI + Motor (MongoDB async) + JWT auth + reportlab + openpyxl
- **Frontend**: React + Tailwind + shadcn/ui + react-hook-form + @hello-pangea/dnd
- **DB**: MongoDB

## Capacidades
- Cuentas de usuario aisladas (cada uno ve solo sus OTs)
- Recuperación de contraseña con pregunta de seguridad (sin servicios externos)
- CRUD de OTs con número, solicitante, detalle, service desk, observaciones
- Estados: Pendiente / En curso / Completada
- Adjuntos por OT (max 10 MB; PDF, imágenes, Office, txt/csv/zip)
- Reordenamiento drag-and-drop
- Búsqueda + filtros (número, solicitante, estado, fechas)
- Exportación a Excel y PDF (respetan filtros y orden manual)
- Paginación
- Estadísticas por estado en el dashboard
- Atajos de teclado (`N`, `/`, `Esc`, `?`, `Ctrl+K`)
- Rol admin con vista global cross-user (read-only)
- Página de perfil para cambiar nombre, contraseña y pregunta de seguridad

## Estructura

```
/app
├── backend/                 # FastAPI app
│   ├── server.py            # routes + work-order CRUD + exports
│   ├── auth.py              # JWT auth, hashing, security questions
│   ├── requirements.txt
│   ├── .env.example
│   └── tests/               # pytest suite (44 tests)
├── frontend/                # CRA + craco React app
│   ├── public/              # index.html, favicon.svg, manifest.json, robots.txt
│   ├── src/
│   ├── package.json
│   └── .env.example
└── README.md
```

## Configuración local

### Requisitos
- Python 3.11+, Node 20+, Yarn, MongoDB 6+

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Editá .env y poné un JWT_SECRET fuerte (python -c "import secrets; print(secrets.token_hex(32))")

uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend
```bash
cd frontend
yarn install

cp .env.example .env
# Editá .env y poné REACT_APP_BACKEND_URL apuntando a tu backend

yarn start
```

Abrí `http://localhost:3000`. La primera vez se crea un admin con las credenciales que pusiste en `ADMIN_EMAIL` / `ADMIN_PASSWORD` en el `.env` del backend (por defecto `admin@local.dev` / `changeme123`).

### Variables que **debés** rotar antes de desplegar a producción
- `backend/.env` → `JWT_SECRET` (string aleatorio de 32+ bytes)
- `backend/.env` → `ADMIN_PASSWORD` (cambiar por una contraseña real o eliminar las dos vars para no crear el admin)
- `backend/.env` → `CORS_ORIGINS` (URL real del frontend, evitá `*` en producción si vas a usar cookies)

## Deploy a GitHub + plataformas

Esta app es **portable**: no usa servicios propietarios de Emergent. Algunas opciones probadas:

### Opción A — Backend (Render / Railway / Fly.io) + Frontend (Vercel / Netlify)
1. Subí el repo a GitHub.
2. **Backend** (Render/Railway):
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - Setear todas las variables del `backend/.env.example`
   - Conectar una MongoDB (Mongo Atlas free tier funciona bien)
3. **Frontend** (Vercel/Netlify):
   - Root directory: `frontend/`
   - Build command: `yarn build`
   - Output directory: `build`
   - Variable de entorno: `REACT_APP_BACKEND_URL=https://tu-backend.onrender.com`

### Opción B — Self-hosted (Docker)
- Necesitarás un `Dockerfile` por servicio + `docker-compose.yml` que arme: `mongo` + `backend` + `nginx` sirviendo el build estático del frontend.
- Esta variante no viene incluida; se puede agregar a pedido.

### Notas importantes para producción
- En producción **siempre HTTPS** (porque las cookies usan `Secure`).
- Frontend y backend pueden estar en hosts distintos. Si lo hacés, agregá el origen del frontend a `CORS_ORIGINS`.
- MongoDB **no** debe quedar expuesto a Internet sin autenticación.
- Si vas a tener varios usuarios, definí backups del MongoDB.

## Tests

```bash
cd backend
pytest -v
```

44 tests cubren auth, scoping por usuario, reorder, exports, validación de uploads, recuperación de contraseña, perfil y rol admin.

## Licencia / Autoría
Proyecto personal. Sin licencia comercial; usalo libremente.
