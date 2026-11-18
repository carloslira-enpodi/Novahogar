# Arquitectura — Plataforma Inmobiliaria Multi-Inquilino

> Sistema propio tipo EasyBroker: sitio web público + CRM inmobiliario.
> Cliente ancla: **NOVAHOGAR Bienes Raíces** (CDMX). Diseñado como SaaS vendible a más inmobiliarias.

---

## 1. Contexto y decisión estratégica

### Qué tiene hoy Nova Hogar en EasyBroker

| Métrica | Valor |
|---|---|
| Propiedades publicadas | 42 (2 con errores) |
| Solicitudes de clientes (30 días) | **1,014** |
| Solicitudes de asesores (30 días) | 44 |
| Colaboradores en red | 20 |
| Exclusivas en Bolsa Inmobiliaria | 944 |
| Invitaciones | 102 |
| Costo estimado | ~$1,990 MXN/mes (plan Agencia + sitio web) |

### El riesgo que define toda la arquitectura

**Las 1,014 solicitudes mensuales no las produce el software de EasyBroker.** Las produce su
distribución: Inmuebles24, Lamudi, Mercado Libre, Propiedades.com, Pincali y la Bolsa
Inmobiliaria (red de 20 colaboradores con 944 exclusivas).

Un reemplazo directo —apagar EasyBroker y encender lo nuestro— destruiría ese flujo de
prospectos de la noche a la mañana. El cliente perdería su negocio y la culpa sería nuestra.

**Por eso la estrategia es convivencia, no sustitución inmediata.**

### Estrategia en tres movimientos

```
FASE 1  ─ Adueñarse de la vitrina
          Sitio web propio, alimentado por la API de EasyBroker.
          EasyBroker sigue operando intacto. Riesgo cero para el cliente.
          Resultado: cancelan el add-on de $500/mes y el sitio es nuestro.

FASE 2  ─ Adueñarse de los datos
          CRM propio (propiedades, contactos, tareas, buzón).
          Sincronización bidireccional. Nuestra base es la fuente de verdad.
          EasyBroker queda reducido a un canal de distribución más.

FASE 3  ─ Adueñarse de la distribución
          Feeds XML/API directos a portales. Contratos a nombre del cliente.
          Solo entonces EasyBroker se vuelve prescindible — y es decisión del cliente, no nuestra.
```

La Bolsa Inmobiliaria (la red de colaboración entre agencias) es la pieza que **no se programa**.
Es efecto de red. Si el cliente la valora, puede mantener el plan más barato de EasyBroker solo
por acceso a ella. Eso es perfectamente compatible con nuestro sistema.

---

## 2. Stack

| Capa | Tecnología | Por qué |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | SSR/ISR real — indispensable para SEO inmobiliario. Un sitio que no rankea no sirve. |
| Lenguaje | TypeScript | El modelo de propiedad tiene ~40 campos; sin tipos esto se vuelve inmanejable. |
| Base de datos | **Supabase (Postgres)** | Row Level Security nativo = aislamiento multi-inquilino a nivel de motor, no de aplicación. |
| Auth | Supabase Auth | Usuarios, roles y organizaciones listos. JWT con `org_id` embebido. |
| Almacenamiento | Supabase Storage | Fotos de propiedades con CDN y transformaciones. |
| Estilos | Tailwind CSS v4 | Consistencia y velocidad; temas por inquilino vía variables CSS. |
| Hosting | **Vercel** | ISR, edge caching y preview deployments. Gratis al inicio, ~$20-45/mes al escalar. |
| Validación | Zod | Un solo esquema valida formularios, API y payloads de EasyBroker. |

**Costo de infraestructura estimado:** $0/mes en arranque → $45-70/mes con varios inquilinos
activos. Contra los $1,990/mes que paga hoy un solo cliente.

---

## 3. Modelo multi-inquilino

### Principio

Una sola base de datos, una sola aplicación, aislamiento por `organization_id` con
**Row Level Security de Postgres**. El aislamiento lo garantiza el motor, no el código de la
aplicación — es la única forma de que un bug en una query no filtre datos entre clientes.

```
organizations           ← cada inmobiliaria (Nova Hogar = la primera)
├── memberships         ← qué usuario pertenece a qué organización y con qué rol
├── properties          ← inventario
│   ├── property_images
│   ├── property_operations    (venta / renta / renta temporal)
│   └── property_features
├── contacts            ← base de clientes
├── contact_requests    ← prospectos entrantes (de nuestro sitio y de EasyBroker)
├── tasks               ← seguimiento
└── sites               ← configuración del sitio público (dominio, tema, textos)
```

### Resolución de inquilino

| Superficie | Cómo se resuelve |
|---|---|
| Sitio público | Por dominio o subdominio (`novahogar.mx` → `org_id`), vía middleware. |
| CRM | Por el `org_id` del JWT de la sesión. |
| Jobs de sincronización | `service_role` iterando organizaciones, saltándose RLS deliberadamente. |

### Roles

- `owner` — control total, facturación
- `admin` — gestiona usuarios y configuración
- `agent` — gestiona sus propiedades y sus contactos
- `viewer` — solo lectura

---

## 4. Sincronización con EasyBroker

### Lo que nos da la API

Base: `https://api.easybroker.com/v1` — auth por header `X-Authorization: <API_KEY>`
(la llave está en configuración general de EasyBroker; solo la ven administradores).

| Endpoint | Uso en nuestro sistema |
|---|---|
| `GET /properties` | Sync incremental con `search[updated_after]`. Máx. 50 por página. |
| `GET /properties/{id}` | Detalle completo: fotos, descripción, características. |
| `POST /properties` | Fase 2: publicar desde nuestro CRM hacia EasyBroker. |
| `PATCH /properties/{id}` | Fase 2: propagar cambios. |
| **`POST /contact_requests`** | **Pieza clave:** los prospectos de nuestro sitio entran a su buzón. |
| `GET /contact_requests` | Extraemos prospectos de todos los portales hacia nuestro CRM. |
| `GET /contacts`, `PATCH /contacts/{id}` | Fase 2: base de clientes. |
| `GET /property_types`, `/features`, `/locations` | Catálogos. |
| `GET /property_integrations` | Estado de publicación por portal. |
| `GET /users` | Asesores. |

### Flujo de datos en Fase 1

```
  EasyBroker                  Nuestra plataforma              Visitante
  ──────────                  ──────────────────              ─────────

  Inventario  ──── pull ────►  properties (cache)  ──SSR──►  novahogar.mx
  (42 props)   cada 15 min     Postgres + Storage             (sitio propio)
                                                                   │
  Buzón       ◄─── push ────   contact_requests   ◄──────────── formulario
  (intacto)    inmediato        (copia propia)                  / WhatsApp
```

El cliente sigue viendo **todos** sus prospectos en el buzón de EasyBroker al que ya está
acostumbrado. Nosotros conservamos una copia. Nadie pierde nada; nosotros ganamos los datos.

### Reglas de sincronización

1. **Incremental por defecto.** Guardamos `last_synced_at` por organización y pedimos solo
   `updated_after`. Reconciliación completa una vez al día de madrugada.
2. **`public_id` de EasyBroker es la llave externa** (`EB-XXX123`), nunca la llave primaria.
   Nuestro `id` es un UUID propio — así el día que corten con EasyBroker, nada se rompe.
3. **Las imágenes se copian a nuestro Storage.** Si solo enlazáramos a
   `assets.easybroker.com`, el día de la cancelación el sitio se queda sin fotos.
   Esto no es opcional.
4. **Idempotencia.** Todo upsert va por `(organization_id, external_id)`.
5. **El push de prospectos no puede fallar en silencio.** Si `POST /contact_requests` falla,
   se encola y reintenta con backoff; el prospecto ya está guardado en nuestra base.
   Perder un lead cuesta más que cualquier bug de esta plataforma.
6. **Rate limiting:** máximo 50 resultados por página, concurrencia limitada a 2 peticiones
   simultáneas con reintento exponencial ante 429.

---

## 5. El sitio público — lo que hacemos mejor que la plantilla actual

Cada defecto detectado en la auditoría de `novahogar.mx` se corrige por diseño:

| Problema actual | Solución en la plataforma |
|---|---|
| `<h1>` vacío en el home | H1 generado por plantilla de inquilino, obligatorio por tipo |
| Cero datos estructurados | JSON-LD `RealEstateListing` + `Organization` + `BreadcrumbList` automáticos |
| Sin `rel=canonical` | Canonical en cada ruta, filtros con `noindex` |
| Contenido institucional en imagen | CMS de páginas con texto real |
| Sin `loading="lazy"` | `next/image` con lazy, AVIF/WebP y tamaños responsivos |
| 41 de 53 fotos sin `alt` | `alt` autogenerado: "{tipo} en {colonia}, foto {n} de {total}" |
| `user-scalable=no` | Viewport accesible, zoom permitido |
| jQuery + Bootstrap 3 + polyfills IE8 | React 19 + Tailwind, sin lastre |
| Analytics muerto desde 2023 | GA4 + eventos de conversión propios en nuestra base |
| Pie con "2018" | Año dinámico |
| Dos chats encimados | Un solo WhatsApp con mensaje contextual por propiedad |
| Sin páginas de zona | Landings por colonia/alcaldía generadas desde el inventario |

### Rutas públicas

```
/                                    Home con buscador e inventario destacado
/propiedades                         Listado con filtros (SSR, paginado, indexable)
/propiedades/[slug]                  Ficha — JSON-LD, galería, mapa, formulario
/venta/[alcaldia]                    Landing de zona — "Casas en venta en Coyoacán"
/renta/[alcaldia]                    Landing de zona
/nosotros  /contacto  /aviso-de-privacidad
/blog/[slug]                         Contenido para captar al vendedor
/sitemap.xml  /robots.txt            Generados desde el inventario real
```

### Presupuesto de rendimiento

- LCP < 2.0 s en 4G · CLS < 0.1 · ficha completa < 400 KB inicial
- Listado y fichas con ISR, revalidación cada 15 min + webhook de invalidación al sincronizar

---

## 6. El CRM (Fase 2)

Réplica funcional de lo que usa Nova Hogar hoy, sin lo que no usa:

```
/crm                        Tablero: publicadas, con errores, solicitudes 30d
/crm/propiedades            Inventario, estados, errores de validación
/crm/propiedades/[id]       Editor: datos, fotos, operaciones, características
/crm/contactos              Base de clientes, historial, etiquetas
/crm/solicitudes            Buzón unificado — nuestro sitio + portales vía EasyBroker
/crm/tareas                 Seguimiento con vencimientos
/crm/sitio                  Configuración del sitio público (tema, textos, dominio)
/crm/configuracion          Usuarios, roles, llaves de integración
```

**Deliberadamente fuera de alcance:** Bolsa Inmobiliaria (es efecto de red, no software) y
sindicación directa a portales (Fase 3, requiere contratos del cliente con cada portal).

---

## 7. Hoja de ruta

### Fase 1 — Sitio público (4-6 semanas)

| # | Entregable |
|---|---|
| 1.1 | Esquema de base de datos + RLS multi-inquilino |
| 1.2 | Cliente de API de EasyBroker con reintentos y tipos |
| 1.3 | Job de sincronización incremental + copia de imágenes a Storage |
| 1.4 | Resolución de inquilino por dominio (middleware) |
| 1.5 | Home, listado con filtros y ficha de propiedad |
| 1.6 | SEO: JSON-LD, canonical, sitemap dinámico, OG tags |
| 1.7 | Formulario de contacto → nuestra base + push a EasyBroker |
| 1.8 | Landings de zona generadas desde el inventario |
| 1.9 | GA4 + eventos de conversión propios |
| 1.10 | Despliegue y migración de dominio |

**Criterio de aceptación:** `novahogar.mx` corre sobre nuestra plataforma, el cliente no nota
ninguna pérdida de función, los prospectos siguen llegando a su buzón de EasyBroker, y se
cancela el add-on de sitio web de $500/mes.

### Fase 2 — CRM (6-10 semanas)
Propiedades editables, contactos, tareas, buzón unificado, sync bidireccional.
**Criterio:** el cliente puede operar un día completo sin abrir EasyBroker.

### Fase 3 — Distribución (según contratos)
Feeds XML a Inmuebles24 y Mercado Libre, evaluación de Proppit.
**Criterio:** el flujo de prospectos se sostiene sin EasyBroker. Hasta aquí no antes.

---

## 8. Modelo de negocio sugerido

Nova Hogar paga hoy ~$23,880/año a EasyBroker.

| Esquema | Lógica |
|---|---|
| Implementación inicial | Pago único por migración y puesta en marcha |
| Suscripción mensual | Por debajo de lo que pagan hoy, pero recurrente para ti |
| Multi-inquilino | Cada cliente nuevo tiene costo marginal cercano a cero |

El valor que vendes no es el software: es que **el sitio, los datos y los prospectos dejan de
ser rehenes de un tercero**. Ese argumento se sostiene solo.

---

## 9. Estructura del repositorio

```
E:\NOVA HOGAR\
├── ARQUITECTURA.md              Este documento
├── CLAUDE.md                    Contexto e instrucciones del proyecto
├── supabase/
│   └── migrations/              Esquema SQL versionado
└── plataforma/                  Aplicación Next.js
    └── src/
        ├── app/
        │   ├── (public)/        Sitio público por inquilino
        │   ├── (crm)/           Panel de administración
        │   └── api/             Rutas de API y webhooks
        ├── lib/
        │   ├── easybroker/      Cliente y sincronización
        │   ├── supabase/        Clientes server/browser
        │   └── seo/             JSON-LD y metadatos
        └── components/
```
