import React from 'react';
import type { Metadata, Viewport } from 'next';
import '../styles/tailwind.css';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/context/AuthContext';
import { DemoNavRail } from '@/components/demo/DemoNavRail';
import { validateEnv } from '@/lib/config/validateEnv';

validateEnv();

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'GOGI — AI Literacy Platform for Real Classrooms',
  description:
    'GOGI transforms how students read, analyze, and think through AI-guided structured tasks aligned to Florida B.E.S.T. standards.',
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          {children}
          <React.Suspense fallback={null}>
            <DemoNavRail />
          </React.Suspense>
        </AuthProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1a1d21',
              color: '#ffffff',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.08)',
            },
          }}
        />
      </body>
    </html>
  );
}
