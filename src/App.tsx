import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { NavigationProvider } from './contexts/NavigationContext'
import { ScriptStatusProvider } from './contexts/ScriptStatusContext'

// Critical-Engineer: consulted for Security vulnerability assessment
// Implemented surgical security fixes using npm overrides for esbuild, undici, path-to-regexp
import { Login } from './components/auth/Login'
import { Signup } from './components/auth/Signup'
import { PrivateRoute } from './components/auth/PrivateRoute'
import { Header } from './components/Header'
import { ErrorBoundary } from './components/ErrorBoundary'
// Priority 4: Removed SmartSuiteTest import (development-only testing UI)
import { DesktopRequired } from './components/DesktopRequired'
import { isMobileDevice } from './utils/mobileDetection'
import './App.css'

// Lazy load heavy components for better bundle splitting
const NavigationSidebar = lazy(() => import('./components/navigation/NavigationSidebar').then(module => ({ default: module.NavigationSidebar })))
const TipTapEditor = lazy(() => import('./components/TipTapEditor').then(module => ({ default: module.TipTapEditor })))

// Loading component for suspense fallbacks
const ComponentLoader = ({ name }: { name: string }) => (
  <div className="loading-component" style={{ padding: '20px', textAlign: 'center' }}>
    Loading {name}...
  </div>
)

// Create QueryClient instance outside of components for stability
// Configure with sensible defaults for real-time collaboration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false, // Prevent aggressive refetching in collaborative environment
    },
    mutations: {
      retry: 0, // Don't retry mutations automatically
    },
  },
})

// Critical-Engineer: consulted for Security vulnerability assessment

function MainApp() {
  // Check if user is on mobile device
  const isMobile = isMobileDevice()

  // Show professional mobile fallback for mobile users
  if (isMobile) {
    return <DesktopRequired />
  }

  return (
    <NavigationProvider>
      <ScriptStatusProvider>
        <div className="app-layout">
          <ErrorBoundary>
            <Header />
          </ErrorBoundary>
          <ErrorBoundary>
            <Suspense fallback={<ComponentLoader name="Navigation" />}>
              <NavigationSidebar />
            </Suspense>
          </ErrorBoundary>
          <div className="app-content">
            <ErrorBoundary>
              {/* Priority 4: Removed SmartSuiteTest component - development-only UI */}
              <Suspense fallback={<ComponentLoader name="Editor" />}>
                <TipTapEditor />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </ScriptStatusProvider>
    </NavigationProvider>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <MainApp />
                </PrivateRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App