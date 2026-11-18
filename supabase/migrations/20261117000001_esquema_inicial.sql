-- ============================================================================
-- Plataforma Inmobiliaria Multi-Inquilino — Esquema inicial
-- Postgres / Supabase
--
-- Principio de aislamiento: toda tabla de negocio lleva organization_id y
-- Row Level Security. El aislamiento lo garantiza el motor, no la aplicación.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";      -- búsqueda por texto
create extension if not exists "unaccent";     -- búsqueda sin acentos (es-MX)

-- ============================================================================
-- TIPOS
-- ============================================================================

create type member_role      as enum ('owner', 'admin', 'agent', 'viewer');
create type property_status  as enum ('published', 'not_published', 'reserved',
                                      'sold', 'rented', 'suspended', 'flagged',
                                      'disapproved');
create type operation_type   as enum ('sale', 'rental', 'temporary_rental');
create type price_unit       as enum ('total', 'square_meter', 'hectare');
create type commission_type  as enum ('percentage', 'months', 'amount');
create type rental_period    as enum ('monthly', 'weekly', 'daily');
create type request_source   as enum ('website', 'whatsapp', 'phone', 'easybroker',
                                      'portal', 'referral', 'manual');
create type request_status   as enum ('new', 'contacted', 'qualified', 'visit',
                                      'negotiation', 'won', 'lost');
create type sync_direction   as enum ('pull', 'push');
create type sync_status      as enum ('pending', 'running', 'success', 'failed');

-- ============================================================================
-- ORGANIZACIONES Y MEMBRESÍAS
-- ============================================================================

create table organizations (
  id                  uuid primary key default uuid_generate_v4(),
  slug                text not null unique,
  name                text not null,
  legal_name          text,
  email               text,
  phone               text,
  whatsapp            text,
  address             text,
  logo_url            text,
  -- Integración con EasyBroker (fase de convivencia)
  easybroker_api_key  text,                      -- cifrar vía Vault en producción
  easybroker_enabled  boolean not null default false,
  last_synced_at      timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table memberships (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            member_role not null default 'agent',
  full_name       text,
  phone           text,
  photo_url       text,
  -- ID del asesor en EasyBroker, para mapear propiedades y solicitudes
  external_id     text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index on memberships (user_id);
create index on memberships (organization_id);

-- ----------------------------------------------------------------------------
-- Helpers de autorización. SECURITY DEFINER + search_path fijo para que las
-- políticas RLS no recursen sobre memberships ni dependan del search_path.
-- ----------------------------------------------------------------------------

create or replace function auth_org_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select organization_id from memberships
  where user_id = auth.uid() and active = true;
$$;

create or replace function auth_has_role(org uuid, roles member_role[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid()
      and organization_id = org
      and active = true
      and role = any(roles)
  );
$$;

-- ============================================================================
-- SITIOS PÚBLICOS
-- ============================================================================

create table sites (
  id               uuid primary key default uuid_generate_v4(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  domain           text not null unique,          -- novahogar.mx
  is_primary       boolean not null default true,
  theme            jsonb not null default '{}',   -- colores, tipografía, logo
  seo              jsonb not null default '{}',   -- título base, descripción, GA4 ID
  content          jsonb not null default '{}',   -- textos del home, nosotros, etc.
  published        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on sites (organization_id);

-- ============================================================================
-- PROPIEDADES
-- ============================================================================

create table properties (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid not null references organizations(id) on delete cascade,

  -- Identidad externa. public_id de EasyBroker (EB-XXX123). NUNCA es la PK:
  -- el día que se corte con EasyBroker, nada debe romperse.
  external_id         text,
  external_source     text default 'easybroker',

  slug                text not null,
  title               text not null,
  description         text,

  property_type       text not null,              -- 'house', 'apartment', 'land'...
  status              property_status not null default 'not_published',
  conservation_state  text,

  bedrooms            integer,
  bathrooms           numeric(4,1),
  half_bathrooms      integer,
  parking_spaces      integer,
  construction_size   numeric(10,2),              -- m²
  lot_size            numeric(10,2),              -- m²
  floors              integer,
  age                 integer,

  -- Ubicación
  street              text,
  exterior_number     text,
  interior_number     text,
  neighborhood        text,                       -- colonia
  municipality        text,                       -- alcaldía / municipio
  state               text,
  postal_code         text,
  country             text default 'México',
  latitude            numeric(10,7),
  longitude           numeric(10,7),
  show_exact_location boolean not null default false,

  agent_id            uuid references memberships(id) on delete set null,

  -- Comercial
  show_prices         boolean not null default true,
  share_commission    boolean not null default false,
  is_exclusive        boolean not null default false,

  video_url           text,
  virtual_tour_url    text,

  -- SEO por propiedad (sobrescribe lo generado automáticamente)
  seo_title           text,
  seo_description     text,

  featured            boolean not null default false,
  views_count         integer not null default 0,

  published_at        timestamptz,
  external_updated_at timestamptz,                -- updated_at de EasyBroker
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (organization_id, slug),
  unique (organization_id, external_id)
);

create index on properties (organization_id, status);
create index on properties (organization_id, property_type);
create index on properties (organization_id, municipality);
create index on properties (organization_id, neighborhood);
create index on properties (agent_id);
create index properties_search_idx on properties
  using gin (to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(description,'')));

-- ----------------------------------------------------------------------------

create table property_operations (
  id               uuid primary key default uuid_generate_v4(),
  property_id      uuid not null references properties(id) on delete cascade,
  organization_id  uuid not null references organizations(id) on delete cascade,
  type             operation_type not null,
  amount           numeric(14,2),
  currency         text not null default 'MXN',
  unit             price_unit not null default 'total',
  period           rental_period,                 -- solo renta temporal
  commission_type  commission_type,
  commission_value numeric(10,2),
  created_at       timestamptz not null default now()
);

create index on property_operations (property_id);
create index on property_operations (organization_id, type, amount);

-- ----------------------------------------------------------------------------

create table property_images (
  id               uuid primary key default uuid_generate_v4(),
  property_id      uuid not null references properties(id) on delete cascade,
  organization_id  uuid not null references organizations(id) on delete cascade,
  -- storage_path es nuestra copia. source_url es el origen en EasyBroker.
  -- La copia NO es opcional: sin ella, cancelar EasyBroker deja el sitio sin fotos.
  storage_path     text,
  source_url       text,
  alt              text,
  position         integer not null default 0,
  width            integer,
  height           integer,
  mirrored_at      timestamptz,                   -- cuándo se copió a Storage
  created_at       timestamptz not null default now()
);

create index on property_images (property_id, position);

-- ----------------------------------------------------------------------------

create table property_features (
  id               uuid primary key default uuid_generate_v4(),
  property_id      uuid not null references properties(id) on delete cascade,
  organization_id  uuid not null references organizations(id) on delete cascade,
  category         text,                          -- 'amenidades', 'servicios'
  name             text not null,
  created_at       timestamptz not null default now(),
  unique (property_id, name)
);

create index on property_features (property_id);

-- ============================================================================
-- CONTACTOS Y SOLICITUDES
-- ============================================================================

create table contacts (
  id               uuid primary key default uuid_generate_v4(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  external_id      text,
  full_name        text not null,
  emails           text[] not null default '{}',
  phones           text[] not null default '{}',
  company_name     text,
  tags             text[] not null default '{}',
  notes            text,
  assigned_to      uuid references memberships(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, external_id)
);

create index on contacts (organization_id);
create index contacts_name_idx on contacts using gin (full_name gin_trgm_ops);

-- ----------------------------------------------------------------------------

create table contact_requests (
  id               uuid primary key default uuid_generate_v4(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  property_id      uuid references properties(id) on delete set null,
  contact_id       uuid references contacts(id) on delete set null,

  name             text not null,
  email            text,
  phone            text,
  message          text,

  source           request_source not null default 'website',
  source_detail    text,                          -- 'inmuebles24', 'lamudi'...
  status           request_status not null default 'new',

  external_id      text,

  -- Push hacia EasyBroker. Un lead perdido cuesta más que cualquier bug:
  -- si el push falla, se reintenta con backoff y el lead ya está guardado aquí.
  pushed_to_easybroker     boolean not null default false,
  push_attempts            integer not null default 0,
  push_last_error          text,
  push_next_retry_at       timestamptz,

  assigned_to      uuid references memberships(id) on delete set null,
  utm              jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on contact_requests (organization_id, status, created_at desc);
create index on contact_requests (property_id);
create index contact_requests_pending_push_idx on contact_requests (push_next_retry_at)
  where pushed_to_easybroker = false;

-- ============================================================================
-- TAREAS
-- ============================================================================

create table tasks (
  id               uuid primary key default uuid_generate_v4(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  title            text not null,
  description      text,
  due_at           timestamptz,
  completed_at     timestamptz,
  assigned_to      uuid references memberships(id) on delete set null,
  property_id      uuid references properties(id) on delete cascade,
  contact_id       uuid references contacts(id) on delete cascade,
  created_by       uuid references memberships(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on tasks (organization_id, completed_at, due_at);
create index on tasks (assigned_to);

-- ============================================================================
-- BITÁCORA DE SINCRONIZACIÓN
-- ============================================================================

create table sync_runs (
  id               uuid primary key default uuid_generate_v4(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  direction        sync_direction not null,
  resource         text not null,                 -- 'properties', 'contact_requests'
  status           sync_status not null default 'pending',
  records_created  integer not null default 0,
  records_updated  integer not null default 0,
  records_failed   integer not null default 0,
  error            text,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz
);

create index on sync_runs (organization_id, started_at desc);

-- ============================================================================
-- updated_at AUTOMÁTICO
-- ============================================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['organizations','sites','properties','contacts',
                           'contact_requests','tasks']
  loop
    execute format(
      'create trigger %I_set_updated_at before update on %I
       for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table organizations      enable row level security;
alter table memberships        enable row level security;
alter table sites              enable row level security;
alter table properties         enable row level security;
alter table property_operations enable row level security;
alter table property_images    enable row level security;
alter table property_features  enable row level security;
alter table contacts           enable row level security;
alter table contact_requests   enable row level security;
alter table tasks              enable row level security;
alter table sync_runs          enable row level security;

-- --- Organizaciones ---------------------------------------------------------

create policy org_select on organizations for select
  using (id in (select auth_org_ids()));

create policy org_update on organizations for update
  using (auth_has_role(id, array['owner','admin']::member_role[]));

-- --- Membresías -------------------------------------------------------------

create policy memberships_select on memberships for select
  using (organization_id in (select auth_org_ids()));

create policy memberships_manage on memberships for all
  using (auth_has_role(organization_id, array['owner','admin']::member_role[]))
  with check (auth_has_role(organization_id, array['owner','admin']::member_role[]));

-- --- Tablas de negocio: lectura para miembros, escritura salvo 'viewer' -----

do $$
declare t text;
begin
  foreach t in array array['sites','properties','property_operations',
                           'property_images','property_features','contacts',
                           'contact_requests','tasks','sync_runs']
  loop
    execute format($f$
      create policy %1$I_select on %1$I for select
        using (organization_id in (select auth_org_ids()));

      create policy %1$I_write on %1$I for all
        using (auth_has_role(organization_id,
               array['owner','admin','agent']::member_role[]))
        with check (auth_has_role(organization_id,
               array['owner','admin','agent']::member_role[]));
    $f$, t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- NOTA sobre el sitio público:
-- El sitio es anónimo y debe leer propiedades publicadas sin sesión. NO se abre
-- RLS a 'anon'. Las lecturas públicas pasan por el servidor de Next.js con la
-- service_role key, filtrando siempre por el organization_id que el middleware
-- resolvió a partir del dominio. La service_role key jamás llega al navegador.
-- ----------------------------------------------------------------------------
