import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentOrganization, whatsappLink } from '@/lib/site';
import { ContactForm } from '@/components/ContactForm';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Contacto',
  description:
    'Contáctanos para comprar, vender o rentar tu propiedad en la Ciudad de ' +
    'México. Agenda una cita sin costo ni compromiso.',
  alternates: { canonical: '/contacto' },
};

export default async function ContactPage() {
  const org = await getCurrentOrganization();
  const wa = whatsappLink(org.whatsapp);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <nav aria-label="Ruta de navegación" className="text-sm text-slate-500">
        <Link href="/" className="hover:underline">Inicio</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700">Contacto</span>
      </nav>

      <h1 className="mt-3 text-3xl font-bold text-slate-900">
        Contacta a {org.name}
      </h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Si quieres comprar, vender o rentar una propiedad, agenda una cita sin
        costo ni compromiso. Te respondemos el mismo día hábil.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="datos">
          <h2 id="datos" className="text-lg font-semibold text-slate-900">
            Datos de contacto
          </h2>

          <dl className="mt-4 space-y-4 text-sm">
            {org.address && (
              <div>
                <dt className="font-medium text-slate-900">Oficina</dt>
                <dd className="mt-1 leading-relaxed text-slate-600">{org.address}</dd>
              </div>
            )}
            {org.phone && (
              <div>
                <dt className="font-medium text-slate-900">Teléfono</dt>
                <dd className="mt-1">
                  <a href={`tel:+52${org.phone}`} className="text-[#e8622c] hover:underline">
                    {org.phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2 $3')}
                  </a>
                </dd>
              </div>
            )}
            {org.email && (
              <div>
                <dt className="font-medium text-slate-900">Correo</dt>
                <dd className="mt-1">
                  <a href={`mailto:${org.email}`} className="text-[#e8622c] hover:underline">
                    {org.email}
                  </a>
                </dd>
              </div>
            )}
          </dl>

          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-[#25d366] px-4 py-2.5 text-sm font-semibold text-[#128c3e] hover:bg-[#25d366]/10"
            >
              Escribir por WhatsApp
            </a>
          )}
        </section>

        <section aria-labelledby="formulario" className="rounded-xl border border-slate-200 p-6">
          <h2 id="formulario" className="text-lg font-semibold text-slate-900">
            Envíanos un mensaje
          </h2>
          <ContactForm />
        </section>
      </div>
    </div>
  );
}
