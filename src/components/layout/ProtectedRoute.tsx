import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: 'owner' | 'admin' | 'staff'
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, userRole } = useStore()
  const staffToken = localStorage.getItem('staffAccessToken')
  const staffRole = localStorage.getItem('staffRole')

  if (requiredRole === 'staff') {
    if (!staffToken) return <Navigate to="/staff/login" replace />
    return <>{children}</>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
