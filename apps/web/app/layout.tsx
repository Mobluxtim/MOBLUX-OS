import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'MOBLUX OS · Workspace', description: 'Furniture projects, from first idea to production.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
