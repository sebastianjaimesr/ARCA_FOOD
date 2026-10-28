import type pg from 'pg'
import type { Db } from '../lib/db.js'

export type AdminVariant = { id: string; name: string; price: string; isActive: boolean; sortOrder: number }

export type AdminProduct = {
  id: string
  categoryId: string
  categoryName: string
  slug: string
  name: string
  description: string | null
  price: string
  imageUrl: string | null
  imageAlt: string | null
  isActive: boolean
  isAvailable: boolean
  isFeatured: boolean
  sortOrder: number
  trackStock: boolean
  stockQuantity: number
  minStock: number
  variants: AdminVariant[]
  optionGroupIds: string[]
  updatedAt: string
}

const ADMIN_PRODUCT_SELECT = `
  select p.id, p.category_id as "categoryId", c.name as "categoryName", p.slug, p.name, p.description,
         p.price::text as price, p.image_url as "imageUrl", p.image_alt as "imageAlt",
         p.is_active as "isActive", p.is_available as "isAvailable", p.is_featured as "isFeatured",
         p.sort_order as "sortOrder", p.track_stock as "trackStock", p.stock_quantity as "stockQuantity",
         p.min_stock as "minStock", p.updated_at as "updatedAt",
         coalesce((
           select json_agg(json_build_object('id', v.id, 'name', v.name, 'price', v.price::text,
                                             'isActive', v.is_active, 'sortOrder', v.sort_order) order by v.sort_order, v.name)
           from public.product_variants v where v.product_id = p.id
         ), '[]') as variants,
         coalesce((
           select json_agg(pog.group_id order by pog.sort_order) from public.product_option_groups pog where pog.product_id = p.id
         ), '[]') as "optionGroupIds"
  from public.products p
  join public.categories c on c.id = p.category_id`

export async function listAdminProducts(
  db: Db,
  filters: { q?: string; categoryId?: string; status?: 'active' | 'inactive' | 'all' },
): Promise<AdminProduct[]> {
  const params: unknown[] = []
  const where: string[] = []
  if (filters.q) {
    params.push(`%${filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
    where.push(`(p.name ilike $${params.length} or p.slug ilike $${params.length})`)
  }
  if (filters.categoryId) {
    params.push(filters.categoryId)
    where.push(`p.category_id = $${params.length}`)
  }
  if (filters.status === 'active') where.push('p.is_active')
  if (filters.status === 'inactive') where.push('not p.is_active')
  const { rows } = await db.query<AdminProduct>(
    `${ADMIN_PRODUCT_SELECT} ${where.length ? `where ${where.join(' and ')}` : ''} order by c.sort_order, p.sort_order, p.name`,
    params,
  )
  return rows
}

export async function findAdminProduct(db: Db, id: string): Promise<AdminProduct | null> {
  const { rows } = await db.query<AdminProduct>(`${ADMIN_PRODUCT_SELECT} where p.id = $1`, [id])
  return rows[0] ?? null
}

export type ProductFields = {
  categoryId: string
  slug: string
  name: string
  description: string | null
  price: string
  imageUrl: string | null
  imageAlt: string | null
  isActive: boolean
  isAvailable: boolean
  isFeatured: boolean
  sortOrder: number
  trackStock: boolean
  minStock: number
}

const PRODUCT_COLUMNS: Record<keyof ProductFields, string> = {
  categoryId: 'category_id',
  slug: 'slug',
  name: 'name',
  description: 'description',
  price: 'price',
  imageUrl: 'image_url',
  imageAlt: 'image_alt',
  isActive: 'is_active',
  isAvailable: 'is_available',
  isFeatured: 'is_featured',
  sortOrder: 'sort_order',
  trackStock: 'track_stock',
  minStock: 'min_stock',
}

export async function insertProduct(client: pg.PoolClient, fields: ProductFields): Promise<string> {
  const keys = Object.keys(PRODUCT_COLUMNS) as (keyof ProductFields)[]
  const { rows } = await client.query<{ id: string }>(
    `insert into public.products (${keys.map((k) => PRODUCT_COLUMNS[k]).join(', ')})
     values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    keys.map((k) => fields[k]),
  )
  return rows[0]!.id
}

export async function updateProductFields(client: pg.PoolClient, id: string, patch: Partial<ProductFields>) {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as [keyof ProductFields, unknown][]
  if (entries.length === 0) return
  await client.query(
    `update public.products set ${entries.map(([k], i) => `${PRODUCT_COLUMNS[k]} = $${i + 2}`).join(', ')} where id = $1`,
    [id, ...entries.map(([, v]) => v)],
  )
}

// Variantes: las que vienen con id se actualizan, las nuevas se insertan y las
// que ya no vienen se DESACTIVAN (pueden estar en pedidos históricos).
export async function syncVariants(
  client: pg.PoolClient,
  productId: string,
  variants: { id?: string; name: string; price: string; isActive: boolean }[],
) {
  const keptIds: string[] = []
  for (const [index, variant] of variants.entries()) {
    if (variant.id) {
      const { rowCount } = await client.query(
        `update public.product_variants set name = $3, price = $4, is_active = $5, sort_order = $6
         where id = $1 and product_id = $2`,
        [variant.id, productId, variant.name, variant.price, variant.isActive, index + 1],
      )
      if (rowCount === 0) throw new Error(`VARIANT_NOT_FOUND:${variant.id}`)
      keptIds.push(variant.id)
    } else {
      const { rows } = await client.query<{ id: string }>(
        `insert into public.product_variants (product_id, name, price, is_active, sort_order)
         values ($1, $2, $3, $4, $5) returning id`,
        [productId, variant.name, variant.price, variant.isActive, index + 1],
      )
      keptIds.push(rows[0]!.id)
    }
  }
  await client.query(
    'update public.product_variants set is_active = false where product_id = $1 and not (id = any($2::uuid[]))',
    [productId, keptIds],
  )
}

export async function setProductOptionGroups(client: pg.PoolClient, productId: string, groupIds: string[]) {
  await client.query('delete from public.product_option_groups where product_id = $1', [productId])
  for (const [index, groupId] of groupIds.entries()) {
    await client.query('insert into public.product_option_groups (product_id, group_id, sort_order) values ($1, $2, $3)', [
      productId,
      groupId,
      index,
    ])
  }
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------
export type AdminCategory = {
  id: string
  slug: string
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  productsCount: number
}

const ADMIN_CATEGORY_SELECT = `
  select c.id, c.slug, c.name, c.description, c.sort_order as "sortOrder", c.is_active as "isActive",
         (select count(*)::int from public.products p where p.category_id = c.id) as "productsCount"
  from public.categories c`

export async function listAdminCategories(db: Db): Promise<AdminCategory[]> {
  const { rows } = await db.query<AdminCategory>(`${ADMIN_CATEGORY_SELECT} order by c.sort_order, c.name`)
  return rows
}

export async function findAdminCategory(db: Db, id: string): Promise<AdminCategory | null> {
  const { rows } = await db.query<AdminCategory>(`${ADMIN_CATEGORY_SELECT} where c.id = $1`, [id])
  return rows[0] ?? null
}

type CategoryFields = Omit<AdminCategory, 'id' | 'productsCount'>
const CATEGORY_COLUMNS: Record<keyof CategoryFields, string> = {
  slug: 'slug',
  name: 'name',
  description: 'description',
  sortOrder: 'sort_order',
  isActive: 'is_active',
}

export async function insertCategory(db: Db, fields: CategoryFields): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'insert into public.categories (slug, name, description, sort_order, is_active) values ($1, $2, $3, $4, $5) returning id',
    [fields.slug, fields.name, fields.description, fields.sortOrder, fields.isActive],
  )
  return rows[0]!.id
}

export async function updateCategory(db: Db, id: string, patch: Partial<CategoryFields>) {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as [keyof CategoryFields, unknown][]
  if (entries.length === 0) return
  await db.query(
    `update public.categories set ${entries.map(([k], i) => `${CATEGORY_COLUMNS[k]} = $${i + 2}`).join(', ')} where id = $1`,
    [id, ...entries.map(([, v]) => v)],
  )
}

// ---------------------------------------------------------------------------
// Grupos de opciones y opciones (adicionales, salsas…)
// ---------------------------------------------------------------------------
export type AdminOptionGroup = {
  id: string
  name: string
  minSelect: number
  maxSelect: number | null
  isActive: boolean
  options: { id: string; name: string; price: string; isActive: boolean; sortOrder: number }[]
}

export async function listOptionGroups(db: Db): Promise<AdminOptionGroup[]> {
  const { rows } = await db.query<AdminOptionGroup>(
    `select g.id, g.name, g.min_select as "minSelect", g.max_select as "maxSelect", g.is_active as "isActive",
            coalesce((
              select json_agg(json_build_object('id', o.id, 'name', o.name, 'price', o.price::text,
                                                'isActive', o.is_active, 'sortOrder', o.sort_order) order by o.sort_order, o.name)
              from public.options o where o.group_id = g.id
            ), '[]') as options
     from public.option_groups g order by g.name`,
  )
  return rows
}

export async function insertOptionGroup(db: Db, group: { name: string; minSelect: number; maxSelect: number | null }) {
  const { rows } = await db.query<{ id: string }>(
    'insert into public.option_groups (name, min_select, max_select) values ($1, $2, $3) returning id',
    [group.name, group.minSelect, group.maxSelect],
  )
  return rows[0]!.id
}

export async function updateOptionGroup(
  db: Db,
  id: string,
  patch: Partial<{ name: string; minSelect: number; maxSelect: number | null; isActive: boolean }>,
) {
  const columns = { name: 'name', minSelect: 'min_select', maxSelect: 'max_select', isActive: 'is_active' } as const
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as [keyof typeof columns, unknown][]
  if (entries.length === 0) return 0
  const { rowCount } = await db.query(
    `update public.option_groups set ${entries.map(([k], i) => `${columns[k]} = $${i + 2}`).join(', ')} where id = $1`,
    [id, ...entries.map(([, v]) => v)],
  )
  return rowCount ?? 0
}

export async function insertOption(db: Db, groupId: string, option: { name: string; price: string; sortOrder: number }) {
  const { rows } = await db.query<{ id: string }>(
    'insert into public.options (group_id, name, price, sort_order) values ($1, $2, $3, $4) returning id',
    [groupId, option.name, option.price, option.sortOrder],
  )
  return rows[0]!.id
}

export async function updateOption(
  db: Db,
  id: string,
  patch: Partial<{ name: string; price: string; isActive: boolean; sortOrder: number }>,
) {
  const columns = { name: 'name', price: 'price', isActive: 'is_active', sortOrder: 'sort_order' } as const
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as [keyof typeof columns, unknown][]
  if (entries.length === 0) return 0
  const { rowCount } = await db.query(
    `update public.options set ${entries.map(([k], i) => `${columns[k]} = $${i + 2}`).join(', ')} where id = $1`,
    [id, ...entries.map(([, v]) => v)],
  )
  return rowCount ?? 0
}
