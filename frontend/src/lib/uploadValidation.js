// Frontend-side upload validation (must mirror backend rules)
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_EXTENSIONS = [
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.xlsx', '.docx', '.xls', '.doc', '.txt', '.csv', '.zip',
];

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function validateFile(file) {
  if (!file) return null;
  const name = file.name || '';
  const lower = name.toLowerCase();
  const ext = lower.substring(lower.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Tipo de archivo no permitido. Aceptados: ${ALLOWED_EXTENSIONS.join(', ')}`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Archivo demasiado grande (${formatBytes(file.size)}). Máximo 10 MB.`;
  }
  return null;
}
