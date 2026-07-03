import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Codex Protocol (v3)',
  description: 'An AI-assisted Investment Committee',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ display: 'flex', margin: 0, padding: 0, height: '100vh', backgroundColor: '#121212', color: '#ededed' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
          {children}
        </div>
      </body>
    </html>
  );
}
