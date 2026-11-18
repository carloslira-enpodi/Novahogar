/**
 * Landing de zona: "Casas en venta en Coyoacán".
 *
 * Estas páginas son la vía realista para captar búsquedas con un inventario
 * pequeño. El sitio actual no tiene ninguna. Se generan solas desde las
 * alcaldías que tienen propiedades publicadas.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentOrganization, getSiteUrl } from '@/lib/site';
import { listMunicipalities, listProperties } from '@/lib/repositories/properties';
import { PropertyCard } from '@/components/PropertyCard';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/seo/jsonld';

export const revalidate = 900;

/*
 * SIN generateStaticParams: misma razón que en la ficha de propiedad.
 * El inquilino se resuelve con `headers()` en tiempo de petición, y el build
 * no tiene petición. Ver el comentario en propiedades/[slug]/page.tsx.
 */

type Params = Promise<{ alcaldia: string }>;

async function resolve(slug: string) {
  const org = await getCurrentOrganization();
  const municipalities = await listMunicipalities(org.id);
  const match = municipalities.find((m) => m.slug === slug);
  return { org, match };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { alcaldia } = await params;
  const { match } = await resolve(alcaldia);
  if (!match) return { title: 'Zona no encontrada' };

  return {
    title: `Casas y departamentos en venta en ${match.name}`,
    description:
      `Propiedades en venta en ${match.name}. ${match.count} ` +
      `${match.count === 1 ? 'opción disponible' : 'opciones disponibles'} ` +
      'con asesoría personalizada en todo el proceso de compra.',
    alternates: { canonical: `/venta/${match.slug}` },
  };
}

export default async function ZonePage({ params }: { params: Params }) {
  const { alcaldia } = await params;
  const { org, match } = await resolve(alcaldia);

  if (!match) notFound();

  const siteUrl = await getSiteUrl();
  const { items } = await listProperties(org.id, {
    municipality: match.slug,
    operation: 'sale',
    perPage: 24,
  });

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Inicio', url: siteUrl },
          { name: 'Propiedades', url: `${siteUrl}/propiedades` },
          { name: match.name, url: `${siteUrl}/venta/${match.slug}` },
        ])}
      />
      <JsonLd data={itemListJsonLd(items, siteUrl)} />

      <div className="mx-auto max-w-6xl px-4 py-10">
        <nav aria-label="Ruta de navegación" className="text-sm text-slate-500">
          <Link href="/" className="hover:underline">Inicio</Link>
          <span className="mx-2">/</span>
          <Link href="/propiedades" className="hover:underline">Propiedades</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700">{match.name}</span>
        </nav>

        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          Casas y departamentos en venta en {match.name}
        </h1>

        <div className="mt-4 max-w-3xl space-y-3 leading-relaxed text-slate-600">
          <p>
            {org.name} opera en {match.name} con asesoría completa: avalúo,
            documentación, gestión de crédito y escrituración. Actualmente
            contamos con {items.length}{' '}
            {items.length === 1 ? 'propiedad disponible' : 'propiedades disponibles'} en
            esta zona.
          </p>
          <p>
            Si buscas vender tu propiedad en {match.name}, podemos ayudarte a
            determinar el precio correcto con un análisis comparativo de mercado
            y difundirla en los principales portales inmobiliarios.
          </p>
        </div>

        {items.length === 0 ? (
          <p className="mt-10 rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
            No hay propiedades en venta en esta zona por el momento.{' '}
            <Link href="/contacto" className="font-medium text-[#e8622c] hover:underline">
              Déjanos tus datos
            </Link>{' '}
            y te avisamos cuando entre inventario.
          </p>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((property, i) => (
              <PropertyCard key={property.id} property={property} priority={i < 3} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
