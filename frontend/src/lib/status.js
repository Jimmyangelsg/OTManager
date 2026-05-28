// Status helpers used across the app
export const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente', shortLabel: 'Pendiente',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500' },
  { value: 'in_progress', label: 'En curso', shortLabel: 'En curso',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    dot: 'bg-blue-500' },
  { value: 'completed', label: 'Completada', shortLabel: 'Completada',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500' },
];

export function getStatusMeta(status) {
  return STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
}
