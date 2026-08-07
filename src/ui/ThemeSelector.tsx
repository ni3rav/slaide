import { useTheme } from './ThemeProvider.tsx'

export function ThemeSelector() {
  const { theme, preferencesReady, setThemePreference } = useTheme()

  return (
    <fieldset className="theme-selector" data-testid="theme-selector" disabled={!preferencesReady}>
      <legend>Theme</legend>
      <label>
        <input
          type="radio"
          name="theme"
          value="light"
          checked={theme === 'light'}
          disabled={!preferencesReady}
          onChange={() => {
            void setThemePreference('light')
          }}
        />
        Light
      </label>
      <label>
        <input
          type="radio"
          name="theme"
          value="dark"
          checked={theme === 'dark'}
          disabled={!preferencesReady}
          onChange={() => {
            void setThemePreference('dark')
          }}
        />
        Dark
      </label>
    </fieldset>
  )
}
