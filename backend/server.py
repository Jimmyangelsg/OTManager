from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Depends, Request
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import aiofiles
import pandas as pd
from io import BytesIO

from auth import build_auth_router, ensure_indexes, seed_admin

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create uploads directory
UPLOADS_DIR = ROOT_DIR / 'uploads'
UPLOADS_DIR.mkdir(exist_ok=True)

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Mount auth router
auth_router = build_auth_router(db)
api_router.include_router(auth_router)
get_current_user = auth_router.get_current_user  # type: ignore[attr-defined]


# Define Models
class WorkOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ot_number: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    requestor: Optional[str] = None
    task_detail: Optional[str] = None
    service_desk_number: Optional[str] = None
    observations: Optional[str] = None
    attachment_filename: Optional[str] = None
    attachment_url: Optional[str] = None
    sort_order: float = 0.0
    status: str = "pending"   # pending | in_progress | completed
    user_id: Optional[str] = None


class WorkOrderCreate(BaseModel):
    ot_number: str
    requestor: Optional[str] = None
    task_detail: Optional[str] = None
    service_desk_number: Optional[str] = None
    observations: Optional[str] = None
    status: Optional[str] = "pending"


class WorkOrderUpdate(BaseModel):
    ot_number: Optional[str] = None
    requestor: Optional[str] = None
    task_detail: Optional[str] = None
    service_desk_number: Optional[str] = None
    observations: Optional[str] = None
    status: Optional[str] = None


VALID_STATUSES = {"pending", "in_progress", "completed"}


def _validate_status(status: Optional[str]) -> Optional[str]:
    if status is None:
        return None
    if status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Estado inválido. Valores válidos: {sorted(VALID_STATUSES)}")
    return status


# Routes
@api_router.get("/")
async def root():
    return {"message": "Work Order Management API"}


# ---------- Upload validation ----------
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # xlsx
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # docx
    "application/vnd.ms-excel",  # xls
    "application/msword",  # doc
    "text/plain",
    "text/csv",
    "application/zip",
}
ALLOWED_EXTENSIONS = {
    ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp",
    ".xlsx", ".docx", ".xls", ".doc", ".txt", ".csv", ".zip",
}


@api_router.get("/workorders/stats")
async def get_workorder_stats(
    user: dict = Depends(get_current_user),
    all_users: bool = False,
):
    """Counts by status + total. Admin can opt-in to global counts with ?all_users=true."""
    is_admin_global = bool(all_users) and user.get("role") == "admin"
    query = {} if is_admin_global else {"user_id": user["id"]}
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    by_status = {"pending": 0, "in_progress": 0, "completed": 0}
    total = 0
    async for row in db.workorders.aggregate(pipeline):
        key = row.get("_id") or "pending"
        if key in by_status:
            by_status[key] = row["count"]
        total += row["count"]
    with_attachment = await db.workorders.count_documents({**query, "attachment_filename": {"$nin": [None, ""]}})
    return {**by_status, "total": total, "with_attachment": with_attachment}


@api_router.post("/workorders", response_model=WorkOrder)
async def create_workorder(input: WorkOrderCreate, user: dict = Depends(get_current_user)):
    _validate_status(input.status)
    wo_dict = input.model_dump()
    wo_obj = WorkOrder(**wo_dict)
    wo_obj.user_id = user["id"]

    # Assign sort_order = max+1 (scoped per user) so new OTs appear at the top
    last = await db.workorders.find_one(
        {"user_id": user["id"]},
        sort=[('sort_order', -1)],
        projection={"sort_order": 1},
    )
    next_sort = (last.get('sort_order', 0) + 1.0) if last else 1.0
    wo_obj.sort_order = next_sort

    doc = wo_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    _ = await db.workorders.insert_one(doc)
    return wo_obj


@api_router.get("/workorders")
async def get_workorders(
    user: dict = Depends(get_current_user),
    search: Optional[str] = None,
    requestor: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    all_users: bool = False,
):
    if page < 1:
        page = 1
    if page_size < 1 or page_size > 200:
        page_size = 20

    # Admin can view cross-user OTs by passing ?all_users=true
    is_admin_global = bool(all_users) and user.get("role") == "admin"
    query = {} if is_admin_global else {"user_id": user["id"]}

    if search:
        query['ot_number'] = {'$regex': search, '$options': 'i'}
    if requestor:
        query['requestor'] = {'$regex': requestor, '$options': 'i'}
    if status:
        _validate_status(status)
        query['status'] = status
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query['$gte'] = date_from
        if date_to:
            date_query['$lte'] = date_to
        if date_query:
            query['created_at'] = date_query

    total = await db.workorders.count_documents(query)
    skip = (page - 1) * page_size

    workorders = await (
        db.workorders.find(query, {"_id": 0})
        .sort([('sort_order', -1), ('created_at', -1)])
        .skip(skip)
        .limit(page_size)
        .to_list(page_size)
    )

    # If admin global view, attach owner name/email to each row
    if is_admin_global and workorders:
        owner_ids = list({wo.get('user_id') for wo in workorders if wo.get('user_id')})
        owners = {}
        async for u in db.users.find({"id": {"$in": owner_ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1}):
            owners[u["id"]] = {"name": u.get("name", ""), "email": u.get("email", "")}
        for wo in workorders:
            wo['owner'] = owners.get(wo.get('user_id'), {"name": "(desconocido)", "email": ""})

    for wo in workorders:
        if isinstance(wo.get('created_at'), str):
            wo['created_at'] = datetime.fromisoformat(wo['created_at'])
        wo.setdefault('sort_order', 0.0)
        wo.setdefault('status', 'pending')

    return {
        "items": workorders,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": (total + page_size - 1) // page_size if page_size else 0,
        "admin_view": is_admin_global,
    }


@api_router.get("/workorders/{workorder_id}", response_model=WorkOrder)
async def get_workorder(workorder_id: str, user: dict = Depends(get_current_user)):
    workorder = await db.workorders.find_one({"id": workorder_id, "user_id": user["id"]}, {"_id": 0})

    if not workorder:
        raise HTTPException(status_code=404, detail="Work order not found")

    if isinstance(workorder['created_at'], str):
        workorder['created_at'] = datetime.fromisoformat(workorder['created_at'])
    workorder.setdefault('status', 'pending')

    return workorder


@api_router.put("/workorders/{workorder_id}", response_model=WorkOrder)
async def update_workorder(workorder_id: str, input: WorkOrderUpdate, user: dict = Depends(get_current_user)):
    if input.status is not None:
        _validate_status(input.status)

    existing = await db.workorders.find_one({"id": workorder_id, "user_id": user["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Work order not found")

    update_data = {k: v for k, v in input.model_dump().items() if v is not None}

    if update_data:
        await db.workorders.update_one(
            {"id": workorder_id, "user_id": user["id"]},
            {"$set": update_data}
        )

    updated_wo = await db.workorders.find_one({"id": workorder_id, "user_id": user["id"]}, {"_id": 0})
    if isinstance(updated_wo['created_at'], str):
        updated_wo['created_at'] = datetime.fromisoformat(updated_wo['created_at'])
    updated_wo.setdefault('status', 'pending')

    return updated_wo


@api_router.delete("/workorders/{workorder_id}")
async def delete_workorder(workorder_id: str, user: dict = Depends(get_current_user)):
    result = await db.workorders.delete_one({"id": workorder_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Work order not found")
    return {"message": "Work order deleted successfully"}


class ReorderRequest(BaseModel):
    ordered_ids: List[str]


@api_router.post("/workorders/reorder")
async def reorder_workorders(payload: ReorderRequest, user: dict = Depends(get_current_user)):
    if not payload.ordered_ids:
        return {"message": "No ids provided", "updated": 0}

    total = len(payload.ordered_ids)
    updated = 0
    for index, wo_id in enumerate(payload.ordered_ids):
        new_order = float(total - index)
        result = await db.workorders.update_one(
            {"id": wo_id, "user_id": user["id"]},
            {"$set": {"sort_order": new_order}}
        )
        updated += result.modified_count

    return {"message": "Order updated", "updated": updated, "total": total}


@api_router.post("/workorders/{workorder_id}/upload")
async def upload_attachment(workorder_id: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    workorder = await db.workorders.find_one({"id": workorder_id, "user_id": user["id"]}, {"_id": 0})
    if not workorder:
        raise HTTPException(status_code=404, detail="Work order not found")

    # --- Validation: extension + mime type ---
    file_extension = Path(file.filename or "").suffix.lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido. Aceptados: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        # Some clients send octet-stream for legitimate files; allow if extension is OK
        if file.content_type != "application/octet-stream":
            raise HTTPException(
                status_code=400,
                detail=f"Mime type '{file.content_type}' no permitido."
            )

    # --- Read in chunks to enforce size limit without loading huge files into RAM ---
    unique_filename = f"{workorder_id}_{uuid.uuid4()}{file_extension}"
    file_path = UPLOADS_DIR / unique_filename
    total_bytes = 0
    try:
        async with aiofiles.open(file_path, 'wb') as out_file:
            while True:
                chunk = await file.read(1024 * 1024)  # 1MB
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_BYTES:
                    await out_file.close()
                    if file_path.exists():
                        file_path.unlink()
                    raise HTTPException(
                        status_code=413,
                        detail=f"Archivo demasiado grande. Máximo {MAX_UPLOAD_BYTES // (1024*1024)} MB."
                    )
                await out_file.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Error guardando archivo: {e}")

    # If replacing, delete previous stored file
    prev_stored = workorder.get("_stored_filename")
    if prev_stored:
        prev_path = UPLOADS_DIR / prev_stored
        if prev_path.exists() and prev_path != file_path:
            try:
                prev_path.unlink()
            except OSError:
                pass

    attachment_url = f"/api/workorders/{workorder_id}/attachment"
    await db.workorders.update_one(
        {"id": workorder_id, "user_id": user["id"]},
        {"$set": {
            "attachment_filename": file.filename,
            "attachment_url": attachment_url,
            "_stored_filename": unique_filename
        }}
    )

    return {"filename": file.filename, "url": attachment_url, "size": total_bytes, "message": "File uploaded successfully"}


@api_router.get("/workorders/{workorder_id}/attachment")
async def download_attachment(workorder_id: str, user: dict = Depends(get_current_user)):
    workorder = await db.workorders.find_one({"id": workorder_id, "user_id": user["id"]}, {"_id": 0})
    if not workorder:
        raise HTTPException(status_code=404, detail="Work order not found")

    if not workorder.get('_stored_filename'):
        raise HTTPException(status_code=404, detail="No attachment found")

    file_path = UPLOADS_DIR / workorder['_stored_filename']
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Attachment file not found")

    return FileResponse(
        path=file_path,
        filename=workorder.get('attachment_filename', 'attachment'),
        media_type='application/octet-stream'
    )


@api_router.get("/workorders/export/excel")
async def export_to_excel(
    user: dict = Depends(get_current_user),
    search: Optional[str] = None,
    requestor: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    query = {"user_id": user["id"]}
    if search:
        query['ot_number'] = {'$regex': search, '$options': 'i'}
    if requestor:
        query['requestor'] = {'$regex': requestor, '$options': 'i'}
    if status:
        _validate_status(status)
        query['status'] = status
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query['$gte'] = date_from
        if date_to:
            date_query['$lte'] = date_to
        if date_query:
            query['created_at'] = date_query

    workorders = await (
        db.workorders.find(query, {"_id": 0, "_stored_filename": 0})
        .sort([('sort_order', -1), ('created_at', -1)])
        .to_list(5000)
    )

    if not workorders:
        raise HTTPException(status_code=404, detail="No work orders found to export")

    status_labels = {"pending": "Pendiente", "in_progress": "En curso", "completed": "Completada"}

    df_data = []
    for wo in workorders:
        df_data.append({
            'Número de OT': wo.get('ot_number', ''),
            'Fecha y Hora': wo.get('created_at', ''),
            'Estado': status_labels.get(wo.get('status', 'pending'), 'Pendiente'),
            'Solicitante': wo.get('requestor', ''),
            'Detalle de la Tarea': wo.get('task_detail', ''),
            'Número de Service Desk': wo.get('service_desk_number', ''),
            'Observaciones': wo.get('observations', ''),
            'Tiene Adjunto': 'Sí' if wo.get('attachment_filename') else 'No',
            'Nombre del Archivo': wo.get('attachment_filename', '')
        })

    df = pd.DataFrame(df_data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Órdenes de Trabajo', index=False)
        worksheet = writer.sheets['Órdenes de Trabajo']
        for idx, col in enumerate(df.columns):
            col_lengths = df[col].fillna('').astype(str).apply(len)
            max_length = max(col_lengths.max() if len(col_lengths) > 0 else 0, len(col))
            worksheet.column_dimensions[chr(65 + idx)].width = min(max_length + 2, 50)

    output.seek(0)
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    filename = f"ordenes_trabajo_{timestamp}.xlsx"
    temp_path = UPLOADS_DIR / filename
    async with aiofiles.open(temp_path, 'wb') as f:
        await f.write(output.getvalue())

    return FileResponse(
        path=temp_path,
        filename=filename,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        background=None
    )


@api_router.get("/workorders/export/pdf")
async def export_to_pdf(
    user: dict = Depends(get_current_user),
    search: Optional[str] = None,
    requestor: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    """Genera un PDF con la lista de OTs del usuario (respetando filtros y orden manual)."""
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

    query = {"user_id": user["id"]}
    if search:
        query['ot_number'] = {'$regex': search, '$options': 'i'}
    if requestor:
        query['requestor'] = {'$regex': requestor, '$options': 'i'}
    if status:
        _validate_status(status)
        query['status'] = status
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query['$gte'] = date_from
        if date_to:
            date_query['$lte'] = date_to
        if date_query:
            query['created_at'] = date_query

    workorders = await (
        db.workorders.find(query, {"_id": 0, "_stored_filename": 0})
        .sort([('sort_order', -1), ('created_at', -1)])
        .to_list(5000)
    )
    if not workorders:
        raise HTTPException(status_code=404, detail="No hay órdenes de trabajo para exportar")

    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    filename = f"ordenes_trabajo_{timestamp}.pdf"
    pdf_path = UPLOADS_DIR / filename

    status_labels = {"pending": "Pendiente", "in_progress": "En curso", "completed": "Completada"}

    doc = SimpleDocTemplate(
        str(pdf_path), pagesize=landscape(A4),
        leftMargin=20, rightMargin=20, topMargin=24, bottomMargin=24,
        title="Órdenes de Trabajo", author=user.get("name", "")
    )
    styles = getSampleStyleSheet()
    cell_style = ParagraphStyle('cell', parent=styles['BodyText'], fontSize=8, leading=10)
    title_style = ParagraphStyle('title', parent=styles['Title'], fontSize=16, leading=20)
    meta_style = ParagraphStyle('meta', parent=styles['BodyText'], fontSize=9, textColor=colors.grey)

    elements = [
        Paragraph("Órdenes de Trabajo - IBM Maximo", title_style),
        Paragraph(
            f"Usuario: {user.get('name', '')} ({user.get('email', '')}) · "
            f"Generado: {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M UTC')} · "
            f"Total: {len(workorders)}",
            meta_style
        ),
        Spacer(1, 10),
    ]

    headers = ["#", "OT", "Fecha", "Estado", "Solicitante", "Detalle", "Service Desk", "Obs."]
    rows = [headers]
    for i, wo in enumerate(workorders, 1):
        created = wo.get('created_at', '')
        if isinstance(created, str) and 'T' in created:
            created = created.split('T')[0]
        rows.append([
            str(i),
            Paragraph(str(wo.get('ot_number', '')), cell_style),
            Paragraph(str(created), cell_style),
            Paragraph(status_labels.get(wo.get('status', 'pending'), 'Pendiente'), cell_style),
            Paragraph(str(wo.get('requestor', '') or '-'), cell_style),
            Paragraph(str(wo.get('task_detail', '') or '-')[:300], cell_style),
            Paragraph(str(wo.get('service_desk_number', '') or '-'), cell_style),
            Paragraph(str(wo.get('observations', '') or '-')[:200], cell_style),
        ])

    col_widths = [22, 70, 60, 65, 90, 220, 80, 150]
    table = Table(rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F62FE')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(table)
    doc.build(elements)

    return FileResponse(
        path=pdf_path,
        filename=filename,
        media_type='application/pdf',
        background=None,
    )


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    await ensure_indexes(db)
    await seed_admin(db)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
