import Image from 'next/image';
import Link from 'next/link';
import { formatArea, pluralize } from '@/lib/format';
import { PRICE_CTA } from '@/lib/display';
import { operationLabel, primaryOperation, zoneLabel, type Property } from '@/lib/types';

/**
 * Tarjeta de propiedad.
 *
 * Sin precio por decisión de producto (ver lib/display.ts). El peso visual se
 * reparte entre la fotografía y los atributos del inmueble, que es lo que
 * realmente distingue una propiedad de otra cuando no hay cifra que comparar.
 */
export function PropertyCard({
  property,
  priority = false,
  featured = false,
}: {
  property: Property;
  priority?: boolean;
  featured?: boolean;
}) {
  const operation = primaryOperation(property);
  const cover = property.images[0];
  const zone = zoneLabel(property);

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-slate-300 ${
        featured ? 'sm:col-span-2' : ''
      }`}
    >
      <Link href={`/propiedades/${property.slug}`} className="block">
        <div
          className={`relative overflow-hidden bg-slate-100 ${
            featured ? 'aspect-[16/9]' : 'aspect-[4/3]'
          }`}
        >
          {cover ? (
            <Image
              src={cover.url}
              alt={cover.alt}
              fill
              sizes={
                featured
                  ? '(max-width: 640px) 100vw, 66vw'
                  : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
              }
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              priority={priority}
              loading={priority ? undefined : 'lazy'}
              unoptimized={cover.url.startsWith('data:')}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Sin fotografía
            </div>
          )}

          {/* Degradado para que el texto sobre la foto siempre tenga contraste. */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent"
          />

          {operation && (
            <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#0b2a5b] backdrop-blur">
              {operationLabel(operation.type)}
            </span>
          )}

          {property.images.length > 1 && (
            <span className="absolute right-4 top-4 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
              {property.images.length} fotos
            </span>
          )}

          <div className="absolute inset-x-0 bottom-0 p-4">
            <h3
              className={`font-semibold leading-snug text-white drop-shadow-sm ${
                featured ? 'text-xl line-clamp-2' : 'text-base line-clamp-2'
              }`}
            >
              {property.title}
            </h3>
            {zone && (
              <p className="mt-1 text-sm text-white/85">{zone}</p>
            )}
          </div>
        </div>

        <div className="p-4">
          <SpecStrip property={property} />

          <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#e8622c]">
            {PRICE_CTA}
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </p>
        </div>
      </Link>
    </article>
  );
}

/**
 * Atributos del inmueble. Sin precio, esta franja es el principal criterio de
 * comparación entre tarjetas, así que se muestra siempre que haya datos.
 */
function SpecStrip({ property }: { property: Property }) {
  const specs: Array<{ icon: string; label: string }> = [];

  if (property.bedrooms) {
    specs.push({ icon: '🛏', label: pluralize(property.bedrooms, 'recámara', 'recámaras') });
  }
  if (property.bathrooms) {
    specs.push({ icon: '🛁', label: pluralize(property.bathrooms, 'baño', 'baños') });
  }
  if (property.parkingSpaces) {
    specs.push({ icon: '🚗', label: String(property.parkingSpaces) });
  }

  const area = formatArea(property.constructionSize) ?? formatArea(property.lotSize);
  if (area) specs.push({ icon: '📐', label: area });

  if (specs.length === 0) {
    return <p className="text-sm text-slate-500">{property.propertyType}</p>;
  }

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-600">
      {specs.map((spec) => (
        <li key={spec.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="text-xs opacity-60">{spec.icon}</span>
          {spec.label}
        </li>
      ))}
    </ul>
  );
}
