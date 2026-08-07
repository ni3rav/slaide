import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createPreferencesRepository,
  type PreferencesRepository,
  type ThemePreference,
} from '../storage/preferences-repository.ts'
import {
  readSystemPrefersDark,
  resolveTheme,
  type ResolvedTheme,
} from './theme-policy.ts'

type ThemeContextValue = {
  theme: ResolvedTheme
  hasExplicitPreference: boolean
  preferencesReady: boolean
  setThemePreference: (theme: ThemePreference) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

type ThemeProviderProps = {
  children: ReactNode
  preferences?: PreferencesRepository
}

export function ThemeProvider({ children, preferences: injectedPreferences }: ThemeProviderProps) {
  const [ownedPreferences, setOwnedPreferences] = useState<PreferencesRepository | null>(
    injectedPreferences ?? null,
  )
  const [storedPreference, setStoredPreference] = useState<ThemePreference | null | undefined>(
    undefined,
  )
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    readSystemPrefersDark(window.matchMedia('(prefers-color-scheme: dark)')),
  )

  useEffect(() => {
    if (injectedPreferences) return
    let cancelled = false
    void createPreferencesRepository().then((created) => {
      if (cancelled) {
        void created.dispose()
        return
      }
      setOwnedPreferences(created)
    })
    return () => {
      cancelled = true
    }
  }, [injectedPreferences])

  const activePreferences = injectedPreferences ?? ownedPreferences

  useEffect(() => {
    if (!activePreferences) return

    let cancelled = false
    void activePreferences.getThemePreference().then((value) => {
      if (!cancelled) setStoredPreference(value)
    })

    return () => {
      cancelled = true
    }
  }, [activePreferences])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      setSystemPrefersDark(readSystemPrefersDark(mediaQuery))
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const resolvedTheme = resolveTheme(
    storedPreference === undefined ? null : storedPreference,
    systemPrefersDark,
  )

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const setThemePreference = useCallback(
    async (theme: ThemePreference) => {
      if (!activePreferences) {
        throw new Error('Theme preferences are not ready')
      }
      await activePreferences.setThemePreference(theme)
      setStoredPreference(theme)
    },
    [activePreferences],
  )

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: resolvedTheme,
      hasExplicitPreference: storedPreference != null,
      preferencesReady: storedPreference !== undefined && activePreferences != null,
      setThemePreference,
    }),
    [activePreferences, resolvedTheme, setThemePreference, storedPreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
