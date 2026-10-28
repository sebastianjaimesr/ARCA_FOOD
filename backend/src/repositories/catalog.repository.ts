import type { CatalogProduct } from '../domain/pricing.js'
import type { Db } from '../lib/db.js'

// Un producto se puede vender si está activo, disponible, su categoría está
// activa y (cuando controla stock) le quedan existencias.
const SELLABLE_SQL = `(p.is_active and p.is_available and c.is_active and (not p.track_stock or p.stock_quantity > 0))`

// JSON de variantes y grupos de opciones de un producto (solo lo activo).
const PRODUCT_DETAILS_SQL = `
  coalesce((
    select json_agg(json_build_object('id', v.id, 'name', v.name, 'price', v.price::text) order by v.sort_order, v.name)
    from public.product_variants v
    where v.product_id = p.id and v.is_active
  ), '[]') as variants,
  coalesce((
    select json_agg(json_build_object(
      'id', g.id, 'name', g.name, 'minSelect', g.min_select, 'maxSelect', g.max_select,
      'options', coalesce((
        select json_agg(json_build_object('id', o.id, 'name', o.name, 'price', o.price::text) order by o.sort_order, o.name)
        from public.options o where o.group_id = g.id and o.is_active
      ), '[]')
    ) order by pog.sort_order, g.name)
    from public.product_option_groups pog
    join public.option_groups g on g.id = pog.group_id and g.is_active
    where pog.product_id = p.id
  ), '[]') as option_groups`

export type PublicCategory = { id: string; slug: string; name: string; description: string | null }

export type PublicProduct = {
  id: string
  slug: string
  name: string
  description: string | null
  price: string
  imageUrl: string | null
  imageAlt: string | null
  isFeatured: boolean
  available: boolean
  category: { id: string; slug: string; name: string }
  variants: { id: string; name: string; price: string }[]
  optionGroups: {
    id: string
    name: string
    minSelect: number
    maxSelect: number | null
    options: { id: string; name: string; price: string }[]
  }[]
}

type ProductRow = {
  id: string
  slug: string
  name: string
  description: string | null
  price: string
  image_url: string | null
  image_alt: string | null
  is_featured: boolean
  sellable: boolean
  category_id: string
  category_slug: string
  category_name: string
  variants: PublicProduct['variants']
  option_groups: PublicProduct['optionGroups']
}

const mapProduct = (row: ProductRow): PublicProduct => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description,
  price: row.price,
  imageUrl: row.image_url,
  imageAlt: row.image_alt,
  isFeatured: row.is_featured,
  available: row.sellable,
  category: { id: row.category_id, slug: row.category_slug, name: row.category_name },
  variants: row.variants,
  optionGroups: row.option_groups,
})

const PUBLIC_PRODUCT_SELECT = `
  select p.id, p.slug, p.name, p.description, p.price::text as price, p.image_url, p.image_alt,
         p.is_featured, ${SELLABLE_SQL} as sellable,
         c.id as category_id, c.slug as category_slug, c.name as category_name,
         ${PRODUCT_DETAILS_SQL}
  from public.products p
  join public.categories c on c.id = p.category_id`

export async function listPublicCategories(db: Db): Promise<PublicCategory[]> {
  const { rows } = await db.query<PublicCategory>(
    `select id, slug, name, description from public.categories where is_active order by sort_order, name`,
  )
  return rows
}

// Escapa los comodines de LIKE para que la búsqueda sea literal.
const escapeLike = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`)

export async function listPublicProducts(
  db: Db,
  filters: { categorySlug?: string; q?: string; featured?: boolean },
): Promise<PublicProduct[]> {
  const params: unknown[] = []
  const where = ['p.is_active', 'c.is_active']
  if (filters.categorySlug) {
    params.push(filters.categorySlug)
    where.push(`c.slug = $${params.length}`)
  }
  if (filters.q) {
    params.push(`%${escapeLike(filters.q)}%`)
    where.push(`(p.name ilike $${params.length} or p.description ilike $${params.length} or c.name ilike $${params.length})`)
  }
  if (filters.featured) where.push('p.is_featured')

  const { rows } = await db.query<ProductRow>(
    `${PUBLIC_PRODUCT_SELECT} where ${where.join(' and ')} order by c.sort_order, p.sort_order, p.name`,
    params,
  )
  return rows.map(mapProduct)
}

export async function findPublicProductBySlug(db: Db, slug: string): Promise<PublicProduct | null> {
  const { rows } = await db.query<ProductRow>(
    `${PUBLIC_PRODUCT_SELECT} where p.slug = $1 and p.is_active and c.is_active`,
    [slug],
  )
  return rows[0] ? mapProduct(rows[0]) : null
}

// Catálogo vigente de los productos de un carrito, para calcular precios.
export async function loadCatalogForCart(db: Db, productIds: string[]): Promise<Map<string, CatalogProduct>> {
  const { rows } = await db.query<
    Omit<ProductRow, 'image_url' | 'image_alt' | 'is_featured' | 'slug' | 'description' | 'category_slug' | 'category_name'> & {
      track_stock: boolean
      stock_quantity: number
    }
  >(
    `select p.id, p.name, p.price::text as price, p.track_stock, p.stock_quantity, ${SELLABLE_SQL} as sellable,
            c.id as category_id, ${PRODUCT_DETAILS_SQL}
     from public.products p
     join public.categories c on c.id = p.category_id
     where p.id = any($1::uuid[])`,
    [productIds],
  )

  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        price: row.price,
        sellable: row.sellable,
        trackStock: row.track_stock,
        stockQuantity: row.stock_quantity,
        variants: row.variants,
        optionGroups: row.option_groups.map(({ options: _o, ...group }) => group),
        options: row.option_groups.flatMap((group) =>
          group.options.map((option) => ({ ...option, groupId: group.id, groupName: group.name })),
        ),
      },
    ]),
  )
}
