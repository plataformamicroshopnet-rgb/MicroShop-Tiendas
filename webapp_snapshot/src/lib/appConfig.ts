/**
 * Configuración centralizada de constantes de la aplicación.
 * 
 * Este archivo sirve como única fuente de verdad para roles, estados,
 * perfiles y catálogos de la aplicación para evitar errores de tipeo o 
 * inconsistencias ("magic strings") a lo largo del código.
 */

// Roles de Usuario
export const ROLES = {
  ADMIN: 'ADMIN',
  JEFE_VENTAS: 'JEFE DE VENTAS',
  COMERCIAL: 'COMERCIAL',
  BACK_OFFICE: 'BACK OFFICE'
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

// Estados de Pendiente
export const ESTADOS_PENDIENTE = {
  SI: 'Si',
  NO: 'No',
  ANULADO: 'Anulado'
} as const;

// Estados de Operación
export const ESTADOS_OPERACION = {
  PENDIENTE: 'Pendiente'
} as const;

// Perfiles de Comisión/Objetivo
export const PERFILES = {
  PYME: 'Pyme',
  CAPTADOR: 'Captador'
} as const;

// Grupos Principales de Producto (Palancas)
export const GRUPOS_PRODUCTO = {
  FD: 'FD',
  PF: 'PF',
  FN: 'FN',
  BAF: 'BAF',
  REN: 'REN',
  MBAF: 'MBAF',
  ALTA: 'ALTA',
  PORTA: 'PORTA',
  TMA: 'TMA',
  TI: 'TI',
  MIC: 'MIC',
  MPA: 'MPA'
} as const;

// Tipos de operaciones técnicas que se excluyen del cálculo dinámico normal
export const PRODUCTOS_TECNICOS = {
  TI: 'Ti',
  TMA: 'TMA',
  MICRO: 'Micro'
} as const;

/**
 * Normaliza subdivisiones de roles puros y estrictos basándose en el prefijo.
 * Ej: 'COMERCIAL PYME', 'COMERCIAL CAPTADOR', 'COMERCIAL_CUALQUIERA' -> 'COMERCIAL'
 */
export function normalizeRole(rawRole: string | undefined | null): string {
  if (!rawRole) return '';
  const upper = rawRole.trim().toUpperCase();
  
  // Tolerancia amplia para cualquier cosa que empiece por COMERCIAL
  if (upper.startsWith('COMERCIAL')) {
    return 'COMERCIAL';
  }
  
  // Devuelve roles absolutos tal cual ('ADMIN', 'JEFE DE VENTAS', etc)
  return upper;
}

/**
 * Traduce el código comercial interno (Prisma) a la nomenclatura
 * corporativa de Telefónica (GEVICO) que usan los excels de Cumplimiento.
 * Ej: "Plus NFG" -> "FV1WFNFG"
 */
export function getFFVVCode(codigoComercial: string | undefined, validCodes?: string[]): string {
  if (!codigoComercial) return '';
  
  // Si ya tiene el formato GEVICO nativo, pasa directo
  if (codigoComercial.startsWith('FV')) return codigoComercial;

  // 1. Diccionario Fuerte Centralizado (Mapeos conocidos y correcciones de tipografía)
  const map: Record<string, string> = {
      'Plus NFG': 'FV1WFNFG',
      'Básico XCU': 'FV1WFXCU',
      'Plus XCU': 'FV1WFXCU',
      'Plus K2Z': 'FV1WFK2Z',
      'Plus ZF7': 'FV1WFZF7',
      'Plus N7D': 'FV1WFN7D',
      'Plus 1KS': 'FV1WF1SK', // El typo cruzado persistente
      'Plus 1SK': 'FV1WF1SK', 
  };
  
  let result = codigoComercial;

  if (map[codigoComercial]) {
      result = map[codigoComercial];
  } else {
      // 2. Fallback Dinámico (Toma la última palabra del string y le añade el prefijo corporativo)
      const parts = codigoComercial.split(' ');
      if (parts.length > 1) {
          const suffix = parts[parts.length - 1];
          result = `FV1WF${suffix}`;
          
          if (validCodes && validCodes.length > 0 && !validCodes.includes(result)) {
              console.warn(`[Identity] Fallback dinámico generó '${result}' desde '${codigoComercial}', pero no existe en los códigos activos de GEVICO.`);
          }
      }
  }

  return result;
}
