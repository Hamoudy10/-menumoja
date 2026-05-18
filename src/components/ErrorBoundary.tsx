import React from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>

            <h2 className="font-heading text-xl font-bold text-text-primary dark:text-white">
              Something went wrong
            </h2>

            <p className="font-body text-sm text-text-secondary dark:text-white/60">
              An unexpected error occurred. Please try refreshing the page.
            </p>

            {this.state.error && (
              <details className="text-left">
                <summary className="font-accent text-xs text-text-secondary cursor-pointer hover:text-secondary">
                  Error details
                </summary>
                <pre className="mt-2 rounded-lg bg-black/5 dark:bg-white/5 p-3 text-[10px] text-text-secondary overflow-auto max-h-32">
                  {this.state.error.message}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-sm font-accent font-medium text-white hover:bg-secondary-dark transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-accent font-medium text-text-primary dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <Home className="h-4 w-4" />
                Go Home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
