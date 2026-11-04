import {
  createContext,
  use,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'mise.theme'

interface ThemeApi {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeApi | null>(null)

function resolveInitial(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Theme is class-based on <html> so Tailwind's `dark:` variant applies. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(resolveInitial)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const value = useMemo<ThemeApi>(
    () => ({
      theme,
      setTheme,
      toggle: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme(): ThemeApi {
  const context = use(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside a <ThemeProvider>')
  return context
}

/**
 * Chart colours.
 *
 * Recharts needs concrete values rather than CSS variables, so both modes are
 * declared here. Each set was checked with the data-viz validator against its
 * own surface — the dark steps are chosen for the dark background, not flipped.
 * Pass/fail are status colours: always shipped with a legend and labels so the
 * meaning never rests on hue alone.
 */
export const CHART_TOKENS = {
  light: {
    pass: '#2f7d52',
    fail: '#c84052',
    warn: '#b07d12',
    brand: '#b45839',
    grid: '#ebe6de',
    axis: '#60666f',
    surface: '#ffffff',
    tooltipBorder: '#e2dcd2',
    ink: '#1d1f21',
  },
  dark: {
    pass: '#5bb583',
    fail: '#e0707f',
    warn: '#e0a526',
    brand: '#d6a58d',
    grid: '#342b25',
    axis: '#b5aa9f',
    surface: '#211b17',
    tooltipBorder: '#41362e',
    ink: '#f3ede6',
  },
} as const

export function useChartTokens() {
  const { theme } = useTheme()
  return CHART_TOKENS[theme]
}
