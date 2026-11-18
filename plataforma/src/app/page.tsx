import Link from 'next/link';
import type { Metadata } from 'next';
import { getCurrentOrganization } from '@/lib/site';
import {
  getFeaturedProperties,
  listMunicipalities,
} from '@/lib/repositories/properties';
import { PropertyCard } from '@/components/PropertyCard';
import { SearchBar } from '@/components/SearchBar';

export const revalidate = 900; // ISR: 15 minutos, alineado con la sincronización

export async function generateMetadata(): Promise<Metadata> {
  const org = await getCurrentOrganization();
  return {
    title: `${org.name} | Venta y renta de casas y departamentos en CDMX`,
    description:
      'Inmobiliaria en la Ciudad de México. Casas y departamentos en venta y ' +
      'renta en Coyoacán, Benito Juárez, Xochimilco, Tlalpan e Iztapalapa. ' +
      'Asesoría personalizada en todo el proceso.',
    alternates: { canonical: '/' },
  };
}

export default async function HomePage() {
  const org = await getCurrentOrganization();
  const [properties, municipalities] = await Promise.all([
    getFeaturedProperties(org.id, 9),
    listMunicipalities(org.id),
  ]);

  return (
    <>
      <section className="relative isolate overflow-hidden bg-[#0b2a5b]">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,#1d4e8f,transparent_60%)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          {/*
            H1 real y descriptivo. El sitio actual tiene el H1 VACÍO en su
            página más importante: Google no recibe ninguna señal principal.
          */}
          <h1 className="max-w-3xl text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
            Venta y renta de casas y departamentos en la Ciudad de México
          </h1>

          <p className="mt-4 max-w-2xl text-lg text-blue-100">
            Más que casas, son historias. Asesoría personalizada en Coyoacán,
            Benito Juárez, Xochimilco, Tlalpan e Iztapalapa.
          </p>

          <div className="mt-8">
            <SearchBar municipalities={municipalities} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Propiedades disponibles
            </h2>
            <p className="mt-1 text-slate-600">
              Inventario actualizado de {org.name}.
            </p>
          </div>
          <Link
            href="/propiedades"
            className="text-sm font-semibold text-[#e8622c] hover:underline"
          >
            Ver todas las propiedades →
          </Link>
        </div>

        {properties.length === 0 ? (
          <p className="mt-10 rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
            No hay propiedades publicadas por el momento.
          </p>
        ) : (
          /*
            La primera propiedad ocupa el doble de ancho. Sin precios que
            comparar, la jerarquía visual es lo que dirige la atención.
          */
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((property, i) => (
              <PropertyCard
                key={property.id}
                property={property}
                priority={i < 3}
                featured={i === 0}
              />
            ))}
          </div>
        )}
      </section>

      {municipalities.length > 0 && (
        <section className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-2xl font-bold text-slate-900">Busca por zona</h2>
            <p className="mt-1 text-slate-600">
              Explora el inventario por alcaldía o municipio.
            </p>

            {/*
              Landings de zona: cada una es una página indexable que ataca
              búsquedas como "casas en venta en Coyoacán". El sitio actual
              no tiene ninguna.
            */}
            <ul className="mt-6 flex flex-wrap gap-3">
              {municipalities.map((m) => (
                <li key={m.slug}>
                  <Link
                    href={`/venta/${m.slug}`}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-[#0b2a5b] hover:text-[#0b2a5b]"
                  >
                    {m.name}
                    <span className="text-xs text-slate-400">{m.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            {
              title: 'Acompañamiento completo',
              body: 'Te asesoramos en avalúo, documentación, crédito y escrituración, de principio a fin.',
            },
            {
              title: 'Difusión en los principales portales',
              body: 'Tu propiedad se publica donde buscan los compradores, con fotografía profesional.',
            },
            {
              title: 'Experiencia en la zona sur',
              body: 'Más de una década operando en Coyoacán, Benito Juárez, Xochimilco y Tlalpan.',
            },
          ].map((item) => (
            <div key={item.title}>
              <h2 className="text-lg font-semibold text-[#0b2a5b]">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
