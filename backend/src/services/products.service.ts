import { audit } from '../lib/audit.js'
import { isPgError, pool, PG_FOREIGN_KEY_VIOLATION, PG_UNIQUE_VIOLATION, withTransaction } from '../lib/db.js'
import { HttpError } from '../lib/http-error.js'
import {
  findAdminProduct,
  insertProduct,
  setProductOptionGroups,
  syncVariants,
  updateProductFields,
  type AdminProduct,
  type ProductFields,
} from '../repositories/products.repository.js'

export type ProductInput = ProductFields & {
  variants: { id?: string; name: string; price: string; isActive: boolean }[]
  optionGroupIds: string[]
}

// Convierte errores de la base de datos en mensajes entendibles para el panel.
export function translateDbError(err: unknown): never {
  if (isPgError(err, PG_UNIQUE_VIOLATION)) {
    throw new HttpError(409, 'DUPLICATE', 'Ya existe un registro con ese nombre o identificador', { constraint: err.constraint })
  }
  if (isPgError(err, PG_FOREIGN_KEY_VIOLATION)) {
    throw new HttpError(422, 'INVALID_REFERENCE', 'La categoría o el grupo de opciones elegido no existe', { constraint: err.constraint })
  }
  if (err instanceof Error && err.message.startsWith('VARIANT_NOT_FOUND:')) {
    throw new HttpError(422, 'INVALID_REFERENCE', 'Una de las variantes no pertenece a este producto')
  }
  throw err
}

export async function createProduct(input: ProductInput, actorId: string): Promise<AdminProduct> {
  try {
    const id = await withTransaction(async (client) => {
      const { variants, optionGroupIds, ...fields } = input
      const productId = await insertProduct(client, fields)
      await syncVariants(client, productId, variants)
      await setProductOptionGroups(client, productId, optionGroupIds)
      await audit(client, { actorId, action: 'product.create', entity: 'product', entityId: productId, data: { name: fields.name, price: fields.price } })
      return productId
    })
    return (await findAdminProduct(pool, id))!
  } catch (err) {
    translateDbError(err)
  }
}

export async function updateProduct(id: string, patch: Partial<ProductInput>, actorId: string): Promise<AdminProduct> {
  const before = await findAdminProduct(pool, id)
  if (!before) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'El producto no existe')
  try {
    await withTransaction(async (client) => {
      const { variants, optionGroupIds, ...fields } = patch
      await updateProductFields(client, id, fields)
      if (variants) await syncVariants(client, id, variants)
      if (optionGroupIds) await setProductOptionGroups(client, id, optionGroupIds)

      // Se registra el antes/después de los campos sensibles (precio, estado, stock).
      const tracked = ['price', 'isActive', 'isAvailable', 'trackStock', 'minStock', 'categoryId'] as const
      const changes = Object.fromEntries(
        tracked.filter((key) => fields[key] !== undefined && fields[key] !== before[key]).map((key) => [key, { from: before[key], to: fields[key] }]),
      )
      await audit(client, {
        actorId,
        action: 'product.update',
        entity: 'product',
        entityId: id,
        data: { changes, variantsChanged: Boolean(variants), optionGroupsChanged: Boolean(optionGroupIds) },
      })
    })
  } catch (err) {
    translateDbError(err)
  }
  return (await findAdminProduct(pool, id))!
}
