import { RefreshCw, WifiOff } from 'lucide-react'
import { EmptyState } from './EmptyState'

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <EmptyState icon={WifiOff} title="No pudimos cargar la información">
      <p>{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-ink-600 px-4 py-2 font-semibold text-cream-50 hover:border-brand-500"
      >
        <RefreshCw className="size-4" aria-hidden />
        Reintentar
      </button>
    </EmptyState>
  )
}
