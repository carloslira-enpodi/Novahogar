/**
 * Tipos de la API de EasyBroker (v1).
 * Derivados de la definición OpenAPI en https://dev.easybroker.com/llms.txt
 *
 * Estos tipos describen datos EXTERNOS. No se usan en nuestra base de datos:
 * se mapean a nuestro modelo en `mapper.ts`. Esa frontera es deliberada —
 * es lo que permite cortar con EasyBroker sin reescribir la aplicación.
 */

export type EBPropertyStatus =
  | 'published'
  | 'not_published'
  | 'reserved'
  | 'sold'
  | 'rented'
  | 'suspended'
  | 'flagged'
  | 'disapproved';

export type EBOperationType = 'sale' | 'rental' | 'temporary_rental';
export type EBPriceUnit = 'total' | 'square_meter' | 'hectare';
export type EBCommissionType = 'percentage' | 'months' | 'amount';
export type EBRentalPeriod = 'monthly' | 'weekly' | 'daily';

export interface EBCommission {
  type: EBCommissionType;
  value: number;
  currency: string;
}

export interface EBOperation {
  type: EBOperationType;
  amount?: number;
  formatted_amount?: string;
  currency: string;
  unit?: EBPriceUnit;
  period?: EBRentalPeriod;
  commission?: EBCommission;
}

/** Propiedad tal como viene en `GET /properties` (versión resumida). */
export interface EBPropertyListItem {
  public_id: string;
  title: string;
  title_image_full: string | null;
  title_image_thumb: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  lot_size: number | null;
  construction_size: number | null;
  location: string;
  property_type: string;
  agent: string | null;
  show_prices: boolean;
  share_commission: boolean;
  operations: EBOperation[];
  updated_at: string;
}

export interface EBImage {
  url: string;
  title?: string | null;
  position?: number;
}

export interface EBLocation {
  name?: string;
  street?: string;
  exterior_number?: string;
  interior_number?: string;
  cross_street?: string;
  postal_code?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  show_exact_location?: boolean;
}

/**
 * Propiedad tal como viene en `GET /properties/{id}` (versión completa).
 * Ojo: la API ha cambiado la forma de `location` entre versiones —
 * ver changelog "Propiedades: Cambios en la forma que recibes la ubicación".
 * Por eso aquí se acepta string u objeto y se normaliza en el mapper.
 */
export interface EBPropertyDetail extends Omit<EBPropertyListItem, 'location'> {
  description: string | null;
  location: string | EBLocation;
  property_images: EBImage[];
  features?: string[];
  half_bathrooms?: number | null;
  floors?: number | null;
  age?: number | string | null;
  conservation_state?: string | null;
  status?: EBPropertyStatus;
  video_url?: string | null;
  virtual_tour?: string | null;
  internal_id?: string | null;
  created_at?: string;
}

export interface EBPagination {
  limit: number;
  page: number;
  total: number;
  next_page: string | null;
}

export interface EBPaginated<T> {
  pagination: EBPagination;
  content: T[];
}

export interface EBContactRequest {
  id?: string | number;
  name: string;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  property_id?: string | null;
  source?: string | null;
  created_at?: string;
}

/** Payload de `POST /contact_requests` — nuestro sitio inyecta leads a su buzón. */
export interface EBContactRequestPayload {
  name: string;
  property_id: string;
  source: string;
  email?: string;
  phone?: string;
  message?: string;
}

export interface EBPropertySearchParams {
  updated_after?: string;
  updated_before?: string;
  operation_type?: EBOperationType;
  min_price?: number;
  max_price?: number;
  min_bedrooms?: number;
  min_bathrooms?: number;
  min_parking_spaces?: number;
  min_construction_size?: number;
  max_construction_size?: number;
  min_lot_size?: number;
  max_lot_size?: number;
  statuses?: EBPropertyStatus[];
  sort_by?: 'updated_at-asc' | 'updated_at-desc';
}
