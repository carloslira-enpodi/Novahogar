/**
 * Página institucional.
 *
 * El sitio actual tiene este contenido como IMAGEN ("10 razones para elegir
 * Novahogar") en dos páginas casi duplicadas de ~870 caracteres cada una, de
 * los cuales casi todo es menú y pie. Para Google están vacías.
 * Aquí el mismo contenido va en texto real.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentOrganization } from '@/lib/site';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Quiénes somos',
  description:
    'Más de una década acompañando a familias en la compra, venta y renta de ' +
    'inmuebles en la Ciudad de México. Conoce cómo trabajamos.',
  alternates: { canonical: '/nosotros' },
};

const REASONS = [
  {
    title: 'Valuación con sustento',
    body: 'Determinamos el precio con un análisis comparativo de mercado de la zona, no con una estimación al tanteo. Un precio mal puesto es la causa número uno de que una propiedad no se venda.',
  },
  {
    title: 'Difusión en los portales que importan',
    body: 'Publicamos en los principales portales inmobiliarios del país, además de nuestro propio sitio y redes sociales.',
  },
  {
    title: 'Fotografía profesional',
    body: 'La primera visita ocurre en pantalla. Cuidamos que tu propiedad se vea como merece antes de que alguien decida agendar.',
  },
  {
    title: 'Filtro de prospectos',
    body: 'Calificamos a quien pregunta antes de agendar una visita. Tu tiempo y tu privacidad valen.',
  },
  {
    title: 'Gestión de crédito',
    body: 'Acompañamos trámites de Infonavit, Fovissste y crédito bancario, incluida la documentación que suele atorar las operaciones.',
  },
  {
    title: 'Acompañamiento legal',
    body: 'Revisión de documentación, contrato y seguimiento hasta la firma ante notario.',
  },
  {
    title: 'Red de colaboración',
    body: 'Trabajamos con otras agencias de la zona, lo que amplía el alcance de cada propiedad en exclusiva.',
  },
  {
    title: 'Comunicación constante',
    body: 'Reportes de actividad: cuántas personas vieron tu propiedad, cuántas preguntaron y qué dijeron.',
  },
];

export default async function AboutPage() {
  const org = await getCurrentOrganization();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <nav aria-label="Ruta de navegación" className="text-sm text-slate-500">
        <Link href="/" className="hover:underline">Inicio</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700">Quiénes somos</span>
      </nav>

      <h1 className="mt-3 text-3xl font-bold text-slate-900">
        Quiénes somos
      </h1>

      <div className="mt-5 space-y-4 text-lg leading-relaxed text-slate-700">
        <p>
          {org.name} es una inmobiliaria con operación concentrada en la zona
          sur, centro y oriente de la Ciudad de México. Trabajamos
          principalmente en Coyoacán, Benito Juárez, Xochimilco, Tlalpan,
          Iztapalapa y Venustiano Carranza.
        </p>
        <p className="font-medium text-[#0b2a5b]">
          &ldquo;Más que casas, son historias.&rdquo;
        </p>
        <p>
          Esa frase resume cómo entendemos el trabajo: detrás de cada operación
          hay una familia que cambia de etapa. Por eso acompañamos el proceso
          completo, no solo la parte de mostrar el inmueble.
        </p>
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-bold text-slate-900">
          Por qué elegirnos
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {REASONS.map((reason, i) => (
            <div key={reason.title}>
              <h3 className="flex items-baseline gap-2 font-semibold text-[#0b2a5b]">
                <span className="text-sm text-[#e8622c]">{String(i + 1).padStart(2, '0')}</span>
                {reason.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {reason.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-xl bg-slate-50 p-6">
        <h2 className="text-xl font-bold text-slate-900">
          ¿Quieres vender o rentar tu propiedad?
        </h2>
        <p className="mt-2 text-slate-600">
          Agenda una valuación sin costo ni compromiso.
        </p>
        <Link
          href="/contacto"
          className="mt-4 inline-block rounded-lg bg-[#e8622c] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#d25521]"
        >
          Contactar a un asesor
        </Link>
      </section>
    </div>
  );
}
