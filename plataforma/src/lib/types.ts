/**
 * Modelo de dominio.
 *
 * Esto es lo que consume el sitio y el CRM. No contiene nada específico de
 * EasyBroker: la traducción ocurre en `lib/easybroker/mapper.ts`. Esa frontera
 * es la que permitirá apagar la integración sin reescribir la aplicación.
 */

export type OperationType = 'sale' | 'rental' | 'temporary_rental';

export interface Operation {
  type: OperationType;
  amount: number | null;
  currency: string;
  unit: 'total' | 'square_meter' | 'hectare';
  period?: 'monthly' | 'weekly' | 'daily' | null;
}

export interface PropertyImage {
  url: string;
  alt: string;
  position: number;
}

export interface Property {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  propertyType: string;
  status: string;

  bedrooms: number | null;
  bathrooms: number | null;
  halfBathrooms: number | null;
  parkingSpaces: number | null;
  constructionSize: number | null;
  lotSize: number | null;

  neighborhood: string | null;
  municipality: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  showExactLocation: boolean;

  operations: Operation[];
  images: PropertyImage[];
  features: string[];

  featured: boolean;
  externalId: string | null;
  updatedAt: string | null;
}

export interface Organization {
  id: string;
  slug: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  logoUrl: string | null;
}

export interface PropertyFilters {
  operation?: OperationType;
  propertyType?: string;
  municipality?: string;
  neighborhood?: string;
  minBedrooms?: number;
  minBathrooms?: number;
  /** Superficie mínima en m² (construcción, o terreno si no hay construcción). */
  minArea?: number;
  search?: string;
  /** Sin precio visible, no se ordena por precio. Ver lib/constants.ts. */
  sort?: 'recent' | 'area-desc' | 'bedrooms-desc';
  page?: number;
  perPage?: number;
}

export interface PropertyPage {
  items: Property[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// --- Helpers de dominio -----------------------------------------------------

export function primaryOperation(property: Property): Operation | null {
  return (
    property.operations.find((o) => o.type === 'sale') ??
    property.operations[0] ??
    null
  );
}

export function operationLabel(type: OperationType): string {
  switch (type) {
    case 'sale':
      return 'En venta';
    case 'rental':
      return 'En renta';
    case 'temporary_rental':
      return 'Renta temporal';
  }
}

/** Zona legible: "Del Valle Centro, Benito Juárez". */
export function zoneLabel(property: Property): string {
  return [property.neighborhood, property.municipality].filter(Boolean).join(', ');
}
