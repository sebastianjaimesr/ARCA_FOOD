-- =============================================================================
-- Seguridad
-- La arquitectura es "backend como única puerta": el navegador nunca lee ni
-- escribe tablas directamente a través de la API REST de Supabase (PostgREST).
-- Por eso:
--   1. RLS activo en todas las tablas.
--   2. Ninguna política para los roles anon/authenticated → acceso denegado.
--   3. Se revocan además los privilegios de tabla para esos roles (defensa doble).
-- El backend se conecta con un rol de servidor que no pasa por PostgREST.
-- =============================================================================

alter table public.profiles              enable row level security;
alter table public.settings              enable row level security;
alter table public.delivery_zones        enable row level security;
alter table public.categories            enable row level security;
alter table public.products              enable row level security;
alter table public.product_variants      enable row level security;
alter table public.option_groups         enable row level security;
alter table public.options               enable row level security;
alter table public.product_option_groups enable row level security;
alter table public.inventory_movements   enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.order_item_options    enable row level security;
alter table public.order_status_history  enable row level security;
alter table public.audit_log             enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;

-- Que las tablas futuras tampoco queden expuestas por defecto.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

-- El historial de inventario y de estados es de solo inserción.
create or replace function public.prevent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'La tabla % es de solo inserción', tg_table_name;
end;
$$;

create trigger inventory_movements_append_only
  before update or delete on public.inventory_movements
  for each row execute function public.prevent_mutation();

create trigger order_status_history_append_only
  before update or delete on public.order_status_history
  for each row execute function public.prevent_mutation();
