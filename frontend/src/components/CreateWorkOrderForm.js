import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, X } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const formSchema = z.object({
  ot_number: z.string().min(1, 'El número de OT es obligatorio'),
  requestor: z.string().optional(),
  task_detail: z.string().optional(),
  service_desk_number: z.string().optional(),
  observations: z.string().optional(),
});

export default function CreateWorkOrderForm({ onSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
  });

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);

    try {
      // Create work order
      const response = await axios.post(`${API}/workorders`, data);
      const workOrderId = response.data.id;

      // Upload file if selected
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        await axios.post(`${API}/workorders/${workOrderId}/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      toast.success('Orden de trabajo creada exitosamente');
      onSuccess();
    } catch (error) {
      console.error('Error creating work order:', error);
      toast.error('Error al crear la orden de trabajo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5" data-testid="create-workorder-form">
      <div>
        <Label htmlFor="ot_number" className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
          Número de OT *
        </Label>
        <Input
          data-testid="ot-number-input"
          id="ot_number"
          {...register('ot_number')}
          placeholder="Ej: OT-2024-001"
          className="h-9 rounded-sm border-slate-300 focus:ring-1 focus:ring-[#0F62FE]"
        />
        {errors.ot_number && (
          <p className="text-xs text-red-600 mt-1">{errors.ot_number.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="requestor" className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
          Solicitante
        </Label>
        <Input
          data-testid="requestor-input"
          id="requestor"
          {...register('requestor')}
          placeholder="Nombre del solicitante"
          className="h-9 rounded-sm border-slate-300 focus:ring-1 focus:ring-[#0F62FE]"
        />
      </div>

      <div>
        <Label htmlFor="task_detail" className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
          Detalle de la Tarea
        </Label>
        <Textarea
          data-testid="task-detail-input"
          id="task_detail"
          {...register('task_detail')}
          placeholder="Descripción detallada de la tarea..."
          rows={4}
          className="rounded-sm border-slate-300 focus:ring-1 focus:ring-[#0F62FE]"
        />
      </div>

      <div>
        <Label htmlFor="service_desk_number" className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
          Número de Service Desk
        </Label>
        <Input
          data-testid="service-desk-input"
          id="service_desk_number"
          {...register('service_desk_number')}
          placeholder="Ej: SD-12345"
          className="h-9 rounded-sm border-slate-300 focus:ring-1 focus:ring-[#0F62FE]"
        />
      </div>

      <div>
        <Label htmlFor="observations" className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
          Observaciones
        </Label>
        <Textarea
          data-testid="observations-input"
          id="observations"
          {...register('observations')}
          placeholder="Observaciones adicionales..."
          rows={3}
          className="rounded-sm border-slate-300 focus:ring-1 focus:ring-[#0F62FE]"
        />
      </div>

      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
          Archivo Adjunto
        </Label>
        {selectedFile ? (
          <div data-testid="selected-file-display" className="flex items-center justify-between p-3 border border-slate-300 rounded-sm bg-slate-50">
            <span className="text-sm text-slate-700 truncate flex-1">{selectedFile.name}</span>
            <Button
              data-testid="remove-file-button"
              type="button"
              variant="ghost"
              size="sm"
              onClick={removeFile}
              className="h-8 w-8 p-0 ml-2 hover:bg-slate-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              data-testid="file-upload-input"
              id="file"
              type="file"
              onChange={handleFileChange}
              className="h-9 rounded-sm border-slate-300"
            />
            <Button
              type="button"
              variant="outline"
              className="h-9 px-4 rounded-sm whitespace-nowrap"
              onClick={() => document.getElementById('file').click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Elegir
            </Button>
          </div>
        )}
        <p className="text-xs text-slate-500 mt-1">PDF, imágenes, documentos (opcional)</p>
      </div>

      <div className="flex gap-3 pt-4 border-t border-slate-200">
        <Button
          data-testid="submit-workorder-button"
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-[#0F62FE] hover:bg-[#0043CE] text-white h-10 px-4 rounded-sm font-medium"
        >
          {isSubmitting ? 'Creando...' : 'Crear Orden de Trabajo'}
        </Button>
      </div>
    </form>
  );
}
