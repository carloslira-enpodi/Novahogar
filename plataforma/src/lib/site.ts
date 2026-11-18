/**
 * Resolución del inquilino y configuración del sitio.
 *
 * En producción el inquilino se resuelve por dominio (novahogar.mx → org).
 * En desarrollo cae al inquilino de demostración.
 */

import { headers } from 'next/headers';
import { getOrganizationByDomain } from '@/lib/repositories/properties';
import { DEMO_ORGANIZATION } from '@/lib/demo-data';
import type { Organization } from '@/lib/types';

export const TENANT_HEADER = 'x-tenant-domain';

export async function getSiteUrl(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, '');

  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

export async function getCurrentOrganization(): Promise<Organization> {
  const h = await headers();
  const domain = h.get(TENANT_HEADER) ?? h.get('host') ?? '';
  const normalized = domain.replace(/^www\./, '').split(':')[0];

  const org = await getOrganizationByDomain(normalized);
  return org ?? DEMO_ORGANIZATION;
}

/** Enlace de WhatsApp con mensaje contextual por propiedad. */
export function whatsappLink(
  whatsapp: string | null,
  context?: { title: string; url?: string },
): string | null {
  if (!whatsapp) return null;
  const number = whatsapp.replace(/\D/g, '');

  const message = context
    ? `Hola, NOVAHOGAR. Me interesa: ${context.title}${context.url ? `\n${context.url}` : ''}`
    : 'Hola, NOVAHOGAR. Me gustaría información sobre sus propiedades.';

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
