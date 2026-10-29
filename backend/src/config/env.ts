import { z } from 'zod'

// Todas las variables de entorno pasan por aquí. Si falta algo obligatorio,
// el servidor no arranca y dice exactamente qué falta.
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    // Lista separada por comas de orígenes permitidos (CORS).
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    // Conexión directa a PostgreSQL (rol de servidor, no pasa por la API REST de Supabase).
    DATABASE_URL: z.string().url().optional(),
    // Solo se usa para validar los tokens de sesión del panel.
    SUPABASE_URL: z.string().url().optional(),
    // Clave service_role: SOLO en el backend.
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    // Cifrado de la conexión a PostgreSQL:
    //   disable     → sin TLS (solo Supabase local)
    //   require     → TLS sin verificar el certificado (mínimo aceptable)
    //   verify-full → TLS verificando el certificado con DATABASE_CA_CERT (recomendado)
    DATABASE_SSL: z.enum(['disable', 'require', 'verify-full']).default('disable'),
    // Certificado raíz de Supabase (PEM). Se descarga en Project Settings → Database.
    // Se acepta con "\n" literales para poder pegarlo en una sola línea.
    DATABASE_CA_CERT: z
      .string()
      .optional()
      .transform((value) => value?.replace(/\\n/g, '\n')),
    // Cuántos proxies hay delante del servidor (el del hosting). Con 0, la IP
    // del cliente es la de la conexión y X-Forwarded-For se ignora; así nadie
    // puede falsearla para saltarse el límite de solicitudes.
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  })
  .superRefine((value, ctx) => {
    // En las pruebas unitarias no hace falta base de datos.
    if (value.NODE_ENV === 'test') return
    for (const key of ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const) {
      if (!value[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'es obligatoria' })
    }
    if (value.DATABASE_SSL === 'verify-full' && !value.DATABASE_CA_CERT?.includes('BEGIN CERTIFICATE')) {
      ctx.addIssue({ code: 'custom', path: ['DATABASE_CA_CERT'], message: 'es obligatoria con DATABASE_SSL=verify-full' })
    }
    if (value.NODE_ENV === 'production') {
      // En producción la base está en la nube: nunca sin cifrar.
      if (value.DATABASE_SSL === 'disable') {
        ctx.addIssue({ code: 'custom', path: ['DATABASE_SSL'], message: 'no puede ser "disable" en producción' })
      }
      if (value.CORS_ORIGINS.some((origin) => !origin.startsWith('https://'))) {
        ctx.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'en producción solo se permiten orígenes https://' })
      }
    }
  })

export type Env = z.infer<typeof envSchema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // En un .env, "CLAVE=" llega como cadena vacía; la tratamos como no definida.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''))
  const parsed = envSchema.safeParse(cleaned)
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    throw new Error(`Variables de entorno inválidas:\n${problems.join('\n')}`)
  }
  return parsed.data
}

export const env = loadEnv()
