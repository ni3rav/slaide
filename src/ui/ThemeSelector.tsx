import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from './ThemeProvider.tsx'

export function ThemeSelector({ labeled = false }: { labeled?: boolean }) {
  const { theme, preferencesReady, setThemePreference } = useTheme()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const label = nextTheme === 'light' ? 'Switch to light theme' : 'Switch to dark theme'
  const shortLabel = nextTheme === 'light' ? 'Light' : 'Dark'

  return (
    <Button
      type="button"
      variant="ghost"
      size={labeled ? 'sm' : 'icon-sm'}
      className={labeled ? 'gap-1.5' : undefined}
      data-testid="theme-selector"
      disabled={!preferencesReady}
      aria-label={label}
      title={label}
      onClick={() => {
        void setThemePreference(nextTheme)
      }}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
      {labeled ? shortLabel : <span className="sr-only">{label}</span>}
    </Button>
  )
}
