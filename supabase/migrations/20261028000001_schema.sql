-- =============================================================================
-- El Arca – esquema principal
-- Reglas:
--   * Importes en NUMERIC(12,2), nunca FLOAT.
--   * Los pedidos guardan copia (snapshot) de nombres y precios: si un producto
--     cambia después, el pedido histórico no cambia.
--   * Los productos con historial no se borran (ON DELETE RESTRICT); se desactivan.
--   * El backend (Express) es el único que escribe. Las tablas tienen RLS activo
--     y sin políticas para anon/authenticated (ver migración de seguridad).
-- =============================================================================

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.staff_role as enum ('admin', 'staff');

create type public.order_status as enum (
  'PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO'
);

create type public.fulfillment_type as enum ('DOMICILIO', 'RECOGIDA');

create type public.inventory_movement_type as enum (
  'ENTRADA',          -- compra o reposición
  'SALIDA',           -- merma, consumo interno, daño
  'AJUSTE',           -- conteo físico: fija la cantidad exacta
  'PEDIDO',           -- descuento automático al confirmar un pedido
  'REVERSION_PEDIDO'  -- devolución automática al cancelar un pedido ya descontado
);

-- ---------------------------------------------------------------------------
-- Utilidad: updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfiles del personal (1:1 con auth.users)
-- role NULL = cuenta sin acceso al panel hasta que un admin la promueva.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       citext not null unique,
  full_name   text,
  role        public.staff_role,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cada usuario nuevo de Supabase Auth recibe un perfil sin rol.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Configuración del restaurante (una sola fila, id = 1)
-- Campos NULL = dato pendiente por confirmar.
-- ---------------------------------------------------------------------------
create table public.settings (
  id                   smallint primary key default 1 check (id = 1),
  business_name        text not null,
  tagline              text,
  whatsapp_phone       text check (whatsapp_phone ~ '^[0-9]{10,15}$'),  -- formato internacional sin "+"
  address              text,
  city                 text,
  instagram_handle     text,
  logo_url             text,
  currency             char(3) not null default 'COP',
  timezone             text not null default 'America/Bogota',
  -- Horario semanal: [{ "day": 1..7 (lunes=1), "open": "HH:MM", "close": "HH:MM" }]. NULL = pendiente.
  opening_hours        jsonb check (opening_hours is null or jsonb_typeof(opening_hours) = 'array'),
  delivery_enabled     boolean not null default true,
  pickup_enabled       boolean not null default true,
  accepting_orders     boolean not null default true,
  -- Texto que se muestra cuando no hay zonas de domicilio configuradas.
  delivery_notes       text,
  updated_at           timestamptz not null default now(),
  updated_by           uuid references public.profiles (id) on delete set null
);

create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Zonas y tarifas de domicilio
-- Si no hay zonas activas, el domicilio queda "por confirmar" (sin tarifa).
-- ---------------------------------------------------------------------------
create table public.delivery_zones (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  fee         numeric(12, 2) not null check (fee >= 0),
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger delivery_zones_updated_at before update on public.delivery_zones
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------
create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name         text not null,
  description  text,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.products (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid not null references public.categories (id) on delete restrict,
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name            text not null,
  description     text,
  -- Precio base. Si el producto tiene variantes activas, se usa el precio de la variante.
  price           numeric(12, 2) not null check (price >= 0),
  image_url       text,
  image_alt       text,
  is_active       boolean not null default true,   -- false = oculto de la tienda
  is_available    boolean not null default true,   -- false = visible pero "agotado"
  is_featured     boolean not null default false,
  sort_order      integer not null default 0,
  -- Inventario por producto terminado (opcional por producto).
  track_stock     boolean not null default false,
  stock_quantity  integer not null default 0 check (stock_quantity >= 0),
  min_stock       integer not null default 0 check (min_stock >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index products_category_idx on public.products (category_id, sort_order);
create index products_active_idx on public.products (is_active) where is_active;

create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- Variantes con precio propio (ej.: hot dog con salchicha Zenú o Americana).
create table public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete restrict,
  name        text not null,
  price       numeric(12, 2) not null check (price >= 0),
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (product_id, name)
);

create index product_variants_product_idx on public.product_variants (product_id, sort_order);

create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

-- Grupos de opciones reutilizables (ej.: "Adicionales", "Salsas").
create table public.option_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  min_select  integer not null default 0 check (min_select >= 0),
  max_select  integer check (max_select is null or max_select >= 1),  -- NULL = sin límite
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (max_select is null or max_select >= min_select)
);

create trigger option_groups_updated_at before update on public.option_groups
  for each row execute function public.set_updated_at();

create table public.options (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.option_groups (id) on delete restrict,
  name        text not null,
  price       numeric(12, 2) not null default 0 check (price >= 0),
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (group_id, name)
);

create index options_group_idx on public.options (group_id, sort_order);

create trigger options_updated_at before update on public.options
  for each row execute function public.set_updated_at();

-- Qué grupos de opciones ofrece cada producto.
create table public.product_option_groups (
  product_id  uuid not null references public.products (id) on delete cascade,
  group_id    uuid not null references public.option_groups (id) on delete restrict,
  sort_order  integer not null default 0,
  primary key (product_id, group_id)
);

create index product_option_groups_group_idx on public.product_option_groups (group_id);

-- ---------------------------------------------------------------------------
-- Inventario: historial de movimientos (solo inserción)
-- ---------------------------------------------------------------------------
create table public.inventory_movements (
  id               bigint generated always as identity primary key,
  product_id       uuid not null references public.products (id) on delete restrict,
  type             public.inventory_movement_type not null,
  quantity_change  integer not null check (quantity_change <> 0 or type = 'AJUSTE'),
  quantity_before  integer not null check (quantity_before >= 0),
  quantity_after   integer not null check (quantity_after >= 0),
  reason           text not null check (length(trim(reason)) > 0),
  order_id         uuid,  -- FK abajo, cuando exista la tabla orders
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  check (quantity_after = quantity_before + quantity_change)
);

create index inventory_movements_product_idx on public.inventory_movements (product_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------
create sequence public.order_code_seq start 1001;

create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique default ('ARC-' || nextval('public.order_code_seq')::text),
  -- Clave enviada por el cliente: el mismo intento nunca crea dos pedidos.
  idempotency_key     uuid not null unique,
  request_hash        text not null,
  status              public.order_status not null default 'PENDIENTE',
  fulfillment         public.fulfillment_type not null,
  customer_name       text not null check (length(trim(customer_name)) between 2 and 80),
  customer_phone      text not null check (customer_phone ~ '^[0-9]{10}$'),
  delivery_address    text,
  delivery_reference  text,
  delivery_zone_id    uuid references public.delivery_zones (id) on delete set null,
  delivery_zone_name  text,
  notes               text,
  subtotal            numeric(12, 2) not null check (subtotal >= 0),
  -- NULL = domicilio por confirmar (no hay zonas configuradas).
  delivery_fee        numeric(12, 2) check (delivery_fee is null or delivery_fee >= 0),
  total               numeric(12, 2) not null check (total >= 0),
  -- true cuando el inventario ya se descontó (al confirmar).
  stock_applied       boolean not null default false,
  cancel_reason       text,
  confirmed_at        timestamptz,
  delivered_at        timestamptz,
  cancelled_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (fulfillment = 'RECOGIDA' or delivery_address is not null),
  check (total = subtotal + coalesce(delivery_fee, 0)),
  check (status <> 'CANCELADO' or cancelled_at is not null),
  check (status <> 'ENTREGADO' or delivered_at is not null)
);

create index orders_status_created_idx on public.orders (status, created_at desc);
create index orders_created_idx on public.orders (created_at desc);
create index orders_delivered_idx on public.orders (delivered_at) where status = 'ENTREGADO';

create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

alter table public.inventory_movements
  add constraint inventory_movements_order_fk
  foreign key (order_id) references public.orders (id) on delete restrict;

create index inventory_movements_order_idx on public.inventory_movements (order_id) where order_id is not null;

create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    uuid not null references public.products (id) on delete restrict,
  variant_id    uuid references public.product_variants (id) on delete restrict,
  -- Snapshot al momento del pedido:
  product_name  text not null,
  variant_name  text,
  base_price    numeric(12, 2) not null check (base_price >= 0),
  options_price numeric(12, 2) not null default 0 check (options_price >= 0),
  unit_price    numeric(12, 2) not null check (unit_price >= 0),
  quantity      integer not null check (quantity between 1 and 50),
  line_total    numeric(12, 2) not null check (line_total >= 0),
  notes         text,
  sort_order    integer not null default 0,
  check (unit_price = base_price + options_price),
  check (line_total = unit_price * quantity)
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_item_options (
  id             uuid primary key default gen_random_uuid(),
  order_item_id  uuid not null references public.order_items (id) on delete cascade,
  option_id      uuid not null references public.options (id) on delete restrict,
  group_name     text not null,
  option_name    text not null,
  price          numeric(12, 2) not null check (price >= 0)
);

create index order_item_options_item_idx on public.order_item_options (order_item_id);

create table public.order_status_history (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders (id) on delete cascade,
  from_status  public.order_status,
  to_status    public.order_status not null,
  note         text,
  changed_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- ---------------------------------------------------------------------------
-- Auditoría de operaciones administrativas
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  data        jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity, entity_id);
create index audit_log_created_idx on public.audit_log (created_at desc);
