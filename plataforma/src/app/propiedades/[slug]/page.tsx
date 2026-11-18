import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentOrganization, getSiteUrl, whatsappLink } from '@/lib/site';
import {
  getPropertyBySlug,
  listProperties,
} from '@/lib/repositories/properties';
import { JsonLd } from '@/components/JsonLd';
import { PropertyCard } from '@/components/PropertyCard';
import { ContactForm } from '@/components/ContactForm';
import { breadcrumbJsonLd, propertyJsonLd } from '@/lib/seo/jsonld';
import { formatArea, truncate } from '@/lib/format';
import { PRICE_PLACEHOLDER } from '@/lib/display';
import { operationLabel, primaryOperation, zoneLabel } from '@/lib/types';

export const revalidate = 900;

/*
 * SIN generateStaticParams, a propósito.
 *
 * El inquilino se resuelve por dominio con `headers()`, que solo existe
 * durante una petición. `generateStaticParams` corre en el build, donde no
 * hay petición: la combinación produce DYNAMIC_SERVER_USAGE y la ruta
 * devuelve 500.
 *
 * La multi-inquilinía por host es incompatible con la generación estática en
 * build. Para recuperar el prerenderizado habría que fijar el inquilino en
 * build mediante una variable de entorno, cuando un despliegue sirva a una
 * sola inmobiliaria. Mientras tanto, estas rutas se renderizan por petición
 * igual que el home y el listado, que funcionan así.
 */

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const org = await getCurrentOrganization();
  const property = await getPropertyBySlug(org.id, slug);

  if (!property) return { title: 'Propiedad no encontrada' };

  const operation = primaryOperation(property);
  const zone = zoneLabel(property);

  // La meta description no menciona precio: el portal no lo publica.
  const description = property.description
    ? truncate(property.description, 155)
    : `${property.propertyType} ${operationLabel(operation?.type ?? 'sale').toLowerCase()} en ${zone}. Consulta disponibilidad con un asesor.`;

  return {
    // El título lleva marca por el template del layout: el sitio actual no.
    title: property.title,
    description,
    alternates: { canonical: `/propiedades/${property.slug}` },
    openGraph: {
      type: 'website',
      title: property.title,
      description,
      images: property.images.slice(0, 4).map((img) => ({ url: img.url, alt: img.alt })),
    },
  };
}

export default async function PropertyPage({ params }: { params: Params }) {
  const { slug } = await params;
  const org = await getCurrentOrganization();
  const property = await getPropertyBySlug(org.id, slug);

  if (!property) notFound();

  const siteUrl = await getSiteUrl();
  const url = `${siteUrl}/propiedades/${property.slug}`;
  const operation = primaryOperation(property);
  const zone = zoneLabel(property);
  const wa = whatsappLink(org.whatsapp, { title: property.title, url });

  const related = property.municipality
    ? (await listProperties(org.id, { municipality: property.municipality, perPage: 4 }))
        .items.filter((p) => p.id !== property.id).slice(0, 3)
    : [];

  const specs = [
    property.bedrooms && { label: 'Recámaras', value: String(property.bedrooms) },
    property.bathrooms && { label: 'Baños', value: String(property.bathrooms) },
    property.parkingSpaces && { label: 'Estacionamientos', value: String(property.parkingSpaces) },
    property.constructionSize && { label: 'Construcción', value: formatArea(property.constructionSize)! },
    property.lotSize && { label: 'Terreno', value: formatArea(property.lotSize)! },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <>
      {/* Datos estructurados: el sitio actual no tiene ninguno. */}
      <JsonLd data={propertyJsonLd(property, org, siteUrl)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Inicio', url: siteUrl },
          { name: 'Propiedades', url: `${siteUrl}/propiedades` },
          { name: property.title, url },
        ])}
      />

      <article className="mx-auto max-w-6xl px-4 py-8">
        <nav aria-label="Ruta de navegación" className="text-sm text-slate-500">
          <Link href="/" className="hover:underline">Inicio</Link>
          <span className="mx-2">/</span>
          <Link href="/propiedades" className="hover:underline">Propiedades</Link>
          {property.municipality && (
            <>
              <span className="mx-2">/</span>
              <span className="text-slate-700">{property.municipality}</span>
            </>
          )}
        </nav>

        <header className="mt-4">
          {operation && (
            <span className="inline-block rounded-full bg-[#0b2a5b] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              {operationLabel(operation.type)}
            </span>
          )}
          <h1 className="mt-3 text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
            {property.title}
          </h1>
          {zone && <p className="mt-2 text-lg text-slate-600">{zone}</p>}

          {/*
            Sin precio: el espacio que ocupaba lo toma la llamada a la acción,
            que es el objetivo del portal (ver lib/display.ts).
          */}
          <p className="mt-3 text-lg font-semibold text-[#0b2a5b]">
            {PRICE_PLACEHOLDER}
            <span className="ml-2 font-normal text-base text-slate-600">
              · Solicita informes con un asesor
            </span>
          </p>
        </header>

        <Gallery images={property.images} />

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
          <div>
            {specs.length > 0 && (
              <section aria-labelledby="caracteristicas">
                <h2 id="caracteristicas" className="text-lg font-semibold text-slate-900">
                  Características
                </h2>
                <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {specs.map((spec) => (
                    <div key={spec.label} className="rounded-lg border border-slate-200 p-4">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">
                        {spec.label}
                      </dt>
                      <dd className="mt-1 text-lg font-semibold text-slate-900">
                        {spec.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {property.description && (
              <section aria-labelledby="descripcion" className="mt-10">
                <h2 id="descripcion" className="text-lg font-semibold text-slate-900">
                  Descripción
                </h2>
                <div className="mt-3 space-y-3 leading-relaxed text-slate-700">
                  {property.description.split(/\n+/).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </section>
            )}

            {property.features.length > 0 && (
              <section aria-labelledby="amenidades" className="mt-10">
                <h2 id="amenidades" className="text-lg font-semibold text-slate-900">
                  Amenidades y servicios
                </h2>
                <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {property.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-slate-700">
                      <span aria-hidden="true" className="text-[#e8622c]">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-slate-200 p-5">
              <h2 className="text-lg font-semibold text-slate-900">
                Solicita información
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Un asesor de {org.name} te contacta sin costo ni compromiso.
              </p>

              <ContactForm
                propertyId={property.id}
                propertySlug={property.slug}
                propertyTitle={property.title}
              />

              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#25d366] px-4 py-2.5 text-sm font-semibold text-[#128c3e] transition-colors hover:bg-[#25d366]/10"
                >
                  Escribir por WhatsApp
                </a>
              )}
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <section className="mt-16 border-t border-slate-200 pt-10">
            <h2 className="text-xl font-bold text-slate-900">
              Otras propiedades en {property.municipality}
            </h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}

function Gallery({ images }: { images: Array<{ url: string; alt: string }> }) {
  if (images.length === 0) return null;
  const [cover, ...rest] = images;

  return (
    <section aria-label="Fotografías de la propiedad" className="mt-6">
      <div className="grid gap-2 sm:grid-cols-4 sm:grid-rows-2">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 sm:col-span-2 sm:row-span-2 sm:aspect-auto">
          <Image
            src={cover.url}
            alt={cover.alt}
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover"
            priority
            unoptimized={cover.url.startsWith('data:')}
          />
        </div>

        {rest.slice(0, 4).map((img, i) => (
          <div key={i} className="relative hidden aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 sm:block">
            <Image
              src={img.url}
              alt={img.alt}
              fill
              sizes="25vw"
              className="object-cover"
              /* Todo lo que no es portada carga en diferido. */
              loading="lazy"
              unoptimized={img.url.startsWith('data:')}
            />
          </div>
        ))}
      </div>

      {images.length > 5 && (
        <p className="mt-2 text-sm text-slate-500">
          {images.length} fotografías disponibles.
        </p>
      )}
    </section>
  );
}
