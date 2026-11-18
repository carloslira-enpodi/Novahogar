/**
 * Acceso a propiedades para el sitio público.
 *
 * Lee de Supabase cuando está configurado; si no, usa el inventario de
 * demostración. Esa doble vía permite diseñar el sitio sin esperar a la base y
 * desaparece sola en cuanto existan las variables de entorno.
 *
 * El `organizationId` es obligatorio en toda consulta. No hay sobrecarga que
 * lo omita, a propósito: en un sistema multi-inquilino, una consulta sin
 * filtro de organización es una fuga de datos.
 */

import { getServiceClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { DEMO_ORGANIZATION, DEMO_PROPERTIES } from '@/lib/demo-data';
import { toSlug } from '@/lib/format';
import type {
  Organization,
  Property,
  PropertyFilters,
  PropertyPage,
} from '@/lib/types';

const DEFAULT_PER_PAGE = 12;

// ---------------------------------------------------------------------------
// Organización
// ---------------------------------------------------------------------------

export async function getOrganizationByDomain(
  domain: string,
): Promise<Organization | null> {
  if (!isSupabaseConfigured()) return DEMO_ORGANIZATION;

  const supabase = getServiceClient();
  const { data } = await supabase
    .from('sites')
    .select('organizations(id, slug, name, phone, whatsapp, email, address, logo_url)')
    .eq('domain', domain)
    .eq('published', true)
    .maybeSingle();

  const org = data?.organizations as Record<string, unknown> | undefined;
  if (!org) return null;

  return {
    id: org.id as string,
    slug: org.slug as string,
    name: org.name as string,
    phone: (org.phone as string) ?? null,
    whatsapp: (org.whatsapp as string) ?? null,
    email: (org.email as string) ?? null,
    address: (org.address as string) ?? null,
    logoUrl: (org.logo_url as string) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export async function listProperties(
  organizationId: string,
  filters: PropertyFilters = {},
): Promise<PropertyPage> {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? DEFAULT_PER_PAGE;

  if (!isSupabaseConfigured()) {
    return paginate(applyFilters(DEMO_PROPERTIES, filters), page, perPage);
  }

  const supabase = getServiceClient();
  let query = supabase
    .from('properties')
    .select(PROPERTY_SELECT, { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('status', 'published');

  if (filters.propertyType) query = query.eq('property_type', filters.propertyType);
  if (filters.municipality) query = query.eq('municipality', filters.municipality);
  if (filters.neighborhood) query = query.eq('neighborhood', filters.neighborhood);
  if (filters.minBedrooms) query = query.gte('bedrooms', filters.minBedrooms);
  if (filters.minBathrooms) query = query.gte('bathrooms', filters.minBathrooms);
  if (filters.minArea) query = query.gte('construction_size', filters.minArea);
  if (filters.search) {
    query = query.textSearch('title', filters.search, {
      type: 'websearch',
      config: 'spanish',
    });
  }

  const from = (page - 1) * perPage;
  const { data, count } = await query
    .order('featured', { ascending: false })
    .order('published_at', { ascending: false })
    .range(from, from + perPage - 1);

  // El filtro por operación y precio vive en property_operations (1:N), así que
  // se aplica en memoria sobre la página ya traída. Si el inventario crece,
  // esto se mueve a una vista materializada con el precio desnormalizado.
  let items = (data ?? []).map(mapRow);
  items = applyOperationFilters(items, filters);
  items = sortProperties(items, filters.sort);

  const total = count ?? items.length;
  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getPropertyBySlug(
  organizationId: string,
  slug: string,
): Promise<Property | null> {
  if (!isSupabaseConfigured()) {
    return DEMO_PROPERTIES.find((p) => p.slug === slug) ?? null;
  }

  const supabase = getServiceClient();
  const { data } = await supabase
    .from('properties')
    .select(PROPERTY_SELECT)
    .eq('organization_id', organizationId)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  return data ? mapRow(data) : null;
}

export async function getFeaturedProperties(
  organizationId: string,
  limit = 9,
): Promise<Property[]> {
  const { items } = await listProperties(organizationId, { perPage: limit, page: 1 });
  return items;
}

/** Alcaldías con inventario publicado — alimenta las landings de zona. */
export async function listMunicipalities(
  organizationId: string,
): Promise<Array<{ name: string; slug: string; count: number }>> {
  const source = isSupabaseConfigured()
    ? (await listProperties(organizationId, { perPage: 500 })).items
    : DEMO_PROPERTIES;

  const counts = new Map<string, number>();
  for (const p of source) {
    if (!p.municipality) continue;
    counts.set(p.municipality, (counts.get(p.municipality) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, slug: toSlug(name), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'));
}

export async function listAllSlugs(organizationId: string): Promise<string[]> {
  if (!isSupabaseConfigured()) return DEMO_PROPERTIES.map((p) => p.slug);

  const supabase = getServiceClient();
  const { data } = await supabase
    .from('properties')
    .select('slug')
    .eq('organization_id', organizationId)
    .eq('status', 'published');

  return (data ?? []).map((row) => row.slug as string);
}

// ---------------------------------------------------------------------------
// Filtrado en memoria (modo demo y filtros sobre relaciones)
// ---------------------------------------------------------------------------

function applyFilters(source: Property[], filters: PropertyFilters): Property[] {
  let items = source.filter((p) => p.status === 'published');

  if (filters.propertyType) {
    items = items.filter((p) => p.propertyType === filters.propertyType);
  }
  if (filters.municipality) {
    items = items.filter((p) => toSlug(p.municipality ?? '') === toSlug(filters.municipality!));
  }
  if (filters.neighborhood) {
    items = items.filter((p) => toSlug(p.neighborhood ?? '') === toSlug(filters.neighborhood!));
  }
  if (filters.minBedrooms) {
    items = items.filter((p) => (p.bedrooms ?? 0) >= filters.minBedrooms!);
  }
  if (filters.minBathrooms) {
    items = items.filter((p) => (p.bathrooms ?? 0) >= filters.minBathrooms!);
  }
  if (filters.minArea) {
    items = items.filter((p) => areaOf(p) >= filters.minArea!);
  }
  if (filters.search) {
    const needle = toSlug(filters.search);
    items = items.filter((p) =>
      toSlug(`${p.title} ${p.neighborhood ?? ''} ${p.municipality ?? ''}`).includes(needle),
    );
  }

  return sortProperties(applyOperationFilters(items, filters), filters.sort);
}

/**
 * Filtro por tipo de operación.
 *
 * Ya no filtra por precio: el portal no los muestra, y ofrecer un filtro de
 * precio permitiría deducir por acotamiento lo que se decidió ocultar.
 */
function applyOperationFilters(items: Property[], filters: PropertyFilters): Property[] {
  if (!filters.operation) return items;
  return items.filter((p) => p.operations.some((op) => op.type === filters.operation));
}

function areaOf(p: Property): number {
  return p.constructionSize ?? p.lotSize ?? 0;
}

function sortProperties(items: Property[], sort: PropertyFilters['sort']): Property[] {
  const sorted = [...items];
  switch (sort) {
    case 'area-desc':
      return sorted.sort((a, b) => areaOf(b) - areaOf(a));
    case 'bedrooms-desc':
      return sorted.sort((a, b) => (b.bedrooms ?? 0) - (a.bedrooms ?? 0));
    default:
      return sorted.sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
      });
  }
}

function paginate(items: Property[], page: number, perPage: number): PropertyPage {
  const total = items.length;
  const start = (page - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

// ---------------------------------------------------------------------------
// Mapeo de filas
// ---------------------------------------------------------------------------

const PROPERTY_SELECT = `
  id, slug, title, description, property_type, status,
  bedrooms, bathrooms, half_bathrooms, parking_spaces,
  construction_size, lot_size,
  neighborhood, municipality, state, latitude, longitude, show_exact_location,
  featured, external_id, updated_at,
  property_operations (type, amount, currency, unit, period),
  property_images (storage_path, source_url, alt, position),
  property_features (name)
`;

type Row = Record<string, unknown>;

function mapRow(row: Row): Property {
  const images = ((row.property_images as Row[]) ?? [])
    .slice()
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map((img) => ({
      // Se prefiere SIEMPRE nuestra copia en Storage sobre el origen externo.
      url: img.storage_path
        ? publicStorageUrl(img.storage_path as string)
        : ((img.source_url as string) ?? ''),
      alt: (img.alt as string) ?? '',
      position: Number(img.position ?? 0),
    }))
    .filter((img) => img.url);

  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    propertyType: (row.property_type as string) ?? 'Propiedad',
    status: (row.status as string) ?? 'published',
    bedrooms: numberOrNull(row.bedrooms),
    bathrooms: numberOrNull(row.bathrooms),
    halfBathrooms: numberOrNull(row.half_bathrooms),
    parkingSpaces: numberOrNull(row.parking_spaces),
    constructionSize: numberOrNull(row.construction_size),
    lotSize: numberOrNull(row.lot_size),
    neighborhood: (row.neighborhood as string) ?? null,
    municipality: (row.municipality as string) ?? null,
    state: (row.state as string) ?? null,
    latitude: numberOrNull(row.latitude),
    longitude: numberOrNull(row.longitude),
    showExactLocation: Boolean(row.show_exact_location),
    operations: ((row.property_operations as Row[]) ?? []).map((op) => ({
      type: op.type as Property['operations'][number]['type'],
      amount: numberOrNull(op.amount),
      currency: (op.currency as string) ?? 'MXN',
      unit: (op.unit as 'total' | 'square_meter' | 'hectare') ?? 'total',
      period: (op.period as 'monthly' | 'weekly' | 'daily' | null) ?? null,
    })),
    images,
    features: ((row.property_features as Row[]) ?? []).map((f) => f.name as string),
    featured: Boolean(row.featured),
    externalId: (row.external_id as string) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
  };
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function publicStorageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/public/property-images/${path}`;
}
