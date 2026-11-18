# Plataforma Inmobiliaria Multi-Inquilino

Sistema propio tipo EasyBroker: sitio web público + CRM inmobiliario.
Cliente ancla: **NOVAHOGAR Bienes Raíces** (CDMX). Construido como SaaS vendible
a más inmobiliarias desde el día uno.

Lee **ARQUITECTURA.md** antes de tocar código. Define la estrategia, el modelo
de datos y la hoja de ruta por fases.

## Estructura

```
E:\NOVA HOGAR\
├── ARQUITECTURA.md              Decisiones, modelo de datos, hoja de ruta
├── supabase/migrations/         Esquema SQL versionado
└── plataforma/                  Aplicación Next.js 15 (App Router)
    └── src/lib/easybroker/      Cliente, mapper y sincronización
```

La app vive en `plataforma/`, no en la raíz: el nombre del directorio raíz
("NOVA HOGAR", con espacio y mayúsculas) no es válido como nombre de paquete npm.

## Stack

Next.js 15 (App Router) · TypeScript · Supabase (Postgres + Auth + Storage) ·
Tailwind v4 · Zod · Vercel

## Reglas no negociables

1. **Multi-inquilino en todo.** Toda tabla de negocio lleva `organization_id` y
   política RLS. Nunca escribas una query sin filtrar por organización.

2. **`public_id` de EasyBroker es llave EXTERNA, nunca primaria.** Nuestro `id`
   es un UUID propio. El día que el cliente corte con EasyBroker, nada se rompe.

3. **Las imágenes se copian a nuestro Storage.** Enlazar a
   `assets.easybroker.com` deja el sitio sin fotos el día de la cancelación.

4. **Un prospecto no se pierde jamás.** Se guarda primero en nuestra base, luego
   se empuja a EasyBroker. Si el push falla, se reintenta con backoff.

5. **La service_role key nunca llega al navegador.** El sitio público es anónimo
   y lee desde el servidor, filtrando por el `organization_id` que el middleware
   resolvió a partir del dominio.

6. **Todo lo específico de EasyBroker vive en `src/lib/easybroker/`.** El resto
   de la aplicación no sabe que EasyBroker existe.

## SEO: el motivo de varias decisiones

La auditoría de `novahogar.mx` encontró H1 vacío, cero datos estructurados, sin
canonical, 41 de 53 fotos sin `alt` y contenido institucional en imagen. Cada
defecto se corrige por diseño, no como parche:

- JSON-LD `RealEstateListing` + `Organization` + `BreadcrumbList` automáticos
- `alt` generado siempre (ver `mapper.ts` → `buildImageAlt`)
- Slugs estables que no cambian si se edita el título
- SSR/ISR real; nada de contenido que dependa de JavaScript del cliente

## Comandos

```bash
cd plataforma
npm run dev        # desarrollo
npm run build      # build de producción
npm run lint
```

## Variables de entorno

`plataforma/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # solo servidor, jamás en el cliente
CRON_SECRET=                   # protege las rutas de sincronización
```

La API key de EasyBroker **no va aquí**: se guarda por organización en la tabla
`organizations`, porque cada inquilino trae la suya.

## Estado actual

Fase 1 en curso. Hecho: esquema SQL con RLS, cliente de EasyBroker, mapper y job
de sincronización. Pendiente: clientes de Supabase, middleware de resolución por
dominio, sitio público y SEO.
