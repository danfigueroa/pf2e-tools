// Antes de tudo: o `?mesa=` do link vira a escolha do aparelho e sai da URL
// antes de o roteador ler a localização.
import './services/mesa'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startSupabase } from './services/supabase'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

startSupabase()
