-- Pruebas de la base de datos con pgTAP. Ejecutar con:  npx supabase test db
begin;
select plan(16);

-- 1. Todas las tablas públicas tienen RLS activo.
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'Todas las tablas de public tienen RLS activo'
);

-- 2-3. Los roles del navegador no tienen ningún privilegio sobre las tablas.
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated')),
  0,
  'anon y authenticated no tienen privilegios de tabla'
);

set local role anon;
select throws_ok(
  'select * from public.orders',
  '42501',
  null,
  'anon no puede leer pedidos'
);
select throws_ok(
  $$update public.products set price = 1$$,
  '42501',
  null,
  'anon no puede cambiar precios'
);
reset role;

set local role authenticated;
select throws_ok(
  $$update public.products set stock_quantity = 999$$,
  '42501',
  null,
  'un usuario autenticado no puede cambiar el stock directamente'
);
reset role;

-- 6-9. La carta 2025 quedó cargada completa. Se verifica "al menos" lo que
-- trae la migración: el restaurante puede agregar productos desde el panel y
-- las pruebas de integración crean categorías "prueba-*".
create temp table carta_categories as
  select id from public.categories
  where slug in ('hamburguesas', 'hot-dogs', 'papas-locas', 'desgranados', 'salchipapas', 'choripapas', 'carnes', 'bebidas');

select is((select count(*)::int from carta_categories), 8, '8 categorías de la carta');
select cmp_ok(
  (select count(*)::int from public.products where category_id in (select id from carta_categories)),
  '>=',
  43,
  'al menos los 43 productos de la carta'
);
select cmp_ok(
  (select count(*)::int from public.product_variants v
   join public.products p on p.id = v.product_id
   where p.category_id in (select id from carta_categories) and v.name in ('Salchicha Zenú', 'Salchicha Americana')),
  '>=',
  14,
  'al menos las 14 variantes Zenú/Americana'
);
select cmp_ok(
  (select count(*)::int from public.options o join public.option_groups g on g.id = o.group_id where g.name = 'Adicionales'),
  '>=',
  14,
  'al menos los 14 adicionales'
);

-- 10. Precios exactos de muestra.
select is(
  (select price from public.products where slug = 'hamburguesa-ranchera'),
  26500.00::numeric,
  'La Ranchera cuesta 26.500'
);

-- 11. Las restricciones protegen la consistencia.
select throws_ok(
  $$update public.products set stock_quantity = -1 where slug = 'botella-de-agua'$$,
  '23514',
  null,
  'El stock no puede ser negativo'
);

-- 12. Un producto con historial no se puede borrar.
insert into public.orders (idempotency_key, request_hash, fulfillment, customer_name, customer_phone, subtotal, total)
values ('00000000-0000-0000-0000-000000000001', 'x', 'RECOGIDA', 'Prueba', '3000000000', 3000, 3000);
insert into public.order_items (order_id, product_id, product_name, base_price, unit_price, quantity, line_total)
select o.id, p.id, p.name, 3000, 3000, 1, 3000
from public.orders o, public.products p
where o.idempotency_key = '00000000-0000-0000-0000-000000000001' and p.slug = 'botella-de-agua';

select throws_ok(
  $$delete from public.products where slug = 'botella-de-agua'$$,
  '23503',
  null,
  'No se puede borrar un producto con pedidos (se desactiva)'
);

-- 13. El total debe cuadrar con subtotal + domicilio.
select throws_ok(
  $$insert into public.orders (idempotency_key, request_hash, fulfillment, customer_name, customer_phone, subtotal, delivery_fee, total, delivery_address)
    values (gen_random_uuid(), 'x', 'DOMICILIO', 'Prueba', '3000000000', 10000, 2000, 11000, 'Calle 1')$$,
  '23514',
  null,
  'El total debe ser subtotal + domicilio'
);

-- 14. La misma clave de idempotencia no crea dos pedidos.
select throws_ok(
  $$insert into public.orders (idempotency_key, request_hash, fulfillment, customer_name, customer_phone, subtotal, total)
    values ('00000000-0000-0000-0000-000000000001', 'x', 'RECOGIDA', 'Prueba', '3000000000', 3000, 3000)$$,
  '23505',
  null,
  'La clave de idempotencia es única'
);

-- 15. El historial de inventario es de solo inserción.
insert into public.inventory_movements (product_id, type, quantity_change, quantity_before, quantity_after, reason)
select id, 'ENTRADA', 5, 0, 5, 'Prueba' from public.products where slug = 'botella-de-agua';
select throws_ok(
  $$delete from public.inventory_movements$$,
  'P0001',
  null,
  'Los movimientos de inventario no se pueden borrar'
);

-- 16. Un usuario nuevo de Auth recibe perfil sin rol.
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-0000000000aa', 'nuevo@prueba.local', 'authenticated', 'authenticated');
select is(
  (select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000aa'),
  null,
  'Un usuario nuevo no tiene rol (sin acceso al panel)'
);

select * from finish();
rollback;
