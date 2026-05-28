import { useState } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, X } from 'lucide-react';
import api, { formatApiErrorDetail } from '@/lib/api';
import { STATUS_OPTIONS } from '@/lib/status';
import { validateFile, formatBytes, ALLOWED_EXTENSIONS } from '@/lib/uploadValidation';

const formSchema = z.object({
  ot_number: z.string().min(1, 'El número de OT es obligatorio'),
  requestor: z.string().optional(),
  task_detail: z.string().optional(),
  service_desk_number: z.string().optional(),
  observations: z.string().optional(),
});

export default function EditWorkOrderForm({ workOrder, onSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState(workOrder.status || 'pending');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ot_number: workOrder.ot_number,
      requestor: workOrder.requestor || '',
      task_detail: workOrder.task_detail || '',
      service_desk_number: workOrder.service_desk_number || '',
      observations: workOrder.observations || '',
    },
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await api.put(`/workorders/${workOrder.id}`, { ...data, status });
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        await api.post(`/workorders/${workOrder.id}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      toast.success('OT actualizada');
      onSuccess();
    } catch (error) {
      console.error('Error updating work order:', error);
      const msg = formatApiErrorDetail(error.response?.data?.detail) || 'Error al actualizar';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5" data-testid="edit-workorder-form">
      <div>
        <Label htmlFor="ot_number" className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
          Número de OT *
        </Label>
        <Input
          data-testid="edit-ot-number-input"
          id="ot_number"
          {...register('ot_number')}
          className="h-10 rounded-md border-slate-300 focus:ring-2 focus:ring-[#0F62FE]/20 focus:border-[#0F62FE]"
        />
        {errors.ot_number && <p className="text-xs text-red-600 mt-1">{errors.ot_number.message}</p>}
      </div>

      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
          Estado
        </Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10 rounded-md border-slate-300" data-testid="edit-status-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} data-testid={`status-option-${opt.value}`}>
                <span className="inline-flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${opt.dot}`} />
                  {opt.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="requestor" className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
          Solicitante
        </Label>
        <Input data-testid="edit-requestor-input" id="requestor" {...register('requestor')} className="h-10 rounded-md border-slate-300" />
      </div>

      <div>
        <Label htmlFor="task_detail" className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
          Detalle de la Tarea
        </Label>
        <Textarea data-testid="edit-task-detail-input" id="task_detail" {...register('task_detail')} rows={4} className="rounded-md border-slate-300" />
      </div>

      <div>
        <Label htmlFor="service_desk_number" className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
          Número de Service Desk
        </Label>
        <Input data-testid="edit-service-desk-input" id="service_desk_number" {...register('service_desk_number')} className="h-10 rounded-md border-slate-300" />
      </div>

      <div>
        <Label htmlFor="observations" className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
          Observaciones
        </Label>
        <Textarea data-testid="edit-observations-input" id="observations" {...register('observations')} rows={3} className="rounded-md border-slate-300" />
      </div>

      {workOrder.attachment_filename && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Archivo Actual</p>
          <p className="text-sm text-slate-700">{workOrder.attachment_filename}</p>
        </div>
      )}

      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
          {workOrder.attachment_filename ? 'Reemplazar Archivo' : 'Agregar Archivo'}
        </Label>
        {selectedFile ? (
          <div data-testid="edit-selected-file-display" className="flex items-center justify-between p-3 border border-slate-300 rounded-md bg-slate-50">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-700 truncate">{selectedFile.name}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{formatBytes(selectedFile.size)}</p>
            </div>
            <Button data-testid="edit-remove-file-button" type="button" variant="ghost" size="sm" onClick={() => setSelectedFile(null)} className="h-8 w-8 p-0 ml-2 hover:bg-slate-200">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              data-testid="edit-file-upload-input"
              id="file-edit"
              type="file"
              accept={ALLOWED_EXTENSIONS.join(',')}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const err = validateFile(file);
                if (err) { toast.error(err); e.target.value = ''; return; }
                setSelectedFile(file);
              }}
              className="h-10 rounded-md border-slate-300"
            />
            <Button type="button" variant="outline" className="h-10 px-4 rounded-md whitespace-nowrap" onClick={() => document.getElementById('file-edit').click()}>
              <Upload className="h-4 w-4 mr-2" />
              Elegir
            </Button>
          </div>
        )}
        <p className="text-xs text-slate-500 mt-1">Máx 10 MB · PDF, imágenes, Office, txt/csv/zip</p>
      </div>

      <div className="flex gap-3 pt-4 border-t border-slate-200">
        <Button data-testid="update-workorder-button" type="submit" disabled={isSubmitting} className="flex-1 bg-gradient-to-r from-[#0F62FE] to-[#0043CE] text-white h-11 rounded-md font-medium">
          {isSubmitting ? 'Actualizando...' : 'Actualizar OT'}
        </Button>
      </div>
    </form>
  );
}
