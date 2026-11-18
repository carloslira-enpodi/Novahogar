export const PROPERTY_TYPES = [
  'Casa',
  'Casa en condominio',
  'Departamento',
  'Terreno',
  'Bodega comercial',
  'Local comercial',
  'Oficina',
] as const;

export const OPERATION_PARAM = {
  sale: 'sale',
  rental: 'rental',
  temporary_rental: 'temporary_rental',
} as const;

/**
 * Orden del listado.
 *
 * Sin precio visible, ordenar por precio no tiene sentido: expondría
 * indirectamente lo que el portal decidió no mostrar. Se ordena por lo que el
 * visitante sí puede ver.
 */
export const SORT_OPTIONS = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'area-desc', label: 'Mayor superficie' },
  { value: 'bedrooms-desc', label: 'Más recámaras' },
] as const;
