/**
 * Resolución de inquilino por dominio.
 *
 * El sitio público es multi-inquilino: novahogar.mx → una organización,
 * otrainmobiliaria.mx → otra. El middleware normaliza el host y lo pasa en una
 * cabecera que las páginas leen para resolver la organización.
 *
 * La resolución real contra la base ocurre en `lib/site.ts`, no aquí: el
 * middleware corre en el edge y no debe abrir conexiones a Postgres.
 */

import { NextResponse, type NextRequest } from 'next/server';

export const TENANT_HEADER = 'x-tenant-domain';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const domain = host.replace(/^www\./, '').split(':')[0];

  const headers = new Headers(request.headers);
  headers.set(TENANT_HEADER, domain);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    /*
     * Todo menos estáticos de Next, el favicon y los archivos del directorio
     * public. No tiene sentido resolver inquilino para un .png.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
};
