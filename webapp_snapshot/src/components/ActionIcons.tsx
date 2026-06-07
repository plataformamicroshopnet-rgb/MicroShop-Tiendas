'use client'

// ──────────────────────────────────────────────────────────────────────────────
// ActionIcons.tsx — Iconos SVG para botones de acción (Excel, PDF, Impresora)
// ──────────────────────────────────────────────────────────────────────────────

interface IconProps {
  size?: number;
  className?: string;
}

/** Icono de Excel (hoja verde con X y cuadrícula) */
export function ExcelIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0 }}
    >
      <rect x="2" y="1" width="28" height="30" rx="3" fill="#1e7e45" />
      <rect x="16" y="5" width="12" height="22" rx="1" fill="#fff" opacity="0.15" />
      <line x1="22" y1="5" x2="22" y2="27" stroke="white" strokeWidth="0.7" opacity="0.4" />
      <line x1="16" y1="11" x2="28" y2="11" stroke="white" strokeWidth="0.7" opacity="0.4" />
      <line x1="16" y1="16" x2="28" y2="16" stroke="white" strokeWidth="0.7" opacity="0.4" />
      <line x1="16" y1="21" x2="28" y2="21" stroke="white" strokeWidth="0.7" opacity="0.4" />
      <text
        x="9"
        y="23"
        fontFamily="Arial, sans-serif"
        fontSize="19"
        fontWeight="900"
        fill="white"
        textAnchor="middle"
      >
        X
      </text>
    </svg>
  );
}

/** Icono de impresora (azul con papel) */
export function PrinterIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0 }}
    >
      <rect x="9" y="2" width="14" height="10" rx="1" fill="#dbeafe" stroke="#1e40af" strokeWidth="1.2" />
      <rect x="4" y="10" width="24" height="13" rx="2.5" fill="#3b82f6" stroke="#1e40af" strokeWidth="1.2" />
      <rect x="4" y="10" width="4" height="13" rx="2" fill="#2563eb" />
      <circle cx="24.5" cy="16.5" r="2" fill="#f87171" />
      <rect x="9" y="20" width="14" height="10" rx="1" fill="#dbeafe" stroke="#1e40af" strokeWidth="1.2" />
      <line x1="11" y1="24" x2="21" y2="24" stroke="#94a3b8" strokeWidth="1" />
      <line x1="11" y1="27" x2="21" y2="27" stroke="#94a3b8" strokeWidth="1" />
    </svg>
  );
}

/** Icono de PDF (hoja roja con texto PDF) */
export function PDFIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0 }}
    >
      <rect x="3" y="1" width="22" height="30" rx="3.5" fill="#e53e3e" />
      <path d="M25 1 L29 5 L25 5 Z" fill="#fc8181" />
      <text
        x="14"
        y="22"
        fontFamily="Arial, sans-serif"
        fontSize="10"
        fontWeight="900"
        fill="white"
        textAnchor="middle"
        letterSpacing="0.5"
      >
        PDF
      </text>
    </svg>
  );
}

/** Botón de Excel estándar reutilizable */
interface ExcelButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  label?: string;
  title?: string;
  size?: 'sm' | 'md';
}

export function ExcelButton({
  onClick,
  disabled = false,
  loading = false,
  loadingText = 'Generando...',
  label = 'Excel',
  title = 'Exportar a Excel',
  size = 'md',
}: ExcelButtonProps) {
  const padding = size === 'sm' ? '4px 10px' : '7px 14px';
  const fontSize = size === 'sm' ? 12 : 13;
  const iconSize = size === 'sm' ? 16 : 18;

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={disabled ? 'No tienes permisos para exportar' : title}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        background: '#107c41', border: 'none', color: 'white',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize, padding, borderRadius: 8, fontWeight: 700,
        opacity: disabled || loading ? 0.5 : 1,
        boxShadow: '0 2px 5px rgba(16,124,65,0.35)',
        transition: 'filter 0.2s',
        whiteSpace: 'nowrap',
      }}
      onMouseOver={e => { if (!disabled && !loading) e.currentTarget.style.filter = 'brightness(1.12)'; }}
      onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)'; }}
    >
      <ExcelIcon size={iconSize} />
      {loading ? loadingText : label}
    </button>
  );
}
