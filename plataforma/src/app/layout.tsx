import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { getCurrentOrganization, getSiteUrl, whatsappLink } from '@/lib/site';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo/jsonld';
import { JsonLd } from '@/components/JsonLd';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const [org, siteUrl] = await Promise.all([getCurrentOrganization(), getSiteUrl()]);

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${org.name} | Inmobiliaria en la CDMX`,
      // Toda página hija hereda la marca — el sitio actual no lo hace.
      template: `%s | ${org.name}`,
    },
    description:
      'Venta y renta de casas y departamentos en la Ciudad de México. ' +
      'Asesoría personalizada en Coyoacán, Benito Juárez, Xochimilco y Tlalpan.',
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      locale: 'es_MX',
      siteName: org.name,
      url: siteUrl,
    },
    robots: { index: true, follow: true },
  };
}

/**
 * Viewport accesible: el sitio actual usa `maximum-scale=1, user-scalable=no`,
 * que impide hacer zoom. Es una barrera real para compradores mayores — un
 * segmento central en compra de vivienda. Aquí el zoom queda permitido.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b2a5b',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [org, siteUrl] = await Promise.all([getCurrentOrganization(), getSiteUrl()]);
  const wa = whatsappLink(org.whatsapp);

  return (
    <html lang="es-MX">
      <body className="flex min-h-screen flex-col bg-white text-slate-800 antialiased">
        <JsonLd data={organizationJsonLd(org, siteUrl)} />
        <JsonLd data={websiteJsonLd(org, siteUrl)} />

        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[#0b2a5b] focus:px-4 focus:py-2 focus:text-white"
        >
          Saltar al contenido
        </a>

        <SiteHeader org={org} />

        <main id="contenido" className="flex-1">
          {children}
        </main>

        <SiteFooter org={org} />

        {/* Un solo canal de contacto flotante. El sitio actual encima dos. */}
        {wa && <WhatsAppButton href={wa} />}
      </body>
    </html>
  );
}

function SiteHeader({ org }: { org: Awaited<ReturnType<typeof getCurrentOrganization>> }) {
  const nav = [
    { href: '/', label: 'Inicio' },
    { href: '/propiedades?operacion=sale', label: 'Venta' },
    { href: '/propiedades?operacion=rental', label: 'Renta' },
    { href: '/nosotros', label: 'Nosotros' },
    { href: '/contacto', label: 'Contacto' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex flex-col leading-tight">
          <span className="text-xs font-medium uppercase tracking-widest text-[#e8622c]">
            Bienes Raíces
          </span>
          <span className="text-xl font-bold text-[#0b2a5b]">{org.name.split(' ')[0]}</span>
        </Link>

        <nav aria-label="Navegación principal">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-slate-600 transition-colors hover:text-[#0b2a5b]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {org.phone && (
          <a
            href={`tel:+52${org.phone}`}
            className="text-sm font-semibold text-[#e8622c] hover:underline"
          >
            {formatPhone(org.phone)}
          </a>
        )}
      </div>
    </header>
  );
}

function SiteFooter({ org }: { org: Awaited<ReturnType<typeof getCurrentOrganization>> }) {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
            {org.name}
          </h2>
          {org.address && (
            <address className="mt-3 text-sm not-italic leading-relaxed text-slate-600">
              {org.address}
            </address>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
            Contacto
          </h2>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {org.phone && (
              <li>
                <a href={`tel:+52${org.phone}`} className="hover:underline">
                  {formatPhone(org.phone)}
                </a>
              </li>
            )}
            {org.email && (
              <li>
                <a href={`mailto:${org.email}`} className="hover:underline">
                  {org.email}
                </a>
              </li>
            )}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
            Secciones
          </h2>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            <li><Link href="/propiedades" className="hover:underline">Propiedades</Link></li>
            <li><Link href="/nosotros" className="hover:underline">Nosotros</Link></li>
            <li><Link href="/contacto" className="hover:underline">Contacto</Link></li>
            <li><Link href="/aviso-de-privacidad" className="hover:underline">Aviso de privacidad</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        {/* Año dinámico: el sitio actual lleva "2018" congelado desde hace ocho años. */}
        © {new Date().getFullYear()} {org.name}. Todos los derechos reservados.
      </div>
    </footer>
  );
}

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '').slice(-10);
  return `(${d.slice(0, 2)}) ${d.slice(2, 6)} ${d.slice(6)}`;
}
