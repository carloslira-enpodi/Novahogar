/**
 * Cliente de la API de EasyBroker.
 *
 * Base: https://api.easybroker.com/v1
 * Auth: header `X-Authorization: <API_KEY>`
 *       (la llave está en Configuración general de EasyBroker; solo admins)
 *
 * Reglas que respeta este cliente:
 *  - `limit` máximo 50 por página (lo impone la API).
 *  - Reintento exponencial ante 429 y 5xx.
 *  - Concurrencia limitada: no castigamos la API del cliente.
 *  - Nunca lanza por 404 en recursos individuales: devuelve null.
 */

import type {
  EBPaginated,
  EBPropertyListItem,
  EBPropertyDetail,
  EBPropertySearchParams,
  EBContactRequest,
  EBContactRequestPayload,
} from './types';

const BASE_URL = 'https://api.easybroker.com/v1';
const MAX_LIMIT = 50;
const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 600;

export class EasyBrokerError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly endpoint: string,
  ) {
    super(message);
    this.name = 'EasyBrokerError';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class EasyBrokerClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = BASE_URL,
  ) {
    if (!apiKey) throw new Error('Se requiere una API key de EasyBroker');
  }

  // --------------------------------------------------------------------------
  // Transporte
  // --------------------------------------------------------------------------

  private async request<T>(
    path: string,
    init: RequestInit = {},
    attempt = 0,
  ): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

    const res = await fetch(url, {
      ...init,
      headers: {
        'X-Authorization': this.apiKey,
        accept: 'application/json',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
      cache: 'no-store',
    });

    // 429 y 5xx son transitorios: reintentamos con backoff exponencial.
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : BASE_BACKOFF_MS * 2 ** attempt;
      await sleep(wait);
      return this.request<T>(path, init, attempt + 1);
    }

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) detail = body.error;
      } catch {
        /* el cuerpo no era JSON; nos quedamos con statusText */
      }
      throw new EasyBrokerError(detail, res.status, path);
    }

    return res.json() as Promise<T>;
  }

  // --------------------------------------------------------------------------
  // Propiedades
  // --------------------------------------------------------------------------

  /** Una página de propiedades. Para recorrer todo, usa `iterateProperties`. */
  async listProperties(opts: {
    page?: number;
    limit?: number;
    search?: EBPropertySearchParams;
    propertyTypes?: string[];
  } = {}): Promise<EBPaginated<EBPropertyListItem>> {
    const params = new URLSearchParams();
    params.set('page', String(opts.page ?? 1));
    params.set('limit', String(Math.min(opts.limit ?? MAX_LIMIT, MAX_LIMIT)));

    for (const type of opts.propertyTypes ?? []) {
      params.append('search[property_types][]', type);
    }

    const { statuses, sort_by, ...rest } = opts.search ?? {};
    for (const status of statuses ?? []) {
      params.append('search[statuses][]', status);
    }
    if (sort_by) params.append('search[sort_by][]', sort_by);
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined && value !== null) {
        params.set(`search[${key}]`, String(value));
      }
    }

    return this.request<EBPaginated<EBPropertyListItem>>(
      `/properties?${params.toString()}`,
    );
  }

  /**
   * Recorre TODAS las páginas de propiedades.
   *
   * Para sync incremental pasa `search.updated_after` con el `last_synced_at`
   * de la organización: trae solo lo que cambió desde la última corrida.
   */
  async *iterateProperties(
    search?: EBPropertySearchParams,
  ): AsyncGenerator<EBPropertyListItem> {
    let page = 1;
    for (;;) {
      const res = await this.listProperties({ page, limit: MAX_LIMIT, search });
      for (const item of res.content) yield item;

      if (!res.pagination.next_page || res.content.length === 0) return;
      page += 1;

      // Guardia contra una paginación mal formada del lado del servidor.
      if (page > 500) return;
    }
  }

  /** Detalle completo: fotos, descripción, características. Null si no existe. */
  async getProperty(propertyId: string): Promise<EBPropertyDetail | null> {
    try {
      return await this.request<EBPropertyDetail>(
        `/properties/${encodeURIComponent(propertyId)}`,
      );
    } catch (err) {
      if (err instanceof EasyBrokerError && err.status === 404) return null;
      throw err;
    }
  }

  /**
   * Detalles en lote con concurrencia limitada.
   * No subas el límite sin medir: la API es del cliente, no nuestra.
   */
  async getPropertiesDetail(
    ids: string[],
    concurrency = 2,
  ): Promise<Map<string, EBPropertyDetail>> {
    const out = new Map<string, EBPropertyDetail>();
    const queue = [...ids];

    const worker = async () => {
      for (;;) {
        const id = queue.shift();
        if (!id) return;
        const detail = await this.getProperty(id);
        if (detail) out.set(id, detail);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, ids.length) }, worker),
    );
    return out;
  }

  // --------------------------------------------------------------------------
  // Solicitudes de contacto
  // --------------------------------------------------------------------------

  /**
   * Inyecta un prospecto en el buzón de EasyBroker del cliente.
   *
   * Esta es LA pieza de la estrategia de convivencia: el cliente sigue viendo
   * todos sus prospectos donde siempre, aunque el formulario viva en nuestro
   * sitio. Si esto falla, el lead ya quedó guardado en nuestra base y el job
   * de reintentos se encarga — nunca se pierde.
   */
  async createContactRequest(
    payload: EBContactRequestPayload,
  ): Promise<EBContactRequest> {
    return this.request<EBContactRequest>('/contact_requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /** Prospectos de TODOS los portales conectados. Así los traemos a nuestro CRM. */
  async listContactRequests(opts: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    propertyId?: string;
  } = {}): Promise<EBPaginated<EBContactRequest>> {
    const params = new URLSearchParams();
    params.set('page', String(opts.page ?? 1));
    params.set('limit', String(Math.min(opts.limit ?? MAX_LIMIT, MAX_LIMIT)));
    if (opts.startDate) params.set('search[start_date]', opts.startDate);
    if (opts.endDate) params.set('search[end_date]', opts.endDate);
    if (opts.propertyId) params.set('search[property_id]', opts.propertyId);

    return this.request<EBPaginated<EBContactRequest>>(
      `/contact_requests?${params.toString()}`,
    );
  }

  // --------------------------------------------------------------------------
  // Catálogos
  // --------------------------------------------------------------------------

  async listPropertyTypes(locale = 'es') {
    return this.request<EBPaginated<{ symbol: string; name: string }>>(
      `/property_types?locale=${locale}`,
    );
  }

  async listFeatures(locale = 'es') {
    return this.request<EBPaginated<{ name: string; category?: string }>>(
      `/features?locale=${locale}`,
    );
  }

  async listUsers() {
    return this.request<EBPaginated<{ id: string; name: string; email?: string }>>(
      '/users',
    );
  }

  /** Verifica que la API key sirva, antes de guardarla en la organización. */
  async verifyCredentials(): Promise<boolean> {
    try {
      await this.listProperties({ limit: 1 });
      return true;
    } catch (err) {
      if (err instanceof EasyBrokerError && err.status === 401) return false;
      throw err;
    }
  }
}
