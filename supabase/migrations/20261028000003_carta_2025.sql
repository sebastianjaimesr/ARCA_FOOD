-- =============================================================================
-- Datos reales: carta 2025 de El Arca y configuración confirmada.
-- Fuente: "EL ARCA CARTA 2025 nueva carta.pdf" (precios tomados de la imagen de
-- cada página). Ver docs/datos-del-negocio.md.
-- Es una migración (y no un seed) para que llegue igual a producción.
-- Después del lanzamiento, los cambios se hacen desde el panel administrativo.
-- =============================================================================

insert into public.settings (
  id, business_name, tagline, whatsapp_phone, address, city, instagram_handle,
  logo_url, opening_hours, delivery_notes
) values (
  1,
  'El Arca',
  'Comidas Rápidas',
  '573006681727',
  'Cl 103 #14-27',
  'Bucaramanga, Santander',
  'elarcafastfood',
  '/brand/logo-el-arca.webp',
  null,  -- Horario pendiente por confirmar
  null   -- Tarifas de domicilio pendientes por confirmar
);

-- ---------------------------------------------------------------------------
-- Categorías
-- ---------------------------------------------------------------------------
insert into public.categories (slug, name, description, sort_order) values
  ('hamburguesas', 'Hamburguesas', 'Incluye papas a la francesa', 1),
  ('hot-dogs',     'Hot Dogs',     'Incluye papas a la francesa', 2),
  ('papas-locas',  'Papas Locas',  null,                          3),
  ('desgranados',  'Desgranados',  'Incluye papas a la francesa', 4),
  ('salchipapas',  'Salchipapas',  null,                          5),
  ('choripapas',   'Choripapas',   null,                          6),
  ('carnes',       'Carnes',       null,                          7),
  ('bebidas',      'Bebidas',      null,                          8);

-- ---------------------------------------------------------------------------
-- Productos
-- En productos con variantes (Zenú / Americana), "price" es el precio menor y
-- la variante elegida define el precio final.
-- ---------------------------------------------------------------------------
insert into public.products (category_id, slug, name, description, price, sort_order)
select c.id, p.slug, p.name, p.description, p.price, p.sort_order
from (values
  -- Hamburguesas
  ('hamburguesas', 'hamburguesa-clasica',       'Clásica',        'Carne 150 grs, jamón, queso, vegetales.', 19000, 1),
  ('hamburguesas', 'hamburguesa-especial',      'Especial',       'Carne 150 grs, pollo desmechado, jamón, queso, tocineta, vegetales.', 24000, 2),
  ('hamburguesas', 'hamburguesa-americana',     'Americana',      'Carne 150 grs, tocineta, aros de cebolla, jamón, queso, vegetales.', 24000, 3),
  ('hamburguesas', 'hamburguesa-mixta',         'Mixta',          'Carne 150 grs, filete de pechuga, tocineta, jamón, queso, vegetales.', 25000, 4),
  ('hamburguesas', 'hamburguesa-ranchera',      'Ranchera',       'Carne 150 grs, pollo desmechado, salchicha americana, chorizo, tocineta, jamón, queso, vegetales.', 26500, 5),
  ('hamburguesas', 'hamburguesa-mexicana',      'Mexicana',       'Carne 150 grs, carne desmechada, guacamole, nachos, jalapeños, jamón, queso, vegetales.', 27000, 6),
  ('hamburguesas', 'hamburguesa-doble-carne',   'Doble Carne',    'Carne 150 grs x2, jamón, queso, tocineta, vegetales.', 27000, 7),
  ('hamburguesas', 'hamburguesa-santandereana', 'Santandereana',  'Carne 150 grs, carne desmechada, chorizo, maíz tierno, tocineta, arepa santandereana, jamón, queso, vegetales.', 28000, 8),
  ('hamburguesas', 'hamburguesa-vaquera',       'Vaquera',        'Carne 150 grs, pollo desmechado, filete de carne en cuadros BBQ, jamón, queso, vegetales.', 28000, 9),
  ('hamburguesas', 'hamburguesa-crispy',        'Crispy',         'Carne 150 gr, filete de pechuga apanado, mermelada de chorizo, jamón, queso, vegetales.', 28000, 10),
  ('hamburguesas', 'hamburguesa-super-mixta',   'Super Mixta',    'Carne 150 grs x2, filete de pechuga, queso x2, jamón, tocineta, aros de cebolla, vegetales.', 34000, 11),
  ('hamburguesas', 'hamburguesa-big-arca',      'Big Arca',       'Carne 150 grs x2, pollo desmechado, carne desmechada, tocineta, jamón x3, queso x3, vegetales.', 36000, 12),
  -- Hot Dogs
  ('hot-dogs', 'hot-dog-clasico',        'Clásico',        'Salchicha, papa molida, cebolla, queso gratinado.', 15000, 1),
  ('hot-dogs', 'hot-dog-especial',       'Especial',       'Salchicha, papa molida, cebolla, pollo desmechado, jamón, queso gratinado.', 20000, 2),
  ('hot-dogs', 'hot-dog-mexicano',       'Mexicano',       'Salchicha, nachos, carne desmechada, maíz tierno, guacamole, jalapeños, tocineta, queso gratinado.', 23000, 3),
  ('hot-dogs', 'hot-dog-super-especial', 'Super Especial', 'Salchicha, pollo desmechado, carne desmechada, tocineta, cebolla, papa molida, queso gratinado.', 24000, 4),
  ('hot-dogs', 'hot-dog-mega-arca',      'Mega Arca',      'Salchicha, filete de carne, filete de pechuga, chorizo, cebolla, tocineta, papa molida, queso gratinado.', 27000, 5),
  -- Papas Locas
  ('papas-locas', 'papas-locas-estandar',     'Estándar 1.000 grs',    'Papa a la francesa, filete de pechuga, filete de carne, salchicha Zenú, pollo desmechado mezclado con papa ripio y tártara, queso gratinado.', 35000, 1),
  ('papas-locas', 'papas-locas-5-estrellas',  '5 Estrellas 1.200 grs', 'Papa a la francesa, filete de pechuga, filete de carne, salchicha Zenú, pollo desmechado mezclado con papa ripio y tártara, tocineta, queso gratinado.', 41000, 2),
  -- Desgranados
  ('desgranados', 'desgranado-especial',   'Especial',   'Maíz, pollo desmechado, jamón, tocineta, cebolla grille, queso gratinado.', 23000, 1),
  ('desgranados', 'desgranado-colombiano', 'Colombiano', 'Maíz, carne desmechada, chorizo, tocineta, cebolla grille, queso gratinado.', 24000, 2),
  ('desgranados', 'desgranado-mixto',      'Mixto',      'Maíz, pollo desmechado, carne desmechada, salchicha Zenú, tocineta, cebolla grille, queso gratinado.', 25000, 3),
  ('desgranados', 'desgranado-super-arca', 'Super Arca', 'Maíz, filete de pechuga, filete de carne, salchicha americana, chorizo, tocineta, cebolla grille, queso gratinado.', 27000, 4),
  -- Salchipapas
  ('salchipapas', 'salchipapa-personal', 'Personal', 'Tártara, piña, queso rayado.', 17000, 1),
  ('salchipapas', 'salchipapa-especial', 'Especial', 'Pollo desmechado y queso gratinado.', 22000, 2),
  -- Choripapas
  ('choripapas', 'choripapa-personal', 'Personal', 'Tártara, piña, queso rayado.', 18000, 1),
  ('choripapas', 'choripapa-especial', 'Especial', 'Pollo desmechado y queso gratinado.', 24000, 2),
  -- Carnes
  ('carnes', 'patacon-mixto',          'Patacón Mixto',          'Plátano verde, cebolla grille, filete de pechuga en cuadros, filete de carne en cuadros, chorizo, salchicha americana, tocineta y queso gratinado.', 26000, 1),
  ('carnes', 'patacon-especial',       'Patacón Especial',       'Plátano verde, cebolla grille, carne desmechada, pollo desmechado, maíz tierno, chorizo, tocineta, queso gratinado.', 27000, 2),
  ('carnes', 'pechuga-a-la-plancha',   'Pechuga a la Plancha',   '300 gramos de filete de pechuga, papa francesa, croquetas de yuca, ensalada.', 26000, 3),
  ('carnes', 'chatas',                 'Chatas',                 '350 gramos de chatas, papa francesa, arepa santandereana, ensalada.', 30000, 4),
  ('carnes', 'costillas-de-cerdo-bbq', 'Costillas de Cerdo BBQ', '500 gramos de costillas de cerdo, papa francesa, croquetas de yuca y ensalada.', 30000, 5),
  ('carnes', 'picada-x-2',             'Picada x 2',             '500 gr de proteína (lomo de cerdo, carne, pechuga), chorizo, papa a la francesa, cebolla grille, croquetas de yuca, aros de cebolla, arepa amarilla y empanadas vallunas x2.', 45000, 6),
  ('carnes', 'picada-x-3',             'Picada x 3',             '750 gr de proteína (lomo de cerdo, carne, pechuga), chorizo, papa a la francesa, cebolla grille, croquetas de yuca, aros de cebolla, arepa amarilla y empanadas vallunas x3.', 60000, 7),
  -- Bebidas
  ('bebidas', 'limonada-de-panela',  'Limonada de Panela 16 oz', null, 3000, 1),
  ('bebidas', 'botella-de-agua',     'Botella de Agua',          null, 3000, 2),
  ('bebidas', 'gaseosa-pet-400',     'Gaseosa PET 400',          null, 4000, 3),
  ('bebidas', 'mr-tea-pet-500',      'Mr. Tea PET 500',          null, 4000, 4),
  ('bebidas', 'jugo-hit-pet-500',    'Jugo Hit PET 500',         null, 4000, 5),
  ('bebidas', 'jugo-hit-caja-litro', 'Jugo Hit Caja Litro',      null, 7000, 6),
  ('bebidas', 'gaseosa-1-5',         'Gaseosa 1.5',              null, 8000, 7),
  ('bebidas', 'granizada',           'Granizada',                null, 5000, 8),
  ('bebidas', 'granizadas-x-2',      'Granizadas x 2',           null, 8000, 9)
) as p(category_slug, slug, name, description, price, sort_order)
join public.categories c on c.slug = p.category_slug;

-- Productos destacados en la portada (elección inicial, editable desde el panel).
update public.products set is_featured = true
where slug in ('hamburguesa-big-arca', 'hot-dog-mega-arca', 'papas-locas-5-estrellas', 'picada-x-2');

-- ---------------------------------------------------------------------------
-- Variantes por tipo de salchicha (precios exactos de la carta)
-- ---------------------------------------------------------------------------
insert into public.product_variants (product_id, name, price, sort_order)
select pr.id, v.name, v.price, v.sort_order
from (values
  ('hot-dog-clasico',        'Salchicha Zenú',      15000, 1), ('hot-dog-clasico',        'Salchicha Americana', 16000, 2),
  ('hot-dog-especial',       'Salchicha Zenú',      20000, 1), ('hot-dog-especial',       'Salchicha Americana', 21000, 2),
  ('hot-dog-mexicano',       'Salchicha Zenú',      23000, 1), ('hot-dog-mexicano',       'Salchicha Americana', 24000, 2),
  ('hot-dog-super-especial', 'Salchicha Zenú',      24000, 1), ('hot-dog-super-especial', 'Salchicha Americana', 25000, 2),
  ('hot-dog-mega-arca',      'Salchicha Zenú',      27000, 1), ('hot-dog-mega-arca',      'Salchicha Americana', 28000, 2),
  ('salchipapa-personal',    'Salchicha Zenú',      17000, 1), ('salchipapa-personal',    'Salchicha Americana', 18000, 2),
  ('salchipapa-especial',    'Salchicha Zenú',      22000, 1), ('salchipapa-especial',    'Salchicha Americana', 24000, 2)
) as v(product_slug, name, price, sort_order)
join public.products pr on pr.slug = v.product_slug;

-- ---------------------------------------------------------------------------
-- Adicionales (grupo de opciones compartido por todos los platos)
-- ---------------------------------------------------------------------------
insert into public.option_groups (name, min_select, max_select) values ('Adicionales', 0, null);

insert into public.options (group_id, name, price, sort_order)
select g.id, o.name, o.price, o.sort_order
from public.option_groups g
cross join (values
  ('Queso rayado',               2000,  1),
  ('Jalapeños',                  2500,  2),
  ('Salchicha Zenú',             2500,  3),
  ('Queso tajado x 2',           3000,  4),
  ('Queso tajado x 5',           6000,  5),
  ('Aros de cebolla x 3',        3500,  6),
  ('Maíz tierno 100 grs',        4000,  7),
  ('Tocineta',                   3000,  8),
  ('Salchicha americana',        4500,  9),
  ('Chorizo',                    4500, 10),
  ('Filete de pechuga 100 grs',  7000, 11),
  ('Pollo desmechado 100 grs',   7000, 12),
  ('Carne desmechada 100 grs',   8000, 13),
  ('Papa francesa persona (salsas al gusto y queso rayado)', 12000, 14)
) as o(name, price, sort_order)
where g.name = 'Adicionales';

insert into public.product_option_groups (product_id, group_id)
select p.id, g.id
from public.products p
join public.categories c on c.id = p.category_id
cross join public.option_groups g
where g.name = 'Adicionales' and c.slug <> 'bebidas';
