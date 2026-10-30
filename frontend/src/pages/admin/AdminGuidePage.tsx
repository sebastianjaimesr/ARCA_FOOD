import { AlertTriangle, CheckCircle2, Database, Download, ExternalLink, Flame, RotateCcw, ShieldCheck } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Alert, Button, PageHeader, Panel } from '../../components/admin/ui'
import { STATIC_MODE } from '../../config/mode'

const REPO = 'https://github.com/sebastianjaimesr/ARCA_FOOD/blob/main'

// Guía de arquitectura y producción dentro del panel: explica qué hace el modo
// actual y cómo pasar a una base de datos real (Supabase recomendado).
export function AdminGuidePage() {
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Guía de producción"
        description="Cómo funciona esta versión y cómo conectar una base de datos real cuando el restaurante empiece a recibir pedidos en línea."
      />

      <Panel title="Estado actual">
        {STATIC_MODE ? (
          <div className="space-y-3 text-sm text-cream-100">
            <Alert tone="warning">
              <strong>Modo demostración.</strong> Pedidos, menú y configuración se guardan en el LocalStorage de <em>este navegador</em>.
            </Alert>
            <ul className="space-y-2">
              <Point ok>La tienda y este panel, abiertos en el mismo navegador, se sincronizan al instante (también entre pestañas).</Point>
              <Point ok>Precios, variantes, adicionales y estados del pedido usan exactamente las reglas del backend.</Point>
              <Point>Un pedido hecho desde el celular de un cliente <strong>no llega</strong> a este panel: cada navegador tiene sus propios datos. El restaurante recibe esos pedidos por WhatsApp.</Point>
              <Point>Si se borran los datos del navegador, se pierden los pedidos y cambios guardados aquí.</Point>
              <Point>El inicio de sesión se verifica en el navegador (el código del sitio es público): no es seguridad real.</Point>
            </ul>
          </div>
        ) : (
          <Alert tone="success">Modo completo: datos en PostgreSQL (Supabase), sesión con Supabase Auth y reglas aplicadas en el backend.</Alert>
        )}
      </Panel>

      <Panel title="Ruta recomendada: Supabase (ya implementada en este proyecto)">
        <div className="space-y-4 text-sm text-cream-100">
          <p className="flex items-start gap-2">
            <Database className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden />
            El repositorio ya trae la base de datos (migraciones con la carta, seguridad RLS, pruebas), la API en Express y el panel con
            Supabase Auth. Pasar a producción es configurar servicios, no reescribir la aplicación.
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-cream-300">
            <li>
              Crear el proyecto en Supabase (región São Paulo) y aplicar las migraciones con <Code>npx supabase db push</Code>.
            </li>
            <li>Desactivar el registro público en Supabase Auth y crear la cuenta del administrador.</li>
            <li>
              Publicar la API con <Code>backend/Dockerfile</Code> (Render, Railway o Fly) con <Code>NODE_ENV=production</Code>, TLS hacia la base y CORS
              solo para el dominio de la tienda.
            </li>
            <li>
              Compilar la tienda <strong>sin</strong> <Code>VITE_STATIC_MODE</Code> y con <Code>VITE_API_URL</Code>, <Code>VITE_SUPABASE_URL</Code> y{' '}
              <Code>VITE_SUPABASE_ANON_KEY</Code>. La tienda puede seguir en GitHub Pages o pasar a Vercel/Cloudflare Pages.
            </li>
            <li>
              Verificar con <Code>node scripts/smoke.mjs</Code> y completar la lista de verificación antes de anunciarlo.
            </li>
          </ol>
          <a
            href={`${REPO}/docs/despliegue.md`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-brand-400 hover:underline"
          >
            Guía completa de despliegue <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      </Panel>

      <Panel title="Alternativa: Firebase">
        <div className="space-y-3 text-sm text-cream-100">
          <p className="flex items-start gap-2">
            <Flame className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden />
            Firebase (Firestore + Authentication) también funciona con GitHub Pages o Vercel, pero en este proyecto implicaría rehacer la capa
            de datos:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-cream-300">
            <li>Reescribir pedidos, menú y estadísticas para Firestore (hoy son tablas relacionales con transacciones).</li>
            <li>
              Calcular precios y crear pedidos en <strong>Cloud Functions</strong>: si el navegador escribe el pedido directamente, un cliente
              podría cambiar el precio.
            </li>
            <li>Escribir reglas de seguridad de Firestore equivalentes a los roles admin/staff.</li>
            <li>Rehacer el inventario transaccional y las estadísticas (Firestore no tiene consultas de agregación como SQL).</li>
          </ul>
          <p className="text-cream-300">Recomendación: Supabase, porque la base de datos, la API y las pruebas ya existen.</p>
        </div>
      </Panel>

      <Panel title="Buenas prácticas para producción">
        <ul className="space-y-2 text-sm text-cream-100">
          <Point ok>Nunca poner claves secretas (service_role, contraseñas de la base) en el frontend: todo lo que empieza por VITE_ es público.</Point>
          <Point ok>Calcular precios y totales en el servidor; el navegador solo envía productos, cantidades y opciones.</Point>
          <Point ok>Proteger las tablas con RLS y dejar que solo la API escriba en la base.</Point>
          <Point ok>Cambiar la contraseña del panel de demostración por una cuenta real de Supabase Auth con contraseña fuerte.</Point>
          <Point ok>Usar HTTPS con dominio propio y limitar CORS a ese dominio.</Point>
          <Point ok>Hacer copias de seguridad de la base y probar la restauración.</Point>
          <Point ok>Probar un pedido real de punta a punta con el WhatsApp del restaurante antes de anunciar la tienda.</Point>
        </ul>
        <a
          href={`${REPO}/docs/seguridad.md`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-400 hover:underline"
        >
          <ShieldCheck className="size-4" aria-hidden /> Controles de seguridad del proyecto
        </a>
      </Panel>

      {STATIC_MODE && <DemoDataPanel />}
    </div>
  )
}

// Solo existe en el build de demostración (condición en línea: el build completo no incluye la base local).
const localDb = () =>
  import.meta.env.VITE_STATIC_MODE === 'true' ? import('../../local/local-db') : Promise.reject(new Error('Solo en modo demostración'))

function DemoDataPanel() {
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const exportData = async () => {
    const { readDb } = await localDb()
    const blob = new Blob([JSON.stringify(readDb(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `el-arca-demo-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const reset = async () => {
    const { resetDb } = await localDb()
    resetDb()
    setConfirming(false)
    setNotice('Datos de demostración restablecidos: carta original y sin pedidos.')
  }

  return (
    <Panel title="Datos de demostración de este navegador">
      {notice && (
        <div className="mb-3">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={exportData}>
          <Download className="size-4" aria-hidden /> Descargar respaldo (JSON)
        </Button>
        {!confirming ? (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            <RotateCcw className="size-4" aria-hidden /> Restablecer datos
          </Button>
        ) : (
          <>
            <Button variant="danger" onClick={reset}>
              Sí, borrar pedidos y cambios
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-cream-300">Restablecer vuelve a la carta original y borra los pedidos guardados en este navegador.</p>
    </Panel>
  )
}

function Point({ ok, children }: { ok?: boolean; children: ReactNode }) {
  const Icon = ok ? CheckCircle2 : AlertTriangle
  return (
    <li className="flex items-start gap-2">
      <Icon className={`mt-0.5 size-4 shrink-0 ${ok ? 'text-emerald-300' : 'text-amber-300'}`} aria-hidden />
      <span>{children}</span>
    </li>
  )
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-ink-800 px-1.5 py-0.5 text-xs text-cream-50">{children}</code>
}
