/**
 * Frontera de traducción: modelo de EasyBroker → modelo nuestro.
 *
 * Todo lo que sea específico de EasyBroker muere aquí. El resto de la
 * aplicación no sabe que EasyBroker existe. Eso es lo que permitirá apagar la
 * integración en la Fase 3 sin tocar el sitio ni el CRM.
 *
 * De paso, aquí se corrigen por diseño varios defectos detectados en la
 * auditoría del sitio actual: slugs legibles, `alt` en todas las fotos y
 * desglose real de la ubicación (hoy viene como un string plano).
 */

import type { EBPropertyDetail, EBLocation, EBOperation } from './types';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Slug es-MX: sin acentos, sin ñ rota, sin dobles guiones. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90)
    .replace(/-$/, '');
}

/**
 * Slug único y estable. Se le añade el public_id como sufijo para que dos
 * propiedades con el mismo título no colisionen y para que el slug no cambie
 * si el asesor edita el título (cambiar URLs rompe el SEO ganado).
 */
export function buildSlug(title: string, publicId: string): string {
  const base = slugify(title) || 'propiedad';
  const suffix = slugify(publicId);
  return `${base}-${suffix}`;
}

const toNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// ---------------------------------------------------------------------------
// Ubicación
// ---------------------------------------------------------------------------

export interface NormalizedLocation {
  street: string | null;
  exterior_number: string | null;
  interior_number: string | null;
  neighborhood: string | null;
  municipality: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  show_exact_location: boolean;
}

/**
 * La API ha devuelto la ubicación de dos formas distintas según la versión
 * (ver changelog "Cambios en la forma que recibes la ubicación"). Aceptamos
 * ambas: string plano "Del Valle Centro, Benito Juárez, Ciudad de México"
 * u objeto estructurado.
 */
export function normalizeLocation(
  location: string | EBLocation | null | undefined,
): NormalizedLocation {
  const empty: NormalizedLocation = {
    street: null,
    exterior_number: null,
    interior_number: null,
    neighborhood: null,
    municipality: null,
    state: null,
    postal_code: null,
    latitude: null,
    longitude: null,
    show_exact_location: false,
  };

  if (!location) return empty;

  if (typeof location === 'string') {
    // "Colonia, Alcaldía, Estado" — se parsea de derecha a izquierda porque
    // el estado siempre va al final, pero la calle no siempre viene.
    const parts = location.split(',').map((p) => p.trim()).filter(Boolean);
    return {
      ...empty,
      neighborhood: parts[0] ?? null,
      municipality: parts[1] ?? null,
      state: parts[2] ?? null,
    };
  }

  const parts = (location.name ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  return {
    street: location.street ?? null,
    exterior_number: location.exterior_number ?? null,
    interior_number: location.interior_number ?? null,
    neighborhood: parts[0] ?? null,
    municipality: parts[1] ?? null,
    state: parts[2] ?? null,
    postal_code: location.postal_code ?? null,
    latitude: toNumber(location.latitude),
    longitude: toNumber(location.longitude),
    show_exact_location: Boolean(location.show_exact_location),
  };
}

// ---------------------------------------------------------------------------
// Texto alternativo de imágenes
// ---------------------------------------------------------------------------

/**
 * En el sitio actual, 41 de 53 fotos de una ficha no tienen `alt`.
 * Aquí se genera siempre, con contexto real para Google Imágenes
 * y para lectores de pantalla.
 */
export function buildImageAlt(
  propertyType: string,
  neighborhood: string | null,
  municipality: string | null,
  index: number,
  total: number,
  providedTitle?: string | null,
): string {
  if (providedTitle?.trim()) return providedTitle.trim();

  const zone = [neighborhood, municipality].filter(Boolean).join(', ');
  const base = zone ? `${propertyType} en ${zone}` : propertyType;
  return `${base} — foto ${index + 1} de ${total}`;
}

// ---------------------------------------------------------------------------
// Estados y operaciones
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<string, string> = {
  published: 'published',
  not_published: 'not_published',
  reserved: 'reserved',
  sold: 'sold',
  rented: 'rented',
  suspended: 'suspended',
  flagged: 'flagged',
  disapproved: 'disapproved',
};

export interface MappedOperation {
  type: string;
  amount: number | null;
  currency: string;
  unit: string;
  period: string | null;
  commission_type: string | null;
  commission_value: number | null;
}

export function mapOperations(operations: EBOperation[] = []): MappedOperation[] {
  return operations.map((op) => ({
    type: op.type,
    amount: toNumber(op.amount),
    currency: op.currency || 'MXN',
    unit: op.unit ?? 'total',
    period: op.period ?? null,
    commission_type: op.commission?.type ?? null,
    commission_value: toNumber(op.commission?.value),
  }));
}

// ---------------------------------------------------------------------------
// Propiedad completa
// ---------------------------------------------------------------------------

export interface MappedProperty {
  external_id: string;
  external_source: 'easybroker';
  slug: string;
  title: string;
  description: string | null;
  property_type: string;
  status: string;
  conservation_state: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  half_bathrooms: number | null;
  parking_spaces: number | null;
  construction_size: number | null;
  lot_size: number | null;
  floors: number | null;
  age: number | null;
  show_prices: boolean;
  share_commission: boolean;
  video_url: string | null;
  virtual_tour_url: string | null;
  external_updated_at: string | null;
  operations: MappedOperation[];
  images: Array<{ source_url: string; alt: string; position: number }>;
  features: string[];
}

export function mapProperty(
  eb: EBPropertyDetail,
): MappedProperty & NormalizedLocation {
  const location = normalizeLocation(eb.location);
  const images = eb.property_images ?? [];
  const propertyType = eb.property_type || 'Propiedad';

  return {
    external_id: eb.public_id,
    external_source: 'easybroker',
    slug: buildSlug(eb.title, eb.public_id),
    title: eb.title?.trim() || 'Propiedad sin título',
    description: eb.description?.trim() || null,
    property_type: propertyType,
    status: STATUS_MAP[eb.status ?? ''] ?? 'published',
    conservation_state: eb.conservation_state ?? null,

    bedrooms: toNumber(eb.bedrooms),
    bathrooms: toNumber(eb.bathrooms),
    half_bathrooms: toNumber(eb.half_bathrooms),
    parking_spaces: toNumber(eb.parking_spaces),
    construction_size: toNumber(eb.construction_size),
    lot_size: toNumber(eb.lot_size),
    floors: toNumber(eb.floors),
    age: toNumber(eb.age),

    show_prices: eb.show_prices ?? true,
    share_commission: eb.share_commission ?? false,

    video_url: eb.video_url ?? null,
    virtual_tour_url: eb.virtual_tour ?? null,
    external_updated_at: eb.updated_at ?? null,

    ...location,

    operations: mapOperations(eb.operations),

    images: images.map((img, i) => ({
      source_url: img.url,
      alt: buildImageAlt(
        propertyType,
        location.neighborhood,
        location.municipality,
        i,
        images.length,
        img.title,
      ),
      position: img.position ?? i,
    })),

    features: eb.features ?? [],
  };
}
