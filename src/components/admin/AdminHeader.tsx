import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, ChevronDown, LogOut, ShieldCheck, Circle } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'

export default function AdminHeader() {
  const [showDropdown, setShowDropdown] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const { logout, restaurant } = useStore()
  const navigate = useNavigate()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="h-16 bg-primary-dark dark:bg-background-dark border-b border-white/5 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <span className="font-heading font-bold text-white text-lg">Admin Panel</span>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 border border-success/20">
          <Circle className="w-2 h-2 fill-success text-success animate-pulse" />
          <span className="text-[11px] font-accent font-semibold text-success">99.9% Uptime</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
          >
            <Bell className="w-4.5 h-4.5" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-secondary text-[9px] font-bold text-white flex items-center justify-center">
              3
            </span>
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-72 bg-primary-light dark:bg-primary border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50"
              >
                <div className="p-3 border-b border-white/5">
                  <p className="text-sm font-semibold text-white">Notifications</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {[
                    { title: 'New restaurant registered', time: '2 min ago', type: 'info' },
                    { title: 'Payment received from Bahari', time: '15 min ago', type: 'success' },
                    { title: 'Support ticket #1234 escalated', time: '1 hour ago', type: 'warning' },
                  ].map((n, i) => (
                    <div key={i} className="px-3 py-2.5 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0">
                      <p className="text-sm text-white/80">{n.title}</p>
                      <p className="text-xs text-white/40 mt-0.5">{n.time}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/5 transition-all"
          >
            <Avatar name="Admin User" size="sm" />
            <div className="text-left hidden sm:block">
              <p className="text-sm font-semibold text-white leading-tight">Super Admin</p>
              <p className="text-[10px] text-white/50">Platform Administrator</p>
            </div>
            <ChevronDown className="w-4 h-4 text-white/40" />
          </button>

          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-48 bg-primary-light dark:bg-primary border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50"
              >
                <div className="p-2 border-b border-white/5">
                  <p className="text-xs text-white/40 px-2 py-1">Account</p>
                  <button className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-sm text-white/80 hover:bg-white/5 transition-all">
                    <ShieldCheck className="w-4 h-4" />
                    Admin Profile
                  </button>
                </div>
                <div className="p-2">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
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
