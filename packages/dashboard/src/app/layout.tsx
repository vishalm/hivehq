import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HIVE — The Global AI Consumption Network',
  description: 'Scout · Node · Hive — Know exactly how your org uses AI.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container">
            <span className="brand">HIVE</span>
            <nav className="nav">
              <a href="/">Dashboard</a>
              <a href="/intelligence">Intelligence</a>
              <a href="/setup">Setup</a>
            </nav>
            <span className="tag">pre-alpha · Phase 2</span>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  )
}
