import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Edit, Download, FileText, Calendar, User, Clipboard, AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { getStatusMeta } from '@/lib/status';

export default function WorkOrderDetails({ workOrder, onClose, onEdit, onDownload }) {
  const statusMeta = getStatusMeta(workOrder.status);

  return (
    <div data-testid="workorder-details">
      <SheetHeader>
        <SheetTitle className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
          Detalles de la Orden de Trabajo
        </SheetTitle>
        <SheetDescription>
          Información completa de la OT #{workOrder.ot_number}
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <Clipboard className="h-4 w-4" />
              Número de OT
            </div>
            <p className="text-2xl font-mono font-bold text-[#0F62FE]" data-testid="detail-ot-number">
              {workOrder.ot_number}
            </p>
          </div>
          <span
            data-testid="detail-status-badge"
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${statusMeta.badge}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
            {statusMeta.label}
          </span>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <Calendar className="h-4 w-4" />
            Fecha y Hora de Registro
          </div>
          <p className="text-base font-mono text-slate-900" data-testid="detail-created-at">
            {format(new Date(workOrder.created_at), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <User className="h-4 w-4" />
            Solicitante
          </div>
          <p className="text-base text-slate-900" data-testid="detail-requestor">
            {workOrder.requestor || 'No especificado'}
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <FileText className="h-4 w-4" />
            Detalle de la Tarea
          </div>
          <p className="text-base text-slate-900 whitespace-pre-wrap" data-testid="detail-task-detail">
            {workOrder.task_detail || 'No especificado'}
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <AlertCircle className="h-4 w-4" />
            Número de Service Desk
          </div>
          <p className="text-base font-mono text-slate-900" data-testid="detail-service-desk">
            {workOrder.service_desk_number || 'No especificado'}
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <FileText className="h-4 w-4" />
            Observaciones
          </div>
          <p className="text-base text-slate-900 whitespace-pre-wrap" data-testid="detail-observations">
            {workOrder.observations || 'Sin observaciones'}
          </p>
        </div>

        {workOrder.attachment_filename && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <FileText className="h-4 w-4" />
                Archivo Adjunto
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-md">
                <span className="text-sm text-slate-700" data-testid="detail-attachment-filename">
                  {workOrder.attachment_filename}
                </span>
                <Button
                  data-testid="detail-download-attachment-button"
                  size="sm"
                  onClick={() => onDownload(workOrder)}
                  className="bg-[#0F62FE] hover:bg-[#0043CE] text-white h-8 px-3 rounded-md"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar
                </Button>
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3 pt-4">
          {onEdit && (
            <Button
              data-testid="detail-edit-button"
              onClick={onEdit}
              className="flex-1 bg-gradient-to-r from-[#0F62FE] to-[#0043CE] text-white h-10 px-4 rounded-md font-medium"
            >
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          )}
          <Button
            data-testid="detail-close-button"
            onClick={onClose}
            variant="outline"
            className="flex-1 h-10 px-4 rounded-md font-medium"
          >
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
