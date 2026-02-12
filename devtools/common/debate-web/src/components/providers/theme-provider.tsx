import { createContext, type ReactNode, useContext } from 'react';

import { type Theme, useThemeInternal } from '@/hooks/use-theme';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Theme provider — wraps the app and provides theme state via context.
 * Replaces next-themes ThemeProvider.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeValue = useThemeInternal();
  return (
    <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context.
 * Drop-in replacement for `useTheme` from next-themes.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
