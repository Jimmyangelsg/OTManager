# Sistema de Gestión de Órdenes de Trabajo - IBM Maximo

## 📋 Descripción

Aplicación web local para registrar, gestionar y realizar seguimiento de órdenes de trabajo (OT) recibidas en IBM Maximo. Diseñada para uso personal con almacenamiento local y funcionamiento offline.

## ✨ Funcionalidades

### Gestión de Órdenes de Trabajo
- ✅ **Crear nuevas OT** con todos los campos necesarios
- ✅ **Visualizar todas las OT** en tabla ordenada por fecha
- ✅ **Buscar** por número de OT
- ✅ **Filtrar** por solicitante y fecha
- ✅ **Editar** registros existentes
- ✅ **Eliminar** órdenes de trabajo
- ✅ **Adjuntar archivos** (PDF, imágenes, documentos)
- ✅ **Descargar archivos** adjuntos

### Campos de cada OT
- **Número de OT** (obligatorio)
- **Fecha y hora de registro** (generada automáticamente)
- **Solicitante**
- **Detalle de la tarea**
- **Número de Service Desk** (opcional)
- **Observaciones**
- **Archivo adjunto** (opcional)

## 🚀 Cómo Usar la Aplicación

### Acceso
La aplicación está corriendo en modo local. Accede desde tu navegador:
```
https://orden-trabajo-local.preview.emergentagent.com
```

### Crear una Nueva OT
1. Haz clic en el botón **"Nueva OT"** (esquina superior derecha)
2. Completa el formulario:
   - Número de OT (obligatorio)
   - Solicitante
   - Detalle de la tarea
   - Número de Service Desk
   - Observaciones
3. Opcionalmente, adjunta un archivo haciendo clic en "Elegir"
4. Haz clic en **"Crear Orden de Trabajo"**

### Buscar y Filtrar
- **Búsqueda rápida**: Escribe el número de OT en el campo de búsqueda
- **Filtros avanzados**: Haz clic en "Filtros" para filtrar por solicitante

### Ver Detalles
- Haz clic en cualquier fila de la tabla para ver los detalles completos de la OT

### Editar una OT
1. Haz clic en el ícono de **editar** (lápiz) en la fila de la OT
2. O desde el panel de detalles, haz clic en **"Editar"**
3. Modifica los campos necesarios
4. Guarda los cambios

### Descargar Archivos Adjuntos
- Haz clic en el ícono de **descarga** en la tabla
- O desde el panel de detalles, haz clic en **"Descargar"**

### Eliminar una OT
1. Haz clic en el ícono de **eliminar** (papelera)
2. Confirma la eliminación en el diálogo

## 🛠️ Arquitectura Técnica

### Stack Tecnológico
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python)
- **Base de Datos**: MongoDB
- **Gestión de Formularios**: React Hook Form + Zod
- **Notificaciones**: Sonner

### Estructura del Proyecto
```
/app/
├── backend/
│   ├── server.py          # API REST con FastAPI
│   ├── uploads/           # Archivos adjuntos almacenados
│   ├── requirements.txt   # Dependencias Python
│   └── .env              # Variables de entorno
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   └── Dashboard.js          # Página principal
│   │   ├── components/
│   │   │   ├── CreateWorkOrderForm.js   # Formulario crear OT
│   │   │   ├── EditWorkOrderForm.js     # Formulario editar OT
│   │   │   └── WorkOrderDetails.js      # Vista de detalles
│   │   ├── App.js
│   │   └── App.css
│   └── package.json
└── README_OT.md
```

## 📡 API Endpoints

### Órdenes de Trabajo
- `GET /api/workorders` - Listar todas las OT (con filtros opcionales)
- `POST /api/workorders` - Crear nueva OT
- `GET /api/workorders/{id}` - Obtener una OT específica
- `PUT /api/workorders/{id}` - Actualizar una OT
- `DELETE /api/workorders/{id}` - Eliminar una OT

### Archivos Adjuntos
- `POST /api/workorders/{id}/upload` - Subir archivo adjunto
- `GET /api/workorders/{id}/attachment` - Descargar archivo adjunto

## 🔧 Comandos Útiles

### Reiniciar Servicios
```bash
sudo supervisorctl restart backend frontend
```

### Ver Logs del Backend
```bash
tail -f /var/log/supervisor/backend.*.log
```

### Ver Logs del Frontend
```bash
tail -f /var/log/supervisor/frontend.*.log
```

### Estado de los Servicios
```bash
sudo supervisorctl status
```

## 💾 Almacenamiento

### Base de Datos
- Los registros de OT se guardan en MongoDB (base de datos local)
- Conexión: `mongodb://localhost:27017`
- Base de datos: `test_database`
- Colección: `workorders`

### Archivos Adjuntos
- Los archivos se almacenan en: `/app/backend/uploads/`
- Cada archivo se renombra con un UUID único para evitar conflictos
- Los archivos originales mantienen su extensión

## 🎨 Diseño

La aplicación utiliza el tema **"Industrial Precision"**:
- **Colores**: IBM Technical Blue (#0F62FE), Safety Orange (#FF4F00)
- **Tipografías**: 
  - Chivo (títulos)
  - Manrope (texto general)
  - JetBrains Mono (números de OT, fechas)
- **Estilo**: Profesional, alta densidad, inspirado en herramientas industriales

## 🔒 Seguridad y Privacidad

- **Sin autenticación**: La aplicación está diseñada para uso personal local
- **Almacenamiento local**: Todos los datos permanecen en tu máquina
- **Sin conexión a internet**: Funciona completamente offline una vez instalada

## 📝 Notas Importantes

1. **Backup**: Considera hacer backups periódicos de la base de datos MongoDB
2. **Archivos grandes**: El sistema puede manejar archivos de cualquier tamaño, pero archivos muy grandes pueden tardar en subir
3. **Formatos soportados**: PDF, imágenes (JPG, PNG), documentos (DOCX, XLSX), etc.
4. **Navegadores**: Funciona en Chrome, Firefox, Safari y Edge

## 🆘 Solución de Problemas

### La aplicación no carga
1. Verifica que los servicios estén corriendo: `sudo supervisorctl status`
2. Reinicia los servicios: `sudo supervisorctl restart backend frontend`
3. Revisa los logs para errores

### No puedo subir archivos
1. Verifica que la carpeta `/app/backend/uploads/` exista
2. Revisa los permisos de la carpeta
3. Verifica los logs del backend

### Los cambios no se guardan
1. Verifica la conexión a MongoDB
2. Revisa los logs del backend
3. Verifica que el backend esté corriendo

## 📞 Soporte

Esta aplicación fue desarrollada con Emergent AI. Para soporte adicional o mejoras, consulta la documentación de Emergent.

---

**Versión**: 1.0.0  
**Última actualización**: Enero 2026
