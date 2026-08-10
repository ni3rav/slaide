import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from './ThemeProvider.tsx'

export function ThemeSelector({
  labeled = false,
  className,
}: {
  labeled?: boolean
  className?: string
}) {
  const { theme, preferencesReady, setThemePreference } = useTheme()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const label = nextTheme === 'light' ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <Button
      type="button"
      variant="ghost"
      size={labeled ? 'sm' : 'icon-sm'}
      className={cn(labeled ? 'gap-1.5' : undefined, className)}
      data-testid="theme-selector"
      disabled={!preferencesReady}
      aria-label={label}
      title={label}
      onClick={() => {
        void setThemePreference(nextTheme)
      }}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
      {labeled ? 'Theme' : <span className="sr-only">{label}</span>}
    </Button>
  )
}
