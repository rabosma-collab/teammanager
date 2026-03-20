import './globals.css';
import type { Metadata } from 'next';
import { DM_Sans, Barlow_Condensed } from 'next/font/google';
import { TeamProvider } from './contexts/TeamContext';
import { ToastProvider } from './contexts/ToastContext';
import CookieBanner from './components/CookieBanner';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-barlow-condensed',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Team Manager',
  description: 'Beheer je voetbalteam: opstelling, wissels, statistieken en meer.',
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'Team Manager',
    description: 'Beheer je voetbalteam: opstelling, wissels, statistieken en meer.',
    url: 'https://teammanager-psi.vercel.app',
    siteName: 'Team Manager',
    images: [
      {
        url: 'https://teammanager-psi.vercel.app/icon-1024.png',
        width: 1024,
        height: 1024,
        alt: 'Team Manager logo',
      },
    ],
    type: 'website',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Team Manager',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/icon-152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icon-167.png', sizes: '167x167', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body className={`${dmSans.variable} ${barlowCondensed.variable} font-sans`}>
        <ToastProvider>
          <TeamProvider>{children}</TeamProvider>
        </ToastProvider>
        <CookieBanner />
      </body>
    </html>
  );
}
