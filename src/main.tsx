import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { ToastProvider } from './components/ui/Toast'
import { LocalStorageRepository, type DataRepository } from './data/repository'
import { StoreProvider } from './data/store'
import { AccountGate } from './features/account/AccountGate'
import { supabase } from './lib/supabase'
import { ThemeProvider } from './lib/theme'
import './index.css'

/**
 * Single composition point. With Supabase keys configured, each device signs
 * in to its venue and syncs through `SupabaseRepository`; without them the app
 * keeps everything on this device. The screens are the same either way.
 */
const deviceOnly = new LocalStorageRepository()

function renderApp(repository: DataRepository) {
  return (
    <StoreProvider repository={repository}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StoreProvider>
  )
}

createRoot(document.querySelector('#root') as HTMLElement).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        {supabase ? (
          <AccountGate client={supabase} legacy={deviceOnly}>
            {renderApp}
          </AccountGate>
        ) : (
          renderApp(deviceOnly)
        )}
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
)
