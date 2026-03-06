import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Search, FileText, Download, Edit, Trash2, Filter, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import CreateWorkOrderForm from '@/components/CreateWorkOrderForm';
import WorkOrderDetails from '@/components/WorkOrderDetails';
import EditWorkOrderForm from '@/components/EditWorkOrderForm';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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

  const handleSearch = () => {
    fetchWorkOrders();
  };

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

  const handleDelete = async (workOrderId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta orden de trabajo?')) {
      return;
    }

    try {
      await axios.delete(`${API}/workorders/${workOrderId}`);
      toast.success('Orden de trabajo eliminada exitosamente');
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
      
      toast.success('Archivo descargado exitosamente');
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
      
      toast.success('Archivo Excel exportado exitosamente');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      if (error.response?.status === 404) {
        toast.error('No hay órdenes de trabajo para exportar');
      } else {
        toast.error('Error al exportar a Excel');
      }
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="border-b border-slate-200 bg-slate-50/50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900" style={{ fontFamily: 'Chivo, sans-serif' }}>
                Gestión de Órdenes de Trabajo
              </h1>
              <p className="text-sm text-slate-600 mt-1">IBM Maximo - Control Personal</p>
            </div>
            
            <div className="flex gap-2">
              <Button
                data-testid="export-excel-button"
                onClick={handleExportToExcel}
                variant="outline"
                className="h-9 px-4 rounded-sm font-medium text-sm border-[#0F62FE] text-[#0F62FE] hover:bg-[#0F62FE] hover:text-white transition-colors"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Exportar a Excel
              </Button>
              
              <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <SheetTrigger asChild>
                  <Button 
                    data-testid="create-workorder-button"
                    className="bg-[#0F62FE] hover:bg-[#0043CE] text-white h-9 px-4 rounded-sm font-medium text-sm transition-colors"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Nueva OT
                  </Button>
                </SheetTrigger>
                <SheetContent className="sm:max-w-[600px] w-full">
                  <SheetHeader>
                    <SheetTitle className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
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
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  data-testid="search-input"
                  placeholder="Buscar por número de OT..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 h-9 rounded-sm border-slate-300 focus:ring-1 focus:ring-[#0F62FE]"
                />
              </div>
              <Button
                data-testid="search-button"
                onClick={handleSearch}
                className="bg-slate-200 hover:bg-slate-300 text-slate-900 h-9 px-4 rounded-sm"
              >
                Buscar
              </Button>
              <Button
                data-testid="filter-toggle-button"
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                className="h-9 px-4 rounded-sm"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
            </div>

            {showFilters && (
              <div className="flex gap-2 p-3 bg-slate-50 rounded-sm border border-slate-200" data-testid="filters-panel">
                <Input
                  data-testid="filter-requestor-input"
                  placeholder="Filtrar por solicitante..."
                  value={filterRequestor}
                  onChange={(e) => setFilterRequestor(e.target.value)}
                  className="h-9 rounded-sm border-slate-300"
                />
                <Button
                  data-testid="apply-filters-button"
                  onClick={handleSearch}
                  className="bg-[#0F62FE] hover:bg-[#0043CE] text-white h-9 px-4 rounded-sm"
                >
                  Aplicar
                </Button>
                <Button
                  data-testid="clear-filters-button"
                  onClick={handleClearFilters}
                  variant="outline"
                  className="h-9 px-4 rounded-sm"
                >
                  Limpiar
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64" data-testid="loading-indicator">
            <p className="text-slate-500">Cargando órdenes de trabajo...</p>
          </div>
        ) : workOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center" data-testid="empty-state">
            <FileText className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No hay órdenes de trabajo</h3>
            <p className="text-sm text-slate-500 mb-4">Comienza creando tu primera orden de trabajo</p>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-[#0F62FE] hover:bg-[#0043CE] text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Crear Primera OT
            </Button>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-sm overflow-hidden" data-testid="workorders-table">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="h-10 px-4 text-left align-middle font-medium text-slate-600 text-xs uppercase tracking-wider">
                    Número OT
                  </th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-slate-600 text-xs uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-slate-600 text-xs uppercase tracking-wider">
                    Solicitante
                  </th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-slate-600 text-xs uppercase tracking-wider">
                    Detalle
                  </th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-slate-600 text-xs uppercase tracking-wider">
                    Service Desk
                  </th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-slate-600 text-xs uppercase tracking-wider">
                    Adjunto
                  </th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-slate-600 text-xs uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((wo) => (
                  <tr
                    key={wo.id}
                    data-testid={`workorder-row-${wo.ot_number}`}
                    className="border-b border-slate-200 transition-colors hover:bg-slate-50/50 cursor-pointer"
                    onClick={() => handleViewDetails(wo)}
                  >
                    <td className="p-3 align-middle text-sm font-mono font-medium text-[#0F62FE]">
                      {wo.ot_number}
                    </td>
                    <td className="p-3 align-middle text-sm font-mono text-slate-700">
                      {format(new Date(wo.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </td>
                    <td className="p-3 align-middle text-sm text-slate-700">
                      {wo.requestor || '-'}
                    </td>
                    <td className="p-3 align-middle text-sm text-slate-600">
                      <div className="max-w-xs truncate">
                        {wo.task_detail || '-'}
                      </div>
                    </td>
                    <td className="p-3 align-middle text-sm font-mono text-slate-700">
                      {wo.service_desk_number || '-'}
                    </td>
                    <td className="p-3 align-middle text-sm">
                      {wo.attachment_filename ? (
                        <span className="inline-flex items-center text-[#0F62FE]">
                          <FileText className="h-4 w-4 mr-1" />
                          Sí
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-3 align-middle text-sm">
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {wo.attachment_filename && (
                          <Button
                            data-testid={`download-attachment-${wo.ot_number}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadAttachment(wo)}
                            className="h-8 w-8 p-0 hover:bg-slate-200"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          data-testid={`edit-workorder-${wo.ot_number}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(wo)}
                          className="h-8 w-8 p-0 hover:bg-slate-200"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          data-testid={`delete-workorder-${wo.ot_number}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(wo.id)}
                          className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Details Sheet */}
      <Sheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <SheetContent className="sm:max-w-[600px] w-full">
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
        <SheetContent className="sm:max-w-[600px] w-full">
          {selectedWorkOrder && (
            <>
              <SheetHeader>
                <SheetTitle className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
                  Editar Orden de Trabajo
                </SheetTitle>
                <SheetDescription>
                  Modifique los detalles de la orden de trabajo
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
    </div>
  );
}
