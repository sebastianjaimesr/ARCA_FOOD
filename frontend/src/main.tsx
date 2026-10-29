import { domAnimation, LazyMotion } from 'framer-motion'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { router } from './app/router'
import './index.css'

// Las tipografías se declaran en index.css y se sirven desde el propio sitio.
// LazyMotion + domAnimation: solo se incluyen las funciones de animación que se
// usan (sin animaciones de layout); `strict` impide importar `motion` completo.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LazyMotion features={domAnimation} strict>
      <RouterProvider router={router} />
    </LazyMotion>
  </StrictMode>,
)
