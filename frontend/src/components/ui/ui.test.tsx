import { fireEvent, render, screen } from '@testing-library/react'
import { ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'
import { QuantityStepper } from './QuantityStepper'

function Stepper({ initial }: { initial: number }) {
  const [value, setValue] = useState(initial)
  return <QuantityStepper value={value} onChange={setValue} label="Cantidad" />
}

describe('componentes de la tienda', () => {
  it('el selector de cantidad no baja de 1 ni sube de 50', () => {
    const { unmount } = render(<Stepper initial={1} />)
    expect(screen.getByRole('button', { name: 'Quitar uno' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar uno' }))
    expect(screen.getByRole('group', { name: 'Cantidad' })).toHaveTextContent('2')
    unmount()

    render(<Stepper initial={50} />)
    expect(screen.getByRole('button', { name: 'Agregar uno' })).toBeDisabled()
  })

  it('el estado vacío muestra título y acción', () => {
    render(
      <EmptyState icon={ShoppingBag} title="Tu pedido está vacío">
        <a href="/menu">Ver el menú</a>
      </EmptyState>,
    )
    expect(screen.getByRole('heading', { name: 'Tu pedido está vacío' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver el menú' })).toHaveAttribute('href', '/menu')
  })
})
