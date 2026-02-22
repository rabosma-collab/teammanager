import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { TeamProvider } from './contexts/TeamContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Team Manager',
  description: 'Beheer je voetbalteam — opstelling, wedstrijden en spelers',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TeamProvider>{children}</TeamProvider>
      </body>
    </html>
  );
}
