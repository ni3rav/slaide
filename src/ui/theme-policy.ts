export type ThemePreference = 'light' | 'dark'
export type ResolvedTheme = ThemePreference

export function resolveTheme(
  preference: ThemePreference | null,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference) return preference
  return systemPrefersDark ? 'dark' : 'light'
}

export function readSystemPrefersDark(
  mediaQueryList: Pick<MediaQueryList, 'matches'>,
): boolean {
  return mediaQueryList.matches
}
