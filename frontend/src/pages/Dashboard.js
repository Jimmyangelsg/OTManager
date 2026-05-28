import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Plus, Search, FileText, Download, Edit, Trash2, Filter,
  FileSpreadsheet, GripVertical, Paperclip, X, Calendar,
  User, Hash, ListChecks, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import CreateWorkOrderForm from '@/components/CreateWorkOrderForm';
import WorkOrderDetails from '@/components/WorkOrderDetails';
import EditWorkOrderForm from '@/components/EditWorkOrderForm';
import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function formatDateLabel(date) {
  const d = new Date(date);
  if (isToday(d)) return `Hoy · ${format(d, 'HH:mm')}`;
  if (isYesterday(d)) return `Ayer · ${format(d, 'HH:mm')}`;
  return format(d, "dd MMM yyyy · HH:mm", { locale: es });
}

export default function Dashboard() {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRequestor, setFilterRequestor] = useState('');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterRequestor) params.append('requestor', filterRequestor);

      const response = await axios.get(`${API}/workorders?${params.toString()}`);
      setWorkOrders(response.data);
    } catch (error) {
      console.error('Error fetching work orders:', error);
      toast.error('Error al cargar las órdenes de trabajo');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => fetchWorkOrders();

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterRequestor('');
    setTimeout(fetchWorkOrders, 100);
  };

  const handleViewDetails = (workOrder) => {
    setSelectedWorkOrder(workOrder);
    setIsDetailsOpen(true);
  };

  const handleEdit = (workOrder) => {
    setSelectedWorkOrder(workOrder);
    setIsEditOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await axios.delete(`${API}/workorders/${pendingDelete.id}`);
      toast.success(`OT ${pendingDelete.ot_number} eliminada`);
      setPendingDelete(null);
      fetchWorkOrders();
    } catch (error) {
      console.error('Error deleting work order:', error);
      toast.error('Error al eliminar la orden de trabajo');
    }
  };

  const handleDownloadAttachment = async (workOrder) => {
    try {
      const response = await axios.get(`${API}/workorders/${workOrder.id}/attachment`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', workOrder.attachment_filename || 'attachment');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Archivo descargado');
    } catch (error) {
      console.error('Error downloading attachment:', error);
      toast.error('Error al descargar el archivo');
    }
  };

  const handleExportToExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterRequestor) params.append('requestor', filterRequestor);

      const response = await axios.get(`${API}/workorders/export/excel?${params.toString()}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      link.setAttribute('download', `ordenes_trabajo_${timestamp}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Archivo Excel exportado');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      if (error.response?.status === 404) {
        toast.error('No hay órdenes de trabajo para exportar');
      } else {
        toast.error('Error al exportar a Excel');
      }
    }
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;

    const reordered = Array.from(workOrders);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setWorkOrders(reordered); // optimistic UI

    try {
      await axios.post(`${API}/workorders/reorder`, {
        ordered_ids: reordered.map((wo) => wo.id),
      });
      toast.success('Orden actualizado');
    } catch (error) {
      console.error('Error reordering:', error);
      toast.error('No se pudo guardar el nuevo orden');
      fetchWorkOrders();
    }
  };

  const isFiltered = Boolean(searchTerm || filterRequestor);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="px-6 py-5 max-w-[1600px] mx-auto w-full">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#0F62FE] to-[#0043CE] flex items-center justify-center shadow-md shadow-blue-500/20">
                <ListChecks className="h-6 w-6 text-white" strokeWidth={2.4} />
              </div>
              <div>
                <h1
                  className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-none"
                  style={{ fontFamily: 'Chivo, sans-serif' }}
                >
                  Órdenes de Trabajo
                </h1>
                <p className="text-xs text-slate-500 mt-1.5 font-medium">
                  IBM Maximo · Gestión Personal · {workOrders.length} {workOrders.length === 1 ? 'orden' : 'órdenes'}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                data-testid="export-excel-button"
                onClick={handleExportToExcel}
                variant="outline"
                className="h-10 px-4 rounded-md font-medium text-sm border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-800 transition-all"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>

              <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <SheetTrigger asChild>
                  <Button
                    data-testid="create-workorder-button"
                    className="bg-gradient-to-r from-[#0F62FE] to-[#0043CE] hover:from-[#0043CE] hover:to-[#002D9C] text-white h-10 px-4 rounded-md font-medium text-sm shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Nueva OT
                  </Button>
                </SheetTrigger>
                <SheetContent className="sm:max-w-[600px] w-full overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle
                      className="text-2xl font-bold tracking-tight"
                      style={{ fontFamily: 'Chivo, sans-serif' }}
                    >
                      Crear Nueva Orden de Trabajo
                    </SheetTitle>
                    <SheetDescription>
                      Complete los detalles de la orden de trabajo recibida en IBM Maximo
                    </SheetDescription>
                  </SheetHeader>
                  <CreateWorkOrderForm
                    onSuccess={() => {
                      setIsCreateOpen(false);
                      fetchWorkOrders();
                    }}
                  />
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mt-5 space-y-3">
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  data-testid="search-input"
                  placeholder="Buscar por número de OT..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 h-10 rounded-md border-slate-300 focus:ring-2 focus:ring-[#0F62FE]/20 focus:border-[#0F62FE]"
                />
              </div>
              <Button
                data-testid="search-button"
                onClick={handleSearch}
                className="bg-slate-900 hover:bg-slate-800 text-white h-10 px-5 rounded-md font-medium"
              >
                Buscar
              </Button>
              <Button
                data-testid="filter-toggle-button"
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                className={`h-10 px-4 rounded-md font-medium transition-colors ${
                  showFilters || filterRequestor
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : ''
                }`}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
                {filterRequestor && (
                  <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                    1
                  </span>
                )}
              </Button>
              {isFiltered && (
                <Button
                  data-testid="quick-clear-filters"
                  onClick={handleClearFilters}
                  variant="ghost"
                  className="h-10 px-3 rounded-md text-slate-500 hover:text-slate-900"
                >
                  <X className="h-4 w-4 mr-1" /> Limpiar
                </Button>
              )}
            </div>

            {showFilters && (
              <div
                className="flex gap-2 p-3 bg-slate-50/80 rounded-md border border-slate-200 flex-wrap"
                data-testid="filters-panel"
              >
                <Input
                  data-testid="filter-requestor-input"
                  placeholder="Filtrar por solicitante..."
                  value={filterRequestor}
                  onChange={(e) => setFilterRequestor(e.target.value)}
                  className="h-10 rounded-md border-slate-300 flex-1 min-w-[200px]"
                />
                <Button
                  data-testid="apply-filters-button"
                  onClick={handleSearch}
                  className="bg-[#0F62FE] hover:bg-[#0043CE] text-white h-10 px-4 rounded-md"
                >
                  Aplicar
                </Button>
                <Button
                  data-testid="clear-filters-button"
                  onClick={handleClearFilters}
                  variant="outline"
                  className="h-10 px-4 rounded-md"
                >
                  Limpiar
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-6 max-w-[1600px] mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center py-32" data-testid="loading-indicator">
            <div className="flex items-center gap-3 text-slate-500">
              <div className="h-5 w-5 rounded-full border-2 border-slate-300 border-t-[#0F62FE] animate-spin" />
              <p>Cargando órdenes de trabajo...</p>
            </div>
          </div>
        ) : workOrders.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-24 text-center bg-white border border-dashed border-slate-300 rounded-xl"
            data-testid="empty-state"
          >
            <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">
              {isFiltered ? 'No se encontraron coincidencias' : 'No hay órdenes de trabajo'}
            </h3>
            <p className="text-sm text-slate-500 mb-5 max-w-sm">
              {isFiltered
                ? 'Probá ajustar la búsqueda o limpiar los filtros.'
                : 'Comenzá creando tu primera OT para gestionar tus tareas de IBM Maximo.'}
            </p>
            {isFiltered ? (
              <Button onClick={handleClearFilters} variant="outline" className="rounded-md">
                <X className="mr-2 h-4 w-4" />
                Limpiar filtros
              </Button>
            ) : (
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="bg-gradient-to-r from-[#0F62FE] to-[#0043CE] text-white rounded-md shadow-md shadow-blue-500/20"
              >
                <Plus className="mr-2 h-4 w-4" />
                Crear Primera OT
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs text-slate-500 font-medium flex items-center gap-2">
                <GripVertical className="h-3.5 w-3.5" />
                Arrastrá las filas para reordenar
              </p>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="workorders-list">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    data-testid="workorders-list"
                    className="space-y-2"
                  >
                    {workOrders.map((wo, index) => (
                      <Draggable key={wo.id} draggableId={wo.id} index={index}>
                        {(dragProvided, snapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            data-testid={`workorder-row-${wo.ot_number}`}
                            className={`group bg-white border rounded-lg transition-all ${
                              snapshot.isDragging
                                ? 'border-[#0F62FE] shadow-2xl shadow-blue-500/20 ring-2 ring-blue-200'
                                : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex items-stretch">
                              {/* Drag handle */}
                              <div
                                {...dragProvided.dragHandleProps}
                                data-testid={`drag-handle-${wo.ot_number}`}
                                className="flex items-center px-2 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600 group-hover:text-slate-500 transition-colors border-r border-slate-100"
                                title="Arrastrar para reordenar"
                              >
                                <GripVertical className="h-5 w-5" />
                              </div>

                              {/* Row index */}
                              <div className="flex items-center justify-center w-10 text-xs font-bold text-slate-400 border-r border-slate-100">
                                {index + 1}
                              </div>

                              {/* Main content (clickable) */}
                              <button
                                type="button"
                                onClick={() => handleViewDetails(wo)}
                                className="flex-1 text-left p-4 hover:bg-slate-50/60 transition-colors"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-start">
                                  {/* OT number + date */}
                                  <div className="md:col-span-3">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Hash className="h-3.5 w-3.5 text-[#0F62FE]" />
                                      <span className="font-mono font-bold text-[#0F62FE] text-base">
                                        {wo.ot_number}
                                      </span>
                                      {isToday(new Date(wo.created_at)) && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                          <Sparkles className="h-2.5 w-2.5" />
                                          Hoy
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-500 font-mono flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {formatDateLabel(wo.created_at)}
                                    </p>
                                  </div>

                                  {/* Requestor */}
                                  <div className="md:col-span-2 min-w-0">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                                      Solicitante
                                    </p>
                                    <p className="text-sm text-slate-800 truncate flex items-center gap-1">
                                      <User className="h-3 w-3 text-slate-400 shrink-0" />
                                      <span className="truncate">{wo.requestor || '—'}</span>
                                    </p>
                                  </div>

                                  {/* Task detail */}
                                  <div className="md:col-span-4 min-w-0">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                                      Detalle
                                    </p>
                                    <p className="text-sm text-slate-700 line-clamp-2">
                                      {wo.task_detail || '—'}
                                    </p>
                                  </div>

                                  {/* Service desk */}
                                  <div className="md:col-span-2 min-w-0">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                                      Service Desk
                                    </p>
                                    <p className="text-sm font-mono text-slate-700 truncate">
                                      {wo.service_desk_number || '—'}
                                    </p>
                                  </div>

                                  {/* Attachment indicator */}
                                  <div className="md:col-span-1 flex md:justify-end">
                                    {wo.attachment_filename ? (
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-[#0F62FE] text-xs font-medium"
                                        title={wo.attachment_filename}
                                      >
                                        <Paperclip className="h-3 w-3" />
                                        Adjunto
                                      </span>
                                    ) : (
                                      <span className="text-xs text-slate-300">—</span>
                                    )}
                                  </div>
                                </div>
                              </button>

                              {/* Actions */}
                              <div
                                className="flex items-center gap-1 px-3 border-l border-slate-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {wo.attachment_filename && (
                                  <Button
                                    data-testid={`download-attachment-${wo.ot_number}`}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDownloadAttachment(wo)}
                                    className="h-8 w-8 p-0 text-slate-500 hover:bg-blue-50 hover:text-[#0F62FE]"
                                    title="Descargar adjunto"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  data-testid={`edit-workorder-${wo.ot_number}`}
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(wo)}
                                  className="h-8 w-8 p-0 text-slate-500 hover:bg-amber-50 hover:text-amber-600"
                                  title="Editar"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  data-testid={`delete-workorder-${wo.ot_number}`}
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setPendingDelete(wo)}
                                  className="h-8 w-8 p-0 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </>
        )}
      </main>

      {/* Details Sheet */}
      <Sheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <SheetContent className="sm:max-w-[600px] w-full overflow-y-auto">
          {selectedWorkOrder && (
            <WorkOrderDetails
              workOrder={selectedWorkOrder}
              onClose={() => setIsDetailsOpen(false)}
              onEdit={() => {
                setIsDetailsOpen(false);
                setIsEditOpen(true);
              }}
              onDownload={handleDownloadAttachment}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Sheet */}
      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="sm:max-w-[600px] w-full overflow-y-auto">
          {selectedWorkOrder && (
            <>
              <SheetHeader>
                <SheetTitle
                  className="text-2xl font-bold tracking-tight"
                  style={{ fontFamily: 'Chivo, sans-serif' }}
                >
                  Editar Orden de Trabajo
                </SheetTitle>
                <SheetDescription>
                  Modificá los detalles de la orden de trabajo
                </SheetDescription>
              </SheetHeader>
              <EditWorkOrderForm
                workOrder={selectedWorkOrder}
                onSuccess={() => {
                  setIsEditOpen(false);
                  fetchWorkOrders();
                }}
              />
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent data-testid="delete-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta OT?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>
                  Estás por eliminar la OT{' '}
                  <span className="font-mono font-bold text-slate-900">
                    {pendingDelete.ot_number}
                  </span>
                  . Esta acción no se puede deshacer.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-button">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete-button"
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
