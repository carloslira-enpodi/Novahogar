'use client';

import { useState } from 'react';

interface Props {
  propertyId?: string;
  propertySlug?: string;
  propertyTitle?: string;
}

type State = 'idle' | 'sending' | 'sent' | 'error';

export function ContactForm({ propertyId, propertySlug, propertyTitle }: Props) {
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('sending');
    setError(null);

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    try {
      const res = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...data, propertyId, propertySlug, propertyTitle }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'No se pudo enviar la solicitud');
      }

      setState('sent');
      form.reset();
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  }

  if (state === 'sent') {
    return (
      <div role="status" className="mt-4 rounded-lg bg-green-50 p-4 text-sm text-green-800">
        <p className="font-semibold">Solicitud enviada</p>
        <p className="mt-1">Un asesor te contactará a la brevedad. Gracias por tu interés.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <div>
        <label htmlFor="cf-name" className="mb-1 block text-xs font-medium text-slate-600">
          Nombre <span aria-hidden="true">*</span>
        </label>
        <input id="cf-name" name="name" type="text" required autoComplete="name"
          className={fieldClass} placeholder="Tu nombre" />
      </div>

      <div>
        <label htmlFor="cf-email" className="mb-1 block text-xs font-medium text-slate-600">
          Correo electrónico <span aria-hidden="true">*</span>
        </label>
        <input id="cf-email" name="email" type="email" required autoComplete="email"
          className={fieldClass} placeholder="tu@correo.com" />
      </div>

      <div>
        <label htmlFor="cf-phone" className="mb-1 block text-xs font-medium text-slate-600">
          Teléfono
        </label>
        <input id="cf-phone" name="phone" type="tel" autoComplete="tel"
          className={fieldClass} placeholder="55 1234 5678" />
      </div>

      <div>
        <label htmlFor="cf-message" className="mb-1 block text-xs font-medium text-slate-600">
          Mensaje
        </label>
        <textarea id="cf-message" name="message" rows={3} className={fieldClass}
          defaultValue={propertyTitle ? `Me interesa: ${propertyTitle}` : ''} />
      </div>

      {/* Trampa anti-bots: invisible para personas, irresistible para bots. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="cf-website">No llenar</label>
        <input id="cf-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state === 'error' && error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'sending'}
        className="w-full rounded-lg bg-[#e8622c] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#d25521] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === 'sending' ? 'Enviando…' : 'Solicitar información'}
      </button>

      <p className="text-xs leading-relaxed text-slate-500">
        Al enviar aceptas nuestro{' '}
        <a href="/aviso-de-privacidad" className="underline hover:text-slate-700">
          aviso de privacidad
        </a>
        .
      </p>
    </form>
  );
}

const fieldClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0b2a5b] focus:outline-none focus:ring-2 focus:ring-[#0b2a5b]/20';
