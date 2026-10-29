import { z } from 'zod'

// Mismas reglas que el backend (backend/src/validators/orders.validators.ts),
// para avisar al cliente antes de enviar. El backend vuelve a validar todo.
export const checkoutSchema = (opts: { requireZone: boolean }) =>
  z
    .object({
      customerName: z.string().trim().min(2, 'Escribe tu nombre').max(80, 'Máximo 80 caracteres'),
      customerPhone: z
        .string()
        .transform((v) => {
          const digits = v.replace(/\D/g, '')
          return digits.length === 12 && digits.startsWith('57') ? digits.slice(2) : digits
        })
        .refine((d) => /^(3\d{9}|60\d{8})$/.test(d), 'Escribe un celular de 10 dígitos, por ejemplo 300 123 4567'),
      fulfillment: z.enum(['DOMICILIO', 'RECOGIDA'], { message: 'Elige cómo quieres recibir tu pedido' }),
      deliveryZoneId: z.string().optional(),
      deliveryAddress: z.string().trim().max(200, 'Máximo 200 caracteres').optional(),
      deliveryReference: z.string().trim().max(200, 'Máximo 200 caracteres').optional(),
      notes: z.string().trim().max(500, 'Máximo 500 caracteres').optional(),
    })
    .superRefine((value, ctx) => {
      if (value.fulfillment !== 'DOMICILIO') return
      if (!value.deliveryAddress || value.deliveryAddress.length < 5) {
        ctx.addIssue({ code: 'custom', path: ['deliveryAddress'], message: 'Escribe la dirección de entrega' })
      }
      if (opts.requireZone && !value.deliveryZoneId) {
        ctx.addIssue({ code: 'custom', path: ['deliveryZoneId'], message: 'Elige tu barrio o zona' })
      }
    })

export type CheckoutInput = z.input<ReturnType<typeof checkoutSchema>>
export type CheckoutValues = z.output<ReturnType<typeof checkoutSchema>>
