import { z } from 'zod'

// Todas las variables de entorno pasan por aquí. Si falta algo obligatorio,
// el servidor no arranca y dice exactamente qué falta.
const envSchema = z.object({
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
  // Se vuelven obligatorias en la Fase 3, cuando el backend se conecte a la base de datos.
  DATABASE_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
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
