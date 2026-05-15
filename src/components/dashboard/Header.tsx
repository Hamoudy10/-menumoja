import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Bell, Moon, Sun, LogOut, User, Settings, Menu } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Avatar } from '@/components/ui/Avatar'

export function Header({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const navigate = useNavigate()
  const { darkMode, toggleDarkMode, restaurant, logout } = useStore()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [notifications] = useState(3)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-white/80 dark:bg-background-dark/80 backdrop-blur-xl px-6">
      <div className="flex items-center gap-4">
        {onToggleSidebar && (
          <button onClick={onToggleSidebar} className="lg:hidden p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
            <Menu className="h-5 w-5 text-text-primary dark:text-white" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-xl font-bold text-text-primary dark:text-white">
            {restaurant?.name || 'Dashboard'}
          </h2>
          <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-accent font-medium text-success">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Menu is Live
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleDarkMode}
          className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-black/5 dark:bg-white/10 text-text-secondary dark:text-white/60 hover:text-text-primary dark:hover:text-white transition-colors"
        >
          <AnimatePresence mode="wait">
            {darkMode ? (
              <motion.span key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <Sun className="h-4 w-4" />
              </motion.span>
            ) : (
              <motion.span key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <Moon className="h-4 w-4" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-black/5 dark:bg-white/10 text-text-secondary dark:text-white/60 hover:text-text-primary dark:hover:text-white transition-colors"
        >
          <Bell className="h-4 w-4" />
          {notifications > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[9px] font-bold text-white">
              {notifications}
            </span>
          )}
        </motion.button>

        <div ref={dropdownRef} className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 rounded-xl p-1 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <Avatar name={restaurant?.ownerName || 'Owner'} size="sm" status="online" />
            <span className="hidden md:block text-left">
              <p className="text-sm font-medium font-body text-text-primary dark:text-white leading-tight">
                {restaurant?.ownerName || 'Owner'}
              </p>
              <p className="text-[10px] font-accent text-text-secondary dark:text-white/40 uppercase">
                Owner
              </p>
            </span>
          </motion.button>

          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl bg-white dark:bg-primary-light border border-white/10 shadow-soft"
              >
                <div className="p-2 space-y-1">
                  {[
                    { icon: User, label: 'Profile', onClick: () => navigate('/dashboard/settings') },
                    { icon: Settings, label: 'Settings', onClick: () => navigate('/dashboard/settings') },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => { setShowDropdown(false); item.onClick() }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-body text-text-primary dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                      <item.icon className="h-4 w-4 text-text-secondary" />
                      {item.label}
                    </button>
                  ))}
                  <div className="border-t border-white/10 my-1" />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-body text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
