import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sea Radar',
  description: 'Учебная карта Дуврского пролива',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
