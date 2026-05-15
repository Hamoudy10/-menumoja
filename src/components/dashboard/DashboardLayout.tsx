import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function DashboardLayout() {
  const [mobileSidebar, setMobileSidebar] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <Sidebar />
      <div className="lg:pl-[280px] transition-all duration-300">
        <Header onToggleSidebar={() => setMobileSidebar(!mobileSidebar)} />
        <main className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
