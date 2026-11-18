import Link from 'next/link';
import type { Metadata } from 'next';
import { getCurrentOrganization, getSiteUrl } from '@/lib/site';
import { listProperties, listMunicipalities } from '@/lib/repositories/properties';
import { PropertyCard } from '@/components/PropertyCard';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/seo/jsonld';
import { PROPERTY_TYPES, SORT_OPTIONS } from '@/lib/constants';
import type { OperationType, PropertyFilters } from '@/lib/types';

export const revalidate = 900;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseFilters(params: Record<string, string | string[] | undefined>): PropertyFilters {
  const one = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const num = (key: string) => {
    const v = Number(one(key));
    return Number.isFinite(v) && v > 0 ? v : undefined;
  };

  const operation = one('operacion');
  const sort = one('orden');

  return {
    operation:
      operation === 'sale' || operation === 'rental' || operation === 'temporary_rental'
        ? (operation as OperationType)
        : undefined,
    propertyType: one('tipo') || undefined,
    municipality: one('alcaldia') || undefined,
    // Sin filtros de precio: el portal no muestra precios (lib/display.ts).
    minBedrooms: num('recamaras'),
    minBathrooms: num('banos'),
    minArea: num('superficie'),
    search: one('q') || undefined,
    sort: sort === 'area-desc' || sort === 'bedrooms-desc' ? sort : 'recent',
    page: num('pagina') ?? 1,
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const filters = parseFilters(await searchParams);
  const isRental = filters.operation === 'rental';
  const action = isRental ? 'Renta' : 'Venta';

  const title = filters.propertyType
    ? `${action} de ${filters.propertyType.toLowerCase()}s en la CDMX`
    : `${action} de casas y departamentos en la CDMX`;

  // Cualquier combinación de filtros queda fuera del índice y el canonical
  // apunta a la página limpia: así no se generan miles de duplicados.
  const isFiltered = Boolean(
    filters.propertyType || filters.municipality || filters.minBedrooms ||
    filters.minBathrooms || filters.minArea || filters.search ||
    (filters.page ?? 1) > 1,
  );

  return {
    title,
    description:
      'Explora el inventario completo de propiedades en venta y renta en la ' +
      'Ciudad de México. Filtra por zona, tipo, precio y número de recámaras.',
    alternates: { canonical: '/propiedades' },
    robots: isFiltered ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);

  const org = await getCurrentOrganization();
  const siteUrl = await getSiteUrl();

  const [result, municipalities] = await Promise.all([
    listProperties(org.id, filters),
    listMunicipalities(org.id),
  ]);

  const heading =
    filters.operation === 'rental'
      ? 'Casas y departamentos en renta en la CDMX'
      : 'Casas y departamentos en venta en la CDMX';

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Inicio', url: siteUrl },
          { name: 'Propiedades', url: `${siteUrl}/propiedades` },
        ])}
      />
      <JsonLd data={itemListJsonLd(result.items, siteUrl)} />

      <div className="mx-auto max-w-6xl px-4 py-10">
        <nav aria-label="Ruta de navegación" className="text-sm text-slate-500">
          <Link href="/" className="hover:underline">Inicio</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700">Propiedades</span>
        </nav>

        <h1 className="mt-3 text-3xl font-bold text-slate-900">{heading}</h1>
        <p className="mt-2 text-slate-600">
          {result.total === 0
            ? 'No encontramos propiedades con esos criterios.'
            : `${result.total} ${result.total === 1 ? 'propiedad disponible' : 'propiedades disponibles'}.`}
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
          <FilterPanel municipalities={municipalities} filters={filters} />

          <div>
            {result.items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-12 text-center">
                <p className="text-slate-600">
                  Ajusta los filtros o{' '}
                  <Link href="/propiedades" className="font-medium text-[#e8622c] hover:underline">
                    ve todas las propiedades
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {result.items.map((property, i) => (
                    <PropertyCard key={property.id} property={property} priority={i < 3} />
                  ))}
                </div>

                <Pagination
                  page={result.page}
                  totalPages={result.totalPages}
                  params={params}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function FilterPanel({
  municipalities,
  filters,
}: {
  municipalities: Array<{ name: string; slug: string; count: number }>;
  filters: PropertyFilters;
}) {
  return (
    <aside>
      {/* GET, sin JavaScript: URLs compartibles y funciona si el JS falla. */}
      <form method="get" action="/propiedades" className="space-y-5 rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
          Filtros
        </h2>

        <Field label="Operación" htmlFor="f-operacion">
          <select id="f-operacion" name="operacion" defaultValue={filters.operation ?? ''} className={selectClass}>
            <option value="">Venta y renta</option>
            <option value="sale">En venta</option>
            <option value="rental">En renta</option>
          </select>
        </Field>

        <Field label="Tipo" htmlFor="f-tipo">
          <select id="f-tipo" name="tipo" defaultValue={filters.propertyType ?? ''} className={selectClass}>
            <option value="">Todos</option>
            {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>

        <Field label="Zona" htmlFor="f-alcaldia">
          <select id="f-alcaldia" name="alcaldia" defaultValue={filters.municipality ?? ''} className={selectClass}>
            <option value="">Toda la CDMX</option>
            {municipalities.map((m) => (
              <option key={m.slug} value={m.slug}>{m.name} ({m.count})</option>
            ))}
          </select>
        </Field>

        <Field label="Recámaras (mínimo)" htmlFor="f-recamaras">
          <select id="f-recamaras" name="recamaras" defaultValue={filters.minBedrooms ?? ''} className={selectClass}>
            <option value="">Cualquiera</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+</option>)}
          </select>
        </Field>

        <Field label="Baños (mínimo)" htmlFor="f-banos">
          <select id="f-banos" name="banos" defaultValue={filters.minBathrooms ?? ''} className={selectClass}>
            <option value="">Cualquiera</option>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}+</option>)}
          </select>
        </Field>

        {/* Superficie sustituye al filtro de precio como criterio cuantitativo. */}
        <Field label="Superficie mínima (m²)" htmlFor="f-superficie">
          <input id="f-superficie" name="superficie" type="number" min="0" step="10"
            defaultValue={filters.minArea ?? ''} placeholder="Cualquiera" className={inputClass} />
        </Field>

        <Field label="Ordenar por" htmlFor="f-orden">
          <select id="f-orden" name="orden" defaultValue={filters.sort ?? 'recent'} className={selectClass}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>

        <div className="flex gap-2 pt-1">
          <button type="submit" className="flex-1 rounded-lg bg-[#0b2a5b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a2550]">
            Aplicar
          </button>
          <Link href="/propiedades" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Limpiar
          </Link>
        </div>
      </form>
    </aside>
  );
}

const selectClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0b2a5b] focus:outline-none focus:ring-2 focus:ring-[#0b2a5b]/20';
const inputClass = selectClass;

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-slate-600">
        {label}
      </label>
      {children}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: Record<string, string | string[] | undefined>;
}) {
  if (totalPages <= 1) return null;

  const buildUrl = (target: number) => {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === 'pagina' || value === undefined) continue;
      sp.set(key, Array.isArray(value) ? value[0] : value);
    }
    if (target > 1) sp.set('pagina', String(target));
    const qs = sp.toString();
    return `/propiedades${qs ? `?${qs}` : ''}`;
  };

  return (
    <nav aria-label="Paginación" className="mt-10 flex items-center justify-center gap-2">
      {page > 1 && (
        <Link href={buildUrl(page - 1)} rel="prev" className={pageLinkClass}>
          Anterior
        </Link>
      )}
      <span className="px-3 text-sm text-slate-600">
        Página {page} de {totalPages}
      </span>
      {page < totalPages && (
        <Link href={buildUrl(page + 1)} rel="next" className={pageLinkClass}>
          Siguiente
        </Link>
      )}
    </nav>
  );
}

const pageLinkClass =
  'rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50';
