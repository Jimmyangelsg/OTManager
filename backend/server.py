from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import aiofiles
import shutil
import pandas as pd
from io import BytesIO

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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

class WorkOrderCreate(BaseModel):
    ot_number: str
    requestor: Optional[str] = None
    task_detail: Optional[str] = None
    service_desk_number: Optional[str] = None
    observations: Optional[str] = None

class WorkOrderUpdate(BaseModel):
    ot_number: Optional[str] = None
    requestor: Optional[str] = None
    task_detail: Optional[str] = None
    service_desk_number: Optional[str] = None
    observations: Optional[str] = None


# Routes
@api_router.get("/")
async def root():
    return {"message": "Work Order Management API"}

@api_router.post("/workorders", response_model=WorkOrder)
async def create_workorder(input: WorkOrderCreate):
    wo_dict = input.model_dump()
    wo_obj = WorkOrder(**wo_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = wo_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    _ = await db.workorders.insert_one(doc)
    return wo_obj

@api_router.get("/workorders", response_model=List[WorkOrder])
async def get_workorders(
    search: Optional[str] = None,
    requestor: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    # Build query
    query = {}
    
    if search:
        query['ot_number'] = {'$regex': search, '$options': 'i'}
    
    if requestor:
        query['requestor'] = {'$regex': requestor, '$options': 'i'}
    
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query['$gte'] = date_from
        if date_to:
            date_query['$lte'] = date_to
        if date_query:
            query['created_at'] = date_query
    
    # Exclude MongoDB's _id field from the query results
    workorders = await db.workorders.find(query, {"_id": 0}).sort('created_at', -1).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for wo in workorders:
        if isinstance(wo['created_at'], str):
            wo['created_at'] = datetime.fromisoformat(wo['created_at'])
    
    return workorders

@api_router.get("/workorders/{workorder_id}", response_model=WorkOrder)
async def get_workorder(workorder_id: str):
    workorder = await db.workorders.find_one({"id": workorder_id}, {"_id": 0})
    
    if not workorder:
        raise HTTPException(status_code=404, detail="Work order not found")
    
    # Convert ISO string timestamp back to datetime
    if isinstance(workorder['created_at'], str):
        workorder['created_at'] = datetime.fromisoformat(workorder['created_at'])
    
    return workorder

@api_router.put("/workorders/{workorder_id}", response_model=WorkOrder)
async def update_workorder(workorder_id: str, input: WorkOrderUpdate):
    # Get existing workorder
    existing = await db.workorders.find_one({"id": workorder_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Work order not found")
    
    # Update only provided fields
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    
    if update_data:
        await db.workorders.update_one(
            {"id": workorder_id},
            {"$set": update_data}
        )
    
    # Fetch updated workorder
    updated_wo = await db.workorders.find_one({"id": workorder_id}, {"_id": 0})
    
    # Convert ISO string timestamp back to datetime
    if isinstance(updated_wo['created_at'], str):
        updated_wo['created_at'] = datetime.fromisoformat(updated_wo['created_at'])
    
    return updated_wo

@api_router.delete("/workorders/{workorder_id}")
async def delete_workorder(workorder_id: str):
    result = await db.workorders.delete_one({"id": workorder_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Work order not found")
    
    return {"message": "Work order deleted successfully"}

@api_router.post("/workorders/{workorder_id}/upload")
async def upload_attachment(workorder_id: str, file: UploadFile = File(...)):
    # Check if workorder exists
    workorder = await db.workorders.find_one({"id": workorder_id}, {"_id": 0})
    if not workorder:
        raise HTTPException(status_code=404, detail="Work order not found")
    
    # Generate unique filename
    file_extension = Path(file.filename).suffix
    unique_filename = f"{workorder_id}_{uuid.uuid4()}{file_extension}"
    file_path = UPLOADS_DIR / unique_filename
    
    # Save file
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)
    
    # Update workorder with attachment info
    attachment_url = f"/api/workorders/{workorder_id}/attachment"
    await db.workorders.update_one(
        {"id": workorder_id},
        {"$set": {
            "attachment_filename": file.filename,
            "attachment_url": attachment_url,
            "_stored_filename": unique_filename
        }}
    )
    
    return {
        "filename": file.filename,
        "url": attachment_url,
        "message": "File uploaded successfully"
    }

@api_router.get("/workorders/{workorder_id}/attachment")
async def download_attachment(workorder_id: str):
    workorder = await db.workorders.find_one({"id": workorder_id}, {"_id": 0})
    
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
    search: Optional[str] = None,
    requestor: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    # Build query (same as get_workorders)
    query = {}
    
    if search:
        query['ot_number'] = {'$regex': search, '$options': 'i'}
    
    if requestor:
        query['requestor'] = {'$regex': requestor, '$options': 'i'}
    
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query['$gte'] = date_from
        if date_to:
            date_query['$lte'] = date_to
        if date_query:
            query['created_at'] = date_query
    
    # Get workorders
    workorders = await db.workorders.find(query, {"_id": 0, "_stored_filename": 0}).sort('created_at', -1).to_list(1000)
    
    if not workorders:
        raise HTTPException(status_code=404, detail="No work orders found to export")
    
    # Convert to DataFrame
    df_data = []
    for wo in workorders:
        df_data.append({
            'Número de OT': wo.get('ot_number', ''),
            'Fecha y Hora': wo.get('created_at', ''),
            'Solicitante': wo.get('requestor', ''),
            'Detalle de la Tarea': wo.get('task_detail', ''),
            'Número de Service Desk': wo.get('service_desk_number', ''),
            'Observaciones': wo.get('observations', ''),
            'Tiene Adjunto': 'Sí' if wo.get('attachment_filename') else 'No',
            'Nombre del Archivo': wo.get('attachment_filename', '')
        })
    
    df = pd.DataFrame(df_data)
    
    # Create Excel file in memory
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Órdenes de Trabajo', index=False)
        
        # Auto-adjust column widths
        worksheet = writer.sheets['Órdenes de Trabajo']
        for idx, col in enumerate(df.columns):
            # Convert to string and handle NaN values
            col_lengths = df[col].fillna('').astype(str).apply(len)
            max_length = max(
                col_lengths.max() if len(col_lengths) > 0 else 0,
                len(col)
            )
            worksheet.column_dimensions[chr(65 + idx)].width = min(max_length + 2, 50)
    
    output.seek(0)
    
    # Generate filename with timestamp
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    filename = f"ordenes_trabajo_{timestamp}.xlsx"
    
    # Save to temp file and return
    temp_path = UPLOADS_DIR / filename
    async with aiofiles.open(temp_path, 'wb') as f:
        await f.write(output.getvalue())
    
    return FileResponse(
        path=temp_path,
        filename=filename,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        background=None
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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
