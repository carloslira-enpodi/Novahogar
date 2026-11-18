/**
 * Recepción de prospectos.
 *
 * Orden de operaciones deliberado:
 *   1. Guardar en NUESTRA base.           ← nunca se pierde un lead
 *   2. Empujar a EasyBroker.              ← el cliente lo ve donde siempre
 *   3. Si el push falla, encolar reintento y devolver éxito igualmente.
 *
 * El visitante no tiene por qué enterarse de que una integración interna falló:
 * su solicitud ya está a salvo. El job de reintentos se encarga del resto.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentOrganization } from '@/lib/site';
import { getServiceClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { EasyBrokerClient } from '@/lib/easybroker/client';

export const runtime = 'nodejs';

const schema = z.object({
  name: z.string().trim().min(2, 'El nombre es obligatorio').max(120),
  email: z.string().trim().email('Correo electrónico inválido').max(160),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
  propertyId: z.string().optional(),
  propertySlug: z.string().optional(),
  propertyTitle: z.string().optional(),
  // Honeypot: si viene con contenido, es un bot.
  website: z.string().max(0).optional().or(z.literal('')),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Honeypot lleno: respondemos 200 para no darle señal al bot.
  if (data.website) {
    return NextResponse.json({ ok: true });
  }

  const org = await getCurrentOrganization();

  // Sin Supabase configurado no podemos persistir. Antes que fingir éxito,
  // lo decimos: un lead que se pierde en silencio es peor que un error visible.
  if (!isSupabaseConfigured()) {
    console.warn('[contacto] Supabase no configurado; solicitud no persistida', {
      name: data.name,
      property: data.propertySlug,
    });
    return NextResponse.json(
      { error: 'El formulario aún no está conectado. Escríbenos por WhatsApp.' },
      { status: 503 },
    );
  }

  const supabase = getServiceClient();

  // --- 1. Guardar primero -------------------------------------------------
  const { data: saved, error: saveError } = await supabase
    .from('contact_requests')
    .insert({
      organization_id: org.id,
      property_id: data.propertyId ?? null,
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      message: data.message || null,
      source: 'website',
      status: 'new',
    })
    .select('id, properties(external_id)')
    .single();

  if (saveError || !saved) {
    console.error('[contacto] No se pudo guardar la solicitud', saveError);
    return NextResponse.json(
      { error: 'No pudimos registrar tu solicitud. Intenta de nuevo.' },
      { status: 500 },
    );
  }

  // --- 2. Empujar a EasyBroker -------------------------------------------
  const { data: orgRow } = await supabase
    .from('organizations')
    .select('easybroker_api_key, easybroker_enabled')
    .eq('id', org.id)
    .single();

  const externalId = (saved.properties as { external_id?: string } | null)?.external_id;

  if (orgRow?.easybroker_enabled && orgRow.easybroker_api_key && externalId) {
    try {
      const eb = new EasyBrokerClient(orgRow.easybroker_api_key);
      await eb.createContactRequest({
        name: data.name,
        property_id: externalId,
        source: 'Sitio web',
        email: data.email,
        phone: data.phone || undefined,
        message: data.message || undefined,
      });

      await supabase
        .from('contact_requests')
        .update({ pushed_to_easybroker: true })
        .eq('id', saved.id);
    } catch (err) {
      // --- 3. Encolar reintento, pero responder éxito al visitante --------
      console.error('[contacto] Push a EasyBroker falló; se reintentará', err);
      await supabase
        .from('contact_requests')
        .update({
          push_attempts: 1,
          push_last_error: err instanceof Error ? err.message : String(err),
          push_next_retry_at: new Date(Date.now() + 120_000).toISOString(),
        })
        .eq('id', saved.id);
    }
  }

  return NextResponse.json({ ok: true });
}
