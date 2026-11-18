/**
 * Clientes de Supabase del lado servidor.
 *
 * REGLA DE SEGURIDAD: la service_role key jamás llega al navegador.
 * El sitio público es anónimo y NO abre RLS a `anon`; lee desde el servidor con
 * service_role, filtrando siempre por el organization_id que resolvió el
 * middleware a partir del dominio (ver ARQUITECTURA.md §3).
 *
 * Por eso este archivo no exporta nada usable desde un componente de cliente.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * ¿Hay base de datos configurada?
 *
 * Si no la hay, los repositorios caen a los datos de demostración en vez de
 * reventar. Eso permite trabajar en el diseño antes de tener Supabase listo.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}

let serviceClient: SupabaseClient | null = null;

/** Cliente administrativo. Salta RLS: filtra SIEMPRE por organization_id. */
export function getServiceClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase no está configurado. Define NEXT_PUBLIC_SUPABASE_URL y ' +
        'SUPABASE_SERVICE_ROLE_KEY en .env.local',
    );
  }
  serviceClient ??= createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

/** Cliente anónimo, sujeto a RLS. Para sesiones autenticadas del CRM. */
export function getAnonClient(): SupabaseClient {
  if (!SUPABASE_URL || !ANON_KEY) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
}
