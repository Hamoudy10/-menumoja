import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { AnimatePresence, motion } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { GoogleOAuthProvider } from '@react-oauth/google'

const ProtectedRoute = lazy(() => import('@/components/layout/ProtectedRoute'))
const DashboardLayout = lazy(() => import('@/components/layout/DashboardLayout'))
const AdminLayout = lazy(() => import('@/components/layout/AdminLayout'))
const NotFound = lazy(() => import('@/components/layout/NotFound'))

const LandingPage = lazy(() => import('@/pages/LandingPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const SignUpPage = lazy(() => import('@/pages/SignUpPage'))
const DemoPage = lazy(() => import('@/pages/DemoPage'))

const MenuView = lazy(() => import('@/pages/menu/MenuView'))
const MenuCart = lazy(() => import('@/pages/menu/MenuCart'))
const MenuOrderStatus = lazy(() => import('@/pages/menu/MenuOrderStatus'))

const OnboardingWelcome = lazy(() => import('@/pages/onboarding/OnboardingWelcome'))
const OnboardingProfile = lazy(() => import('@/pages/onboarding/OnboardingProfile'))
const OnboardingMenu = lazy(() => import('@/pages/onboarding/OnboardingMenu'))
const OnboardingAppearance = lazy(() => import('@/pages/onboarding/OnboardingAppearance'))
const OnboardingAiSetup = lazy(() => import('@/pages/onboarding/OnboardingAiSetup'))
const OnboardingQR = lazy(() => import('@/pages/onboarding/OnboardingQR'))
const OnboardingMarketing = lazy(() => import('@/pages/onboarding/OnboardingMarketing'))

const DashboardHome = lazy(() => import('@/pages/dashboard/DashboardHome'))
const MenuManager = lazy(() => import('@/pages/dashboard/MenuManager'))
const OrdersPage = lazy(() => import('@/pages/dashboard/OrdersPage'))
const PaymentsPage = lazy(() => import('@/pages/dashboard/PaymentsPage'))
const AnalyticsPage = lazy(() => import('@/pages/dashboard/AnalyticsPage'))
const SurveillancePage = lazy(() => import('@/pages/dashboard/SurveillancePage'))
const MarketingPage = lazy(() => import('@/pages/dashboard/MarketingPage'))
const SettingsPage = lazy(() => import('@/pages/dashboard/SettingsPage'))
const HelpPage = lazy(() => import('@/pages/dashboard/HelpPage'))

const AdminOverview = lazy(() => import('@/pages/admin/AdminOverview'))
const AdminRestaurants = lazy(() => import('@/pages/admin/AdminRestaurants'))
const AdminSubscriptions = lazy(() => import('@/pages/admin/AdminSubscriptions'))
const AdminSupport = lazy(() => import('@/pages/admin/AdminSupport'))
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'))

function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  )
}

function AppRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
            <p className="font-accent text-xs text-text-secondary">Loading...</p>
          </div>
        </div>
      }>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageTransition><LandingPage /></PageTransition>} />
          <Route path="/login" element={<PageTransition><LoginPage /></PageTransition>} />
          <Route path="/signup" element={<PageTransition><SignUpPage /></PageTransition>} />
          <Route path="/demo" element={<PageTransition><DemoPage /></PageTransition>} />

          <Route path="/menu/:restaurantSlug" element={<PageTransition><MenuView /></PageTransition>} />
          <Route path="/menu/:restaurantSlug/cart" element={<PageTransition><MenuCart /></PageTransition>} />
          <Route path="/menu/:restaurantSlug/order/:id" element={<PageTransition><MenuOrderStatus /></PageTransition>} />

          <Route path="/onboarding/welcome" element={<PageTransition><OnboardingWelcome /></PageTransition>} />
          <Route path="/onboarding/profile" element={<PageTransition><OnboardingProfile /></PageTransition>} />
          <Route path="/onboarding/menu" element={<PageTransition><OnboardingMenu /></PageTransition>} />
          <Route path="/onboarding/appearance" element={<PageTransition><OnboardingAppearance /></PageTransition>} />
          <Route path="/onboarding/ai-setup" element={<PageTransition><OnboardingAiSetup /></PageTransition>} />
          <Route path="/onboarding/qr" element={<PageTransition><OnboardingQR /></PageTransition>} />
          <Route path="/onboarding/marketing" element={<PageTransition><OnboardingMarketing /></PageTransition>} />

          <Route path="/dashboard" element={
            <ProtectedRoute requiredRole="owner">
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<PageTransition><DashboardHome /></PageTransition>} />
            <Route path="menu" element={<PageTransition><MenuManager /></PageTransition>} />
            <Route path="orders" element={<PageTransition><OrdersPage /></PageTransition>} />
            <Route path="payments" element={<PageTransition><PaymentsPage /></PageTransition>} />
            <Route path="analytics" element={<PageTransition><AnalyticsPage /></PageTransition>} />
            <Route path="surveillance" element={<PageTransition><SurveillancePage /></PageTransition>} />
            <Route path="marketing" element={<PageTransition><MarketingPage /></PageTransition>} />
            <Route path="settings" element={<PageTransition><SettingsPage /></PageTransition>} />
            <Route path="help" element={<PageTransition><HelpPage /></PageTransition>} />
          </Route>

          <Route path="/admin" element={
            <ProtectedRoute requiredRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<PageTransition><AdminOverview /></PageTransition>} />
            <Route path="restaurants" element={<PageTransition><AdminRestaurants /></PageTransition>} />
            <Route path="subscriptions" element={<PageTransition><AdminSubscriptions /></PageTransition>} />
            <Route path="support" element={<PageTransition><AdminSupport /></PageTransition>} />
            <Route path="settings" element={<PageTransition><AdminSettings /></PageTransition>} />
          </Route>

          <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  )
}

export default function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const { restoreSession } = useStore()

  useEffect(() => {
    restoreSession()
  }, [])

  useEffect(() => {
    if (!googleClientId) {
      console.warn('VITE_GOOGLE_CLIENT_ID not set - Google OAuth login will not work')
    }
  }, [googleClientId])

  return (
    <GoogleOAuthProvider clientId={googleClientId || ''}>
      <AppRoutes />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '12px',
            background: '#1A2A4A',
            color: '#fff',
            fontSize: '14px',
          },
          duration: 4000,
        }}
      />
    </GoogleOAuthProvider>
  )
}
