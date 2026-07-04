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
      <body>
        <Sidebar />
        <div className="app-shell">
          {children}
        </div>
      </body>
    </html>
  );
}
