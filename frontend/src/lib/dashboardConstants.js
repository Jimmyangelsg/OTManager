// Stat card accent palettes — defined OUTSIDE component to avoid re-creating on each render
export const STAT_ACCENTS = {
  total: { border: 'border-slate-200', bg: 'bg-slate-100', text: 'text-slate-600' },
  pending: { border: 'border-amber-100', bg: 'bg-amber-50', text: 'text-amber-700' },
  in_progress: { border: 'border-blue-100', bg: 'bg-blue-50', text: 'text-blue-700' },
  completed: { border: 'border-emerald-100', bg: 'bg-emerald-50', text: 'text-emerald-700' },
};

// List of keyboard shortcut rows shown in the help dialog
export const SHORTCUT_HELP_ROWS = [
  { id: 'new', keys: ['N'], desc: 'Crear nueva OT' },
  { id: 'search', keys: ['/'], desc: 'Foco en el buscador' },
  { id: 'search-alt', keys: ['Ctrl', 'K'], desc: 'Foco en el buscador (alternativo)' },
  { id: 'escape', keys: ['Esc'], desc: 'Cerrar panel/ventana abierta' },
  { id: 'help', keys: ['?'], desc: 'Mostrar/ocultar esta ayuda' },
];
