import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: 'owner' | 'admin'
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, userRole } = useStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
