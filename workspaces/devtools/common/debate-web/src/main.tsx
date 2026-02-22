import '@fontsource/geist-sans/400.css';
import '@fontsource/geist-sans/500.css';
import '@fontsource/geist-sans/600.css';
import '@fontsource/geist-sans/700.css';
import '@fontsource/geist-mono/400.css';
import './globals.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { ThemeProvider } from '@/components/providers/theme-provider';
import { DebateDetail } from '@/routes/debate-detail';
import { DebatesIndex } from '@/routes/debates-index';
import { DebatesLayout } from '@/routes/debates-layout';
import { RootLayout } from '@/routes/root-layout';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter basename="/debate">
        <Routes>
          <Route element={<RootLayout />}>
            <Route index element={<Navigate to="/debates" replace />} />
            <Route path="debates" element={<DebatesLayout />}>
              <Route index element={<DebatesIndex />} />
              <Route path=":id" element={<DebateDetail />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
