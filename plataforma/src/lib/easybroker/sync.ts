/**
 * Sincronización EasyBroker → nuestra base.
 *
 * Reglas (ver ARQUITECTURA.md §4):
 *  1. Incremental por defecto vía `updated_after`; reconciliación completa diaria.
 *  2. `public_id` es llave EXTERNA, nunca PK. Nuestro id es UUID propio.
 *  3. Las imágenes se COPIAN a nuestro Storage. No es opcional: sin la copia,
 *     el día que se cancele EasyBroker el sitio se queda sin fotos.
 *  4. Todo upsert es idempotente por (organization_id, external_id).
 *
 * Se ejecuta con service_role (salta RLS deliberadamente) desde un cron.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { EasyBrokerClient } from './client';
import { mapProperty } from './mapper';

export interface SyncResult {
  created: number;
  updated: number;
  failed: number;
  imagesMirrored: number;
  errors: Array<{ externalId: string; message: string }>;
}

export interface SyncOptions {
  /** true = ignora last_synced_at y recorre todo el inventario. */
  full?: boolean;
  /** Copiar imágenes a Storage. Desactívalo solo para pruebas rápidas. */
  mirrorImages?: boolean;
}

const STORAGE_BUCKET = 'property-images';

export async function syncProperties(
  supabase: SupabaseClient,
  organizationId: string,
  apiKey: string,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const { full = false, mirrorImages = true } = options;
  const result: SyncResult = {
    created: 0, updated: 0, failed: 0, imagesMirrored: 0, errors: [],
  };

  const eb = new EasyBrokerClient(apiKey);

  const { data: run } = await supabase
    .from('sync_runs')
    .insert({
      organization_id: organizationId,
      direction: 'pull',
      resource: 'properties',
      status: 'running',
    })
    .select('id')
    .single();

  try {
    let updatedAfter: string | undefined;
    if (!full) {
      const { data: org } = await supabase
        .from('organizations')
        .select('last_synced_at')
        .eq('id', organizationId)
        .single();
      updatedAfter = org?.last_synced_at ?? undefined;
    }

    // Marca de tiempo tomada ANTES de leer: si algo cambia durante la corrida,
    // entra en la siguiente en vez de perderse.
    const syncStartedAt = new Date().toISOString();

    // 1) Qué cambió desde la última vez (solo IDs; el detalle va aparte).
    const changedIds: string[] = [];
    for await (const item of eb.iterateProperties({
      updated_after: updatedAfter,
      sort_by: 'updated_at-asc',
    })) {
      changedIds.push(item.public_id);
    }

    if (changedIds.length === 0) {
      await finishRun(supabase, run?.id, 'success', result);
      return result;
    }

    // 2) Detalle completo en lote, con concurrencia limitada.
    const details = await eb.getPropertiesDetail(changedIds, 2);

    for (const [publicId, detail] of details) {
      try {
        const mapped = mapProperty(detail);
        const { operations, images, features, ...propertyFields } = mapped;

        const { data: existing } = await supabase
          .from('properties')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('external_id', publicId)
          .maybeSingle();

        const { data: property, error } = await supabase
          .from('properties')
          .upsert(
            {
              ...propertyFields,
              organization_id: organizationId,
              published_at:
                propertyFields.status === 'published'
                  ? (existing ? undefined : new Date().toISOString())
                  : null,
            },
            { onConflict: 'organization_id,external_id' },
          )
          .select('id')
          .single();

        if (error || !property) {
          throw new Error(error?.message ?? 'No se pudo guardar la propiedad');
        }

        existing ? result.updated++ : result.created++;

        // Hijos: se reemplazan por completo. Son derivados, no tienen estado propio.
        await replaceChildren(supabase, organizationId, property.id, {
          operations,
          features,
        });

        const mirrored = await syncImages(
          supabase, organizationId, property.id, images, mirrorImages,
        );
        result.imagesMirrored += mirrored;
      } catch (err) {
        result.failed++;
        result.errors.push({
          externalId: publicId,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 3) Reconciliación: en corrida completa, lo que ya no está en EasyBroker
    //    se marca como no publicado. No se borra — puede tener solicitudes atadas.
    if (full) {
      await supabase
        .from('properties')
        .update({ status: 'not_published' })
        .eq('organization_id', organizationId)
        .eq('external_source', 'easybroker')
        .not('external_id', 'in', `(${changedIds.map((id) => `"${id}"`).join(',')})`);
    }

    await supabase
      .from('organizations')
      .update({ last_synced_at: syncStartedAt })
      .eq('id', organizationId);

    await finishRun(supabase, run?.id, 'success', result);
    return result;
  } catch (err) {
    await finishRun(
      supabase, run?.id, 'failed', result,
      err instanceof Error ? err.message : String(err),
    );
    throw err;
  }
}

// ---------------------------------------------------------------------------

async function replaceChildren(
  supabase: SupabaseClient,
  organizationId: string,
  propertyId: string,
  data: { operations: unknown[]; features: string[] },
) {
  await supabase.from('property_operations').delete().eq('property_id', propertyId);
  if (data.operations.length) {
    await supabase.from('property_operations').insert(
      data.operations.map((op) => ({
        ...(op as Record<string, unknown>),
        property_id: propertyId,
        organization_id: organizationId,
      })),
    );
  }

  await supabase.from('property_features').delete().eq('property_id', propertyId);
  if (data.features.length) {
    await supabase.from('property_features').insert(
      data.features.map((name) => ({
        name,
        property_id: propertyId,
        organization_id: organizationId,
      })),
    );
  }
}

/**
 * Copia las fotos a nuestro Storage.
 *
 * Se salta las que ya tengan `mirrored_at` con la misma `source_url`: las
 * fichas traen hasta 50 fotos y volver a descargarlas en cada corrida sería
 * tirar ancho de banda a la basura.
 */
async function syncImages(
  supabase: SupabaseClient,
  organizationId: string,
  propertyId: string,
  images: Array<{ source_url: string; alt: string; position: number }>,
  mirror: boolean,
): Promise<number> {
  const { data: existing } = await supabase
    .from('property_images')
    .select('id, source_url, storage_path, mirrored_at')
    .eq('property_id', propertyId);

  const bySource = new Map(
    (existing ?? []).map((img) => [img.source_url as string, img]),
  );

  let mirroredCount = 0;

  for (const img of images) {
    const prior = bySource.get(img.source_url);

    let storagePath = prior?.storage_path as string | null | undefined;
    let mirroredAt = prior?.mirrored_at as string | null | undefined;

    if (mirror && !storagePath) {
      try {
        const res = await fetch(img.source_url);
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          const ext = img.source_url.split('?')[0].split('.').pop() || 'jpg';
          const path = `${organizationId}/${propertyId}/${img.position}.${ext}`;

          const { error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(path, buffer, {
              contentType: res.headers.get('content-type') ?? 'image/jpeg',
              upsert: true,
            });

          if (!error) {
            storagePath = path;
            mirroredAt = new Date().toISOString();
            mirroredCount++;
          }
        }
      } catch {
        // Una foto que no se pudo copiar no debe tumbar la sincronización.
        // Queda con source_url y se reintenta en la siguiente corrida.
      }
    }

    if (prior) {
      await supabase
        .from('property_images')
        .update({ alt: img.alt, position: img.position, storage_path: storagePath, mirrored_at: mirroredAt })
        .eq('id', prior.id);
      bySource.delete(img.source_url);
    } else {
      await supabase.from('property_images').insert({
        property_id: propertyId,
        organization_id: organizationId,
        source_url: img.source_url,
        storage_path: storagePath,
        mirrored_at: mirroredAt,
        alt: img.alt,
        position: img.position,
      });
    }
  }

  // Las que ya no vienen de EasyBroker se eliminan.
  for (const stale of bySource.values()) {
    await supabase.from('property_images').delete().eq('id', stale.id);
  }

  return mirroredCount;
}

async function finishRun(
  supabase: SupabaseClient,
  runId: string | undefined,
  status: 'success' | 'failed',
  result: SyncResult,
  error?: string,
) {
  if (!runId) return;
  await supabase
    .from('sync_runs')
    .update({
      status,
      records_created: result.created,
      records_updated: result.updated,
      records_failed: result.failed,
      error: error ?? (result.errors.length ? JSON.stringify(result.errors.slice(0, 10)) : null),
      finished_at: new Date().toISOString(),
    })
    .eq('id', runId);
}

// ===========================================================================
// Push de prospectos hacia EasyBroker
// ===========================================================================

/**
 * Reintenta los prospectos cuyo push a EasyBroker falló.
 *
 * Un lead perdido cuesta más que cualquier bug de esta plataforma: el lead ya
 * está guardado en nuestra base desde el momento en que se envió el formulario.
 * Esto solo reintenta la copia hacia el buzón del cliente.
 */
export async function retryPendingContactPushes(
  supabase: SupabaseClient,
  organizationId: string,
  apiKey: string,
  limit = 50,
): Promise<{ pushed: number; failed: number }> {
  const eb = new EasyBrokerClient(apiKey);
  const now = new Date().toISOString();

  const { data: pending } = await supabase
    .from('contact_requests')
    .select('id, name, email, phone, message, push_attempts, properties(external_id)')
    .eq('organization_id', organizationId)
    .eq('pushed_to_easybroker', false)
    .or(`push_next_retry_at.is.null,push_next_retry_at.lte.${now}`)
    .limit(limit);

  let pushed = 0;
  let failed = 0;

  for (const req of pending ?? []) {
    const externalId = (req.properties as { external_id?: string } | null)?.external_id;
    if (!externalId) continue;

    try {
      await eb.createContactRequest({
        name: req.name,
        property_id: externalId,
        source: 'Sitio web',
        email: req.email ?? undefined,
        phone: req.phone ?? undefined,
        message: req.message ?? undefined,
      });

      await supabase
        .from('contact_requests')
        .update({ pushed_to_easybroker: true, push_last_error: null })
        .eq('id', req.id);
      pushed++;
    } catch (err) {
      const attempts = (req.push_attempts ?? 0) + 1;
      // Backoff exponencial, tope de 6 horas.
      const delayMs = Math.min(2 ** attempts * 60_000, 6 * 60 * 60 * 1000);

      await supabase
        .from('contact_requests')
        .update({
          push_attempts: attempts,
          push_last_error: err instanceof Error ? err.message : String(err),
          push_next_retry_at: new Date(Date.now() + delayMs).toISOString(),
        })
        .eq('id', req.id);
      failed++;
    }
  }

  return { pushed, failed };
}
