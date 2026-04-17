'use client'

import { AuthGuard } from '../../lib/auth-guard'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard minRole="admin">
      {children}
    </AuthGuard>
  )
}
