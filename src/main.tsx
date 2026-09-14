import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource-variable/plus-jakarta-sans'
import App from './App.tsx'
import { applyFontScale, getStoredFontScale } from './lib/fontScale'
import './index.css'

applyFontScale(getStoredFontScale())

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
