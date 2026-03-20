import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reply Botz HD - AI Helpdesk',
  description: 'AI-first helpdesk system with multi-channel support',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
