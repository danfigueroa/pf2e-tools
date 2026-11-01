// Antes de tudo: o `?mesa=` do link vira a escolha do aparelho e sai da URL
// antes de o roteador ler a localização.
import './services/mesa'
// O idioma desta carga (constante até a próxima): antes de qualquer texto ser montado.
import './i18n'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startSupabase } from './services/supabase'
import { installApiAuth } from './services/auth'

// Antes de qualquer chamada: todo fetch('/api/…') passa a levar a sessão de quem entrou.
installApiAuth()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

startSupabase()
