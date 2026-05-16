import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gedda IQ Arena',
  description: 'Realtime 1v1 arithmetic battle game',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
