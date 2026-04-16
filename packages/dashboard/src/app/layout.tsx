import type { Metadata } from 'next'
import './globals.css'
import NavShell from './nav-shell'
import { NotificationProvider } from './notifications'

export const metadata: Metadata = {
  title: 'HIVE — The Global AI Consumption Network',
  description: 'Token Economy · Token Governance · Zero Content · Full Visibility',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body suppressHydrationWarning>
        <NotificationProvider>
          <NavShell>{children}</NavShell>
        </NotificationProvider>
      </body>
    </html>
  )
}
