import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { Alert, Button, Field, Loading, PageHeader, Panel, Select, TextArea, TextInput, Toggle } from '../../components/admin/ui'
import { useIsAdmin } from '../../features/auth/useIsAdmin'
import { useAdminData } from '../../hooks/useAdminData'
import { adminApi, errorMessage } from '../../services/admin'
import type { AdminCategory, AdminOptionGroup, AdminProduct } from '../../types/admin'

const money = z
  .string()
  .trim()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, 'Escribe el valor en pesos, sin puntos (ej. 26500)')

const productSchema = z
  .object({
    name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80),
    categoryId: z.string().min(1, 'Elige una categoría'),
    description: z.string().trim().max(500, 'Máximo 500 caracteres'),
    price: money,
    imageUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === '' || v.startsWith('https://') || v.startsWith('/'), 'Debe ser una dirección https://'),
    imageAlt: z.string().trim().max(200),
    isActive: z.boolean(),
    isAvailable: z.boolean(),
    isFeatured: z.boolean(),
    sortOrder: z.coerce.number().int().min(0).max(10000),
    trackStock: z.boolean(),
    minStock: z.coerce.number().int().min(0, 'No puede ser negativo').max(100000),
    variants: z.array(z.object({ id: z.string().optional(), name: z.string().trim().min(1, 'Escribe el nombre').max(60), price: money, isActive: z.boolean() })),
    optionGroupIds: z.array(z.string()),
  })
  .refine((p) => new Set(p.variants.map((v) => v.name.toLowerCase())).size === p.variants.length, {
    path: ['variants'],
    message: 'Las variantes no pueden repetir nombre',
  })

type FormInput = z.input<typeof productSchema>
type FormValues = z.output<typeof productSchema>

const toForm = (p?: AdminProduct): FormInput => ({
  name: p?.name ?? '',
  categoryId: p?.categoryId ?? '',
  description: p?.description ?? '',
  price: p ? String(Number(p.price)) : '',
  imageUrl: p?.imageUrl ?? '',
  imageAlt: p?.imageAlt ?? '',
  isActive: p?.isActive ?? true,
  isAvailable: p?.isAvailable ?? true,
  isFeatured: p?.isFeatured ?? false,
  sortOrder: p?.sortOrder ?? 0,
  trackStock: p?.trackStock ?? false,
  minStock: p?.minStock ?? 0,
  variants: (p?.variants ?? []).map((v) => ({ id: v.id, name: v.name, price: String(Number(v.price)), isActive: v.isActive })),
  optionGroupIds: p?.optionGroupIds ?? [],
})

export function AdminProductFormPage() {
  const { id } = useParams()
  const isNew = !id
  const product = useAdminData(() => (id ? adminApi.product(id) : Promise.resolve(undefined)), [id])
  const categories = useAdminData(() => adminApi.categories(), [])
  const groups = useAdminData(() => adminApi.optionGroups(), [])

  if (product.status === 'error') return <Alert tone="error">{product.error}</Alert>
  // Al pasar de /nuevo a /productos/:id (tras crear) se espera a tener los datos
  // de ESTE producto: si no, el formulario se armaría vacío.
  const stale = id !== undefined && product.data?.id !== id
  if (product.status === 'loading' || stale || !categories.data || !groups.data) return <Loading />

  return (
    <ProductForm
      // key: al cambiar de producto el formulario se reinicia con sus datos.
      key={id ?? 'nuevo'}
      isNew={isNew}
      product={product.data}
      categories={categories.data}
      groups={groups.data}
    />
  )
}

function ProductForm({
  isNew,
  product,
  categories,
  groups,
}: {
  isNew: boolean
  product?: AdminProduct
  categories: AdminCategory[]
  groups: AdminOptionGroup[]
}) {
  const isAdmin = useIsAdmin()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(productSchema), defaultValues: toForm(product) })
  // keyName: "key" para que RHF no pise el "id" real de cada variante guardada.
  const variants = useFieldArray({ control, name: 'variants', keyName: 'key' })
  const [imageUrl, trackStock, isActive] = useWatch({ control, name: ['imageUrl', 'trackStock', 'isActive'] })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    setSaved(false)
    const body = {
      ...values,
      description: values.description || null,
      imageUrl: values.imageUrl || null,
      imageAlt: values.imageAlt || null,
    }
    try {
      const result = isNew ? await adminApi.createProduct(body) : await adminApi.updateProduct(product!.id, body)
      if (isNew) navigate(`/admin/productos/${result.id}`, { replace: true })
      else {
        reset(toForm(result))
        setSaved(true)
      }
    } catch (err) {
      setError(errorMessage(err))
    }
  })

  const readOnly = !isAdmin

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-4xl">
      <Link to="/admin/productos" className="inline-flex items-center gap-1.5 text-sm font-semibold text-cream-300 hover:text-brand-400">
        <ArrowLeft className="size-4" aria-hidden /> Productos
      </Link>
      <div className="mt-3">
        <PageHeader
          title={isNew ? 'Nuevo producto' : (product?.name ?? '')}
          description={readOnly ? 'Solo un administrador puede editar productos.' : undefined}
          actions={
            !readOnly && (
              <Button type="submit" variant="primary" loading={isSubmitting} disabled={!isNew && !isDirty}>
                <Save className="size-4" aria-hidden /> {isNew ? 'Crear producto' : 'Guardar cambios'}
              </Button>
            )
          }
        />
      </div>

      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        {saved && <Alert tone="success">Cambios guardados. La tienda ya muestra la información nueva.</Alert>}
      </div>

      <fieldset disabled={readOnly} className="mt-4 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="Información">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre" error={errors.name?.message} className="sm:col-span-2">
                <TextInput {...register('name')} aria-invalid={!!errors.name} />
              </Field>
              <Field label="Categoría" error={errors.categoryId?.message}>
                <Select {...register('categoryId')} aria-invalid={!!errors.categoryId}>
                  <option value="">Elige una categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.isActive ? '' : ' (inactiva)'}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Precio base (COP)" error={errors.price?.message} hint="Si tiene variantes, se usa el precio de la variante.">
                <TextInput inputMode="numeric" {...register('price')} aria-invalid={!!errors.price} />
              </Field>
              <Field label="Descripción" error={errors.description?.message} className="sm:col-span-2">
                <TextArea rows={3} {...register('description')} />
              </Field>
              <Field label="Orden en el menú" hint="Menor número = aparece primero.">
                <TextInput type="number" min={0} {...register('sortOrder')} />
              </Field>
            </div>
          </Panel>

          <Panel
            title="Variantes"
            actions={
              !readOnly && (
                <Button variant="ghost" onClick={() => variants.append({ name: '', price: '', isActive: true })}>
                  <Plus className="size-4" aria-hidden /> Agregar
                </Button>
              )
            }
          >
            <p className="mb-3 text-xs text-cream-300">
              Úsalas cuando el precio cambia según la opción (ej. salchicha Zenú o Americana). El cliente debe elegir una.
            </p>
            {variants.fields.length === 0 && <p className="text-sm text-cream-300">Sin variantes.</p>}
            <div className="space-y-2">
              {variants.fields.map((field, index) => (
                <div key={field.key} className="grid grid-cols-[1fr_120px_auto] items-start gap-2">
                  <TextInput placeholder="Nombre" aria-label="Nombre de la variante" {...register(`variants.${index}.name`)} className="mt-0" />
                  <TextInput placeholder="Precio" inputMode="numeric" aria-label="Precio de la variante" {...register(`variants.${index}.price`)} className="mt-0" />
                  {field.id ? (
                    <label className="flex h-9 items-center gap-1.5 text-xs text-cream-300">
                      <input type="checkbox" className="accent-brand-500" {...register(`variants.${index}.isActive`)} /> Activa
                    </label>
                  ) : (
                    <Button variant="ghost" onClick={() => variants.remove(index)} aria-label="Quitar variante">
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  )}
                  {(errors.variants?.[index]?.name || errors.variants?.[index]?.price) && (
                    <p className="col-span-3 text-xs text-red-400">
                      {errors.variants?.[index]?.name?.message ?? errors.variants?.[index]?.price?.message}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {errors.variants?.message && <p className="mt-2 text-xs text-red-400">{errors.variants.message}</p>}
            <p className="mt-3 text-xs text-cream-300">Las variantes guardadas no se borran (pueden estar en pedidos anteriores): se desactivan.</p>
          </Panel>

          <Panel title="Grupos de adicionales">
            <Controller
              control={control}
              name="optionGroupIds"
              render={({ field }) => (
                <div className="space-y-2">
                  {groups.map((g) => (
                    <label key={g.id} className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-brand-500"
                        checked={field.value.includes(g.id)}
                        onChange={(e) => field.onChange(e.target.checked ? [...field.value, g.id] : field.value.filter((x) => x !== g.id))}
                      />
                      <span className="text-cream-50">{g.name}</span>
                      <span className="text-xs text-cream-300">
                        {g.options.filter((o) => o.isActive).length} opciones{g.isActive ? '' : ' · inactivo'}
                      </span>
                    </label>
                  ))}
                  {groups.length === 0 && <p className="text-sm text-cream-300">No hay grupos creados.</p>}
                </div>
              )}
            />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Estado en la tienda">
            <div className="space-y-4">
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Toggle checked={field.value} onChange={field.onChange} disabled={readOnly} label="Activo" description="Si se desactiva, desaparece de la tienda y no se puede pedir." />
                )}
              />
              <Controller
                control={control}
                name="isAvailable"
                render={({ field }) => (
                  <Toggle
                    checked={field.value}
                    onChange={field.onChange}
                    disabled={readOnly || !isActive}
                    label="Disponible"
                    description="Si no, se muestra como agotado."
                  />
                )}
              />
              <Controller
                control={control}
                name="isFeatured"
                render={({ field }) => (
                  <Toggle checked={field.value} onChange={field.onChange} disabled={readOnly} label="Destacado" description="Aparece en la portada." />
                )}
              />
            </div>
          </Panel>

          <Panel title="Inventario">
            <div className="space-y-4">
              <Controller
                control={control}
                name="trackStock"
                render={({ field }) => (
                  <Toggle
                    checked={field.value}
                    onChange={field.onChange}
                    disabled={readOnly}
                    label="Controlar existencias"
                    description="Para productos terminados que se cuentan por unidad (ej. bebidas)."
                  />
                )}
              />
              {trackStock && (
                <>
                  <Field label="Cantidad mínima" error={errors.minStock?.message} hint="Debajo de esta cantidad aparece la alerta de stock bajo.">
                    <TextInput type="number" min={0} {...register('minStock')} />
                  </Field>
                  <p className="text-xs text-cream-300">
                    Existencias actuales: <strong className="text-cream-50">{product?.stockQuantity ?? 0}</strong>. Se cambian desde{' '}
                    <Link to="/admin/inventario" className="text-brand-400 hover:underline">
                      Inventario
                    </Link>{' '}
                    con un movimiento (entrada, salida o ajuste). Con 0 existencias el producto se muestra agotado.
                  </p>
                </>
              )}
            </div>
          </Panel>

          <Panel title="Imagen">
            <div className="space-y-4">
              <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-xl bg-ink-800 text-xs text-cream-300">
                {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : 'Sin foto: se muestra la ilustración de la categoría'}
              </div>
              <Field label="Dirección de la imagen" error={errors.imageUrl?.message} hint="Enlace https de una foto real del producto. La subida directa (Cloudinary) se activa al configurar las credenciales.">
                <TextInput placeholder="https://…" {...register('imageUrl')} />
              </Field>
              <Field label="Texto alternativo" hint="Describe la foto para lectores de pantalla.">
                <TextInput {...register('imageAlt')} />
              </Field>
            </div>
          </Panel>
        </div>
      </fieldset>
    </form>
  )
}
