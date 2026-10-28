import { motion } from 'framer-motion'
import { MessageCircle, UtensilsCrossed } from 'lucide-react'
import { Link } from 'react-router'
import { business, whatsappUrl } from '../config/business'

// Portada mínima de la Fase 2. Categorías, destacados y horarios se agregan
// en la Fase 4, cuando el menú venga de la base de datos.
export function HomePage() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(255,199,0,0.18),transparent_70%)]"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pt-12 pb-20 text-center sm:pt-20">
        <motion.img
          src="/brand/logo-el-arca.webp"
          alt="Logo de El Arca Comidas Rápidas"
          width={280}
          height={280}
          className="size-56 rounded-3xl shadow-2xl shadow-brand-500/10 sm:size-72"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.45 }}
        >
          <h1 className="mt-8 text-4xl font-black tracking-tight text-cream-50 sm:text-6xl">
            Hamburguesas, hot dogs y <span className="text-brand-500">mucho más</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-cream-300 sm:text-lg">
            Arma tu pedido en línea y envíalo a {business.name} por WhatsApp. Domicilios en Bucaramanga.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/menu"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-7 py-3.5 font-bold text-ink-900 transition hover:bg-brand-400 active:scale-95"
            >
              <UtensilsCrossed className="size-5" aria-hidden />
              Ver el menú
            </Link>
            <a
              href={whatsappUrl()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-600 px-7 py-3.5 font-semibold text-cream-50 transition hover:border-brand-500 hover:text-brand-400"
            >
              <MessageCircle className="size-5" aria-hidden />
              {business.whatsapp.display}
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
