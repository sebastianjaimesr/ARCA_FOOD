import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  children?: ReactNode
}

export function EmptyState({ icon: Icon, title, children }: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-dashed border-ink-600 px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-ink-700 text-brand-500">
        <Icon className="size-7" aria-hidden />
      </span>
      <h2 className="mt-5 text-lg font-bold text-cream-50">{title}</h2>
      {children && <div className="mt-2 text-sm text-cream-300">{children}</div>}
    </div>
  )
}
