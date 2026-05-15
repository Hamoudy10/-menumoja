import { Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { GoogleOAuthProvider } from '@react-oauth/google'

import ProtectedRoute from '@/components/layout/ProtectedRoute'
import DashboardLayout from '@/components/layout/DashboardLayout'
import AdminLayout from '@/components/layout/AdminLayout'
import NotFound from '@/components/layout/NotFound'

import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/LoginPage'
import SignUpPage from '@/pages/SignUpPage'
import DemoPage from '@/pages/DemoPage'

import MenuView from '@/pages/menu/MenuView'
import MenuCart from '@/pages/menu/MenuCart'
import MenuOrderStatus from '@/pages/menu/MenuOrderStatus'

import OnboardingWelcome from '@/pages/onboarding/OnboardingWelcome'
import OnboardingProfile from '@/pages/onboarding/OnboardingProfile'
import OnboardingMenu from '@/pages/onboarding/OnboardingMenu'
import OnboardingAppearance from '@/pages/onboarding/OnboardingAppearance'
import OnboardingAiSetup from '@/pages/onboarding/OnboardingAiSetup'
import OnboardingQR from '@/pages/onboarding/OnboardingQR'
import OnboardingMarketing from '@/pages/onboarding/OnboardingMarketing'

import DashboardHome from '@/pages/dashboard/DashboardHome'
import MenuManager from '@/pages/dashboard/MenuManager'
import OrdersPage from '@/pages/dashboard/OrdersPage'
import PaymentsPage from '@/pages/dashboard/PaymentsPage'
import AnalyticsPage from '@/pages/dashboard/AnalyticsPage'
import SurveillancePage from '@/pages/dashboard/SurveillancePage'
import MarketingPage from '@/pages/dashboard/MarketingPage'
import SettingsPage from '@/pages/dashboard/SettingsPage'
import HelpPage from '@/pages/dashboard/HelpPage'

import AdminOverview from '@/pages/admin/AdminOverview'
import AdminRestaurants from '@/pages/admin/AdminRestaurants'
import AdminSubscriptions from '@/pages/admin/AdminSubscriptions'
import AdminSupport from '@/pages/admin/AdminSupport'
import AdminSettings from '@/pages/admin/AdminSettings'

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
          <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
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
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
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
