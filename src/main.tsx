import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { ToastProvider } from './components/ui/Toast'
import { LocalStorageRepository } from './data/repository'
import { StoreProvider } from './data/store'
import { ThemeProvider } from './lib/theme'
import './index.css'

/**
 * Single composition point. Swapping `LocalStorageRepository` for an HTTP-backed
 * implementation is the whole change needed to put this app on a real backend.
 */
const repository = new LocalStorageRepository()

createRoot(document.querySelector('#root') as HTMLElement).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <StoreProvider repository={repository}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </StoreProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
)
