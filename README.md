# Órdenes de Trabajo · IBM Maximo

Aplicación web personal **multi-usuario** en español para registrar y gestionar Órdenes de Trabajo (OTs) provenientes de IBM Maximo. Pensada para uso diario de alto volumen.

| Capa | Stack |
| --- | --- |
| Backend | FastAPI · Motor (MongoDB async) · JWT + bcrypt · reportlab · openpyxl |
| Frontend | React 19 · Tailwind · shadcn/ui · react-hook-form · @hello-pangea/dnd |
| DB | MongoDB 6+ |

## Capacidades

- Cuentas de usuario aisladas (cada uno ve solo sus OTs)
- Recuperación de contraseña con **pregunta de seguridad** (sin servicios externos)
- CRUD de OTs (número, solicitante, detalle, service desk, observaciones)
- Estados: Pendiente / En curso / Completada con filtro y badges
- **Adjuntos** por OT (max 10 MB; PDF, imágenes, Office, txt/csv/zip)
- **Reordenamiento drag-and-drop** persistente por usuario
- Búsqueda + filtros (número, solicitante, estado, fechas)
- **Exportación a Excel y PDF** (respetan filtros y orden manual)
- Paginación servidor (20 por página)
- Estadísticas por estado en el dashboard
- **Atajos de teclado** (`N`, `/`, `Esc`, `?`, `Ctrl/⌘+K`)
- **Rol admin** con vista global cross-user (read-only)
- Página de perfil para cambiar nombre, contraseña y pregunta de seguridad

## Estructura del repo (monorepo)

```
.
├── backend/                 # FastAPI app
│   ├── server.py            # routes + work-order CRUD + exports
│   ├── auth.py              # JWT auth, hashing, security questions
│   ├── requirements.txt
│   ├── runtime.txt          # python-3.11.9 (used by Render/Heroku)
│   ├── .env.example
│   └── tests/               # pytest suite (44 tests)
│
├── frontend/                # React (CRA + craco) + Tailwind + shadcn
│   ├── public/              # index.html, favicon.svg, manifest.json, robots.txt
│   ├── src/
│   ├── package.json
│   └── .env.example
│
├── .github/workflows/ci.yml # Pytest + frontend build en cada PR/push
├── vercel.json              # Deploy del frontend en Vercel
├── netlify.toml             # Deploy del frontend en Netlify
├── render.yaml              # Blueprint completo (backend + frontend) en Render
├── Procfile                 # Compatibilidad Heroku/Railway/etc para el backend
├── .nvmrc                   # Node 20
└── README.md
```

## Desarrollo local

### Requisitos
- Python 3.11+, Node 20+, Yarn, MongoDB 6+

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Generá un JWT_SECRET fuerte:
python -c "import secrets; print(secrets.token_hex(32))"
# y pegalo dentro de backend/.env

uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend
```bash
cd frontend
yarn install
cp .env.example .env       # REACT_APP_BACKEND_URL=http://localhost:8001
yarn start                 # abre http://localhost:3000
```

La primera vez se crea un usuario admin con `ADMIN_EMAIL` / `ADMIN_PASSWORD` del `.env` del backend.

## Deploy a GitHub + plataformas externas

> ⚠️ **GitHub Pages NO funciona acá** porque solo sirve archivos estáticos y esta app necesita un backend (Python + MongoDB). Para deployar tenés que separar el frontend (Vercel / Netlify / Render static) del backend (Render / Railway / Fly.io / cualquier VPS).

### 1) Subí el repo a GitHub
```bash
git init && git add . && git commit -m "Initial commit"
git remote add origin git@github.com:TU_USUARIO/TU_REPO.git
git push -u origin main
```

### 2) Elegí tu combo de hosting

#### Opción A — **Vercel (frontend) + Render (backend) + MongoDB Atlas (DB)** ✅ recomendado
1. Creá un cluster gratuito en [MongoDB Atlas](https://www.mongodb.com/atlas) y copiá el connection string.
2. **Backend en Render**:
   - "New +" → "Web Service" → conectá tu repo de GitHub.
   - **Root directory**: `backend`
   - **Build command**: `pip install -r requirements.txt`
   - **Start command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - Variables (Environment tab):
     - `MONGO_URL` = tu connection string de Atlas
     - `DB_NAME` = `ots_db`
     - `JWT_SECRET` = string aleatorio fuerte (32+ bytes)
     - `ADMIN_EMAIL` / `ADMIN_PASSWORD` = los que quieras
     - `CORS_ORIGINS` = `https://tu-frontend.vercel.app` (sin barra final)
3. **Frontend en Vercel**:
   - "Add New..." → "Project" → importá el repo de GitHub.
   - Vercel detecta `vercel.json` automáticamente y construye desde `frontend/`.
   - Variable de entorno: `REACT_APP_BACKEND_URL` = `https://ots-backend.onrender.com` (la URL de tu Render).
   - Deploy.

#### Opción B — **Todo en Render (un solo proveedor)** 🚀 un click
1. Creá un cluster gratuito en MongoDB Atlas.
2. En Render: "New +" → "Blueprint" → conectá tu repo.
3. Render lee `render.yaml` y crea automáticamente: backend + frontend estático.
4. En el dashboard, llená las variables marcadas como `sync: false`:
   - Backend: `MONGO_URL`, `ADMIN_PASSWORD`, `CORS_ORIGINS`
   - Frontend: `REACT_APP_BACKEND_URL`
5. Apretá "Apply" y listo.

#### Opción C — **Netlify (frontend) + Railway (backend)**
- Netlify detecta `netlify.toml` y construye desde `frontend/`. Cargá `REACT_APP_BACKEND_URL` en las env vars.
- Railway: conectá el repo, seleccioná el directorio `backend/`, Railway detecta `Procfile`/`requirements.txt`. Cargá las env vars del `.env.example`.

#### Opción D — **VPS propio (Docker)**
- No incluido aún. Si lo necesitás, pedí el `Dockerfile` + `docker-compose.yml` y se arma.

### 3) Checklist post-deploy

- [ ] `REACT_APP_BACKEND_URL` apunta al backend público (sin barra final).
- [ ] `CORS_ORIGINS` en backend contiene la URL exacta del frontend (sin barra final).
- [ ] `JWT_SECRET` fue rotado a uno aleatorio (NO uses el ejemplo).
- [ ] `ADMIN_PASSWORD` fue rotado (o eliminado para no crear el admin).
- [ ] MongoDB está protegida (no expuesta sin auth).
- [ ] HTTPS habilitado (cookies usan `Secure`).

## Tests

```bash
cd backend
pytest -v       # 44 tests
```

Cubren auth, scoping por usuario, reorder, exports, validación de uploads, recuperación de contraseña, perfil y rol admin.

## Variables de entorno (cheatsheet)

### backend/.env
| Variable | Obligatoria | Ejemplo |
| --- | --- | --- |
| `MONGO_URL` | sí | `mongodb+srv://user:pass@cluster.mongodb.net` |
| `DB_NAME` | sí | `ots_db` |
| `JWT_SECRET` | sí | (32+ bytes random hex) |
| `CORS_ORIGINS` | sí en prod | `https://ots.miempresa.com` |
| `ADMIN_EMAIL` | opcional | `admin@local.dev` |
| `ADMIN_PASSWORD` | opcional | (string fuerte) |
| `COOKIE_SECURE` | opcional | `false` solo si servís HTTP local |

### frontend/.env
| Variable | Obligatoria | Ejemplo |
| --- | --- | --- |
| `REACT_APP_BACKEND_URL` | sí | `https://ots-backend.onrender.com` |

## Licencia
Proyecto personal. Usalo libremente.
