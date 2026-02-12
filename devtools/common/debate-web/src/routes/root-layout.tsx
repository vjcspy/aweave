import { Outlet } from 'react-router';

/**
 * Root layout wrapper — provides the base HTML structure.
 * Fonts and global CSS are imported in main.tsx.
 * ThemeProvider wraps the entire app in main.tsx.
 */
export function RootLayout() {
  return (
    <div className="font-sans antialiased">
      <Outlet />
    </div>
  );
}
