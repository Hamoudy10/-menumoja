import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { AnimatePresence, motion } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { GoogleOAuthProvider } from '@react-oauth/google'
import ThemeProvider from '@/components/theme/ThemeProvider'
import { BrandLoader } from '@/components/ui/BrandLoader'

const ProtectedRoute = lazy(() => import('@/components/layout/ProtectedRoute'))
const DashboardLayout = lazy(() => import('@/components/layout/DashboardLayout'))
const AdminLayout = lazy(() => import('@/components/layout/AdminLayout'))
const NotFound = lazy(() => import('@/components/layout/NotFound'))

const LandingPage = lazy(() => import('@/pages/LandingPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const SignUpPage = lazy(() => import('@/pages/SignUpPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'))
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

const DashboardHome = lazy(() => import('@/pages/dashboard/DashboardHome'))
const PaymentsPage = lazy(() => import('@/pages/dashboard/PaymentsPage'))
const SettingsPage = lazy(() => import('@/pages/dashboard/SettingsPage'))
const HelpPage = lazy(() => import('@/pages/dashboard/HelpPage'))
const OperationsHub = lazy(() => import('@/pages/dashboard/hubs/OperationsHub'))
const MenuHub = lazy(() => import('@/pages/dashboard/hubs/MenuHub'))
const InventoryHub = lazy(() => import('@/pages/dashboard/hubs/InventoryHub'))
const CustomersHub = lazy(() => import('@/pages/dashboard/hubs/CustomersHub'))
const InsightsHub = lazy(() => import('@/pages/dashboard/hubs/InsightsHub'))
const StaffLoginPage = lazy(() => import('@/pages/StaffLoginPage'))
const KitchenDisplay = lazy(() => import('@/pages/dashboard/KitchenDisplay'))
const CashierDashboard = lazy(() => import('@/pages/dashboard/CashierDashboard'))
const WaiterDashboard = lazy(() => import('@/pages/staff/WaiterDashboard'))
const ReservationsPage = lazy(() => import('@/pages/dashboard/ReservationsPage'))
const StaffProfile = lazy(() => import('@/pages/staff/StaffProfile'))

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
          <BrandLoader />
        </div>
      }>
        {/* No key on Routes: keying by pathname remounts the whole matched
            tree on every navigation, which destroyed the dashboard layout and
            Jarvis session on tab switches. PageTransition still animates the
            incoming page. */}
        <Routes location={location}>
          <Route path="/" element={<PageTransition><LandingPage /></PageTransition>} />
          <Route path="/login" element={<PageTransition><LoginPage /></PageTransition>} />
          <Route path="/signup" element={<PageTransition><SignUpPage /></PageTransition>} />
          <Route path="/forgot-password" element={<PageTransition><ForgotPasswordPage /></PageTransition>} />
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

          <Route path="/staff/login" element={<PageTransition><StaffLoginPage /></PageTransition>} />
          <Route path="/staff/kitchen" element={
            <ProtectedRoute requiredRole="staff">
              <KitchenDisplay />
            </ProtectedRoute>
          } />
          <Route path="/staff/cashier" element={
            <ProtectedRoute requiredRole="staff">
              <CashierDashboard />
            </ProtectedRoute>
          } />
          <Route path="/staff/waiter" element={
            <ProtectedRoute requiredRole="staff">
              <WaiterDashboard />
            </ProtectedRoute>
          } />
          <Route path="/staff/reservations" element={
            <ProtectedRoute requiredRole="staff">
              <ReservationsPage />
            </ProtectedRoute>
          } />

          <Route path="/dashboard" element={
            <ProtectedRoute requiredRole="owner">
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<PageTransition><DashboardHome /></PageTransition>} />
            <Route path="operations" element={<PageTransition><OperationsHub /></PageTransition>} />
            <Route path="menu" element={<PageTransition><MenuHub /></PageTransition>} />
            <Route path="inventory" element={<PageTransition><InventoryHub /></PageTransition>} />
            <Route path="customers" element={<PageTransition><CustomersHub /></PageTransition>} />
            <Route path="finance" element={<PageTransition><PaymentsPage /></PageTransition>} />
            <Route path="insights" element={<PageTransition><InsightsHub /></PageTransition>} />
            <Route path="settings" element={<PageTransition><SettingsPage /></PageTransition>} />
            <Route path="help" element={<PageTransition><HelpPage /></PageTransition>} />

            {/* Legacy deep links → consolidated hubs */}
            <Route path="orders" element={<Navigate to="/dashboard/operations?tab=orders" replace />} />
            <Route path="tables" element={<Navigate to="/dashboard/operations?tab=tables" replace />} />
            <Route path="reservations" element={<Navigate to="/dashboard/operations?tab=reservations" replace />} />
            <Route path="surveillance" element={<Navigate to="/dashboard/operations?tab=cameras" replace />} />
            <Route path="promotions" element={<Navigate to="/dashboard/menu?tab=promotions" replace />} />
            <Route path="recipes" element={<Navigate to="/dashboard/inventory?tab=recipes" replace />} />
            <Route path="loyalty" element={<Navigate to="/dashboard/customers?tab=loyalty" replace />} />
            <Route path="whatsapp" element={<Navigate to="/dashboard/customers?tab=campaigns" replace />} />
            <Route path="analytics" element={<Navigate to="/dashboard/insights?tab=analytics" replace />} />
            <Route path="profitability" element={<Navigate to="/dashboard/insights?tab=profitability" replace />} />
            <Route path="payments" element={<Navigate to="/dashboard/finance" replace />} />
            <Route path="ai-manager" element={<Navigate to="/dashboard" replace />} />
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
      <ThemeProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: '12px',
              background: 'var(--color-primary-light)',
              color: '#fff',
              fontSize: '14px',
            },
            duration: 4000,
          }}
        />
      </ThemeProvider>
    </GoogleOAuthProvider>
  )
}
