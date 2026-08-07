import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from './ThemeProvider.tsx'

export function ThemeSelector() {
  const { theme, preferencesReady, setThemePreference } = useTheme()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const label = nextTheme === 'light' ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      data-testid="theme-selector"
      disabled={!preferencesReady}
      aria-label={label}
      title={label}
      onClick={() => {
        void setThemePreference(nextTheme)
      }}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
      <span className="sr-only">{label}</span>
    </Button>
  )
}
