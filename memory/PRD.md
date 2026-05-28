# PRD - Gestión de Órdenes de Trabajo (IBM Maximo)

## Problema Original
Aplicación personal en español para registrar y gestionar Órdenes de Trabajo (OTs) de IBM Maximo. Acceso local, sin autenticación. Prioriza velocidad de alta tasa de carga diaria. Soporta crear, ver, editar, buscar, filtrar, eliminar y adjuntar archivos. Recientemente se añadió exportación a Excel y reordenamiento drag-and-drop.

## Stack
- Backend: FastAPI + Motor (MongoDB async) + aiofiles + pandas/openpyxl
- Frontend: React + Tailwind + shadcn/ui + @hello-pangea/dnd
- DB: MongoDB local

## Implementado
- 2026-03: CRUD básico OTs, búsqueda y filtros, adjuntos (upload/download).
- 2026-03: Exportación a Excel con headers en español (`/api/workorders/export/excel`).
- 2026-05-28: 
  - Recreación de venv y node_modules (entorno corrupto)
  - Reordenamiento drag-and-drop con `@hello-pangea/dnd`
  - Backend: campo `sort_order` + endpoint `POST /api/workorders/reorder`
  - Diseño renovado: gradiente azul en header, layout en filas tipo card, badges "Hoy", iconos por columna, contador de OTs
  - AlertDialog de confirmación reemplaza `window.confirm()` para eliminar
  - Excel ahora respeta el orden manual (sort_order DESC)
  - Suite pytest creada en `/app/backend/tests/test_workorders.py` (14/14 passing)

## API
- `GET /api/workorders` - lista, soporta `?search=`, `?requestor=`, `?date_from=`, `?date_to=`
- `POST /api/workorders` - crear (sort_order = max+1)
- `GET /api/workorders/{id}` - detalle
- `PUT /api/workorders/{id}` - editar
- `DELETE /api/workorders/{id}` - eliminar
- `POST /api/workorders/{id}/upload` - subir adjunto
- `GET /api/workorders/{id}/attachment` - descargar adjunto
- `POST /api/workorders/reorder` - reordenar `{ordered_ids:[...]}`
- `GET /api/workorders/export/excel` - exportar xlsx (respeta sort_order)

## Schema (work_orders)
```
{
  id (uuid), ot_number, created_at (ISO),
  requestor, task_detail, service_desk_number, observations,
  attachment_filename, attachment_url, _stored_filename,
  sort_order (float)
}
```

## Backlog
- P1: Exportar a PDF
- P2: Paginación o scroll infinito (cuando crezca el volumen)
- P2: Validación de tamaño/tipo de archivo en upload
- P3: Refactor de Dashboard.js (~615 LOC) si se agregan más features
