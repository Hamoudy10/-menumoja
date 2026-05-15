'use client'

import { type ReactNode, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface BottomSheetProps {
  open: boolean
  onClose?: () => void
  children: ReactNode
  snapPoints?: string[]
  title?: string
  showHandle?: boolean
}

const DRAG_THRESHOLD = 100

export function BottomSheet({
  open,
  onClose,
  children,
  snapPoints = ['50%', '85%'],
  title,
  showHandle = true,
}: BottomSheetProps) {
  const handleDragEnd = useCallback(
    (_: any, info: { offset: { y: number }; velocity: { y: number } }) => {
      if (info.offset.y > DRAG_THRESHOLD || info.velocity.y > 500) {
        onClose?.()
      }
    },
    [onClose],
  )

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            key="bs-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="bs-sheet"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
              mass: 1,
            }}
            className="absolute bottom-0 left-0 right-0 z-10 rounded-t-3xl bg-white shadow-soft dark:bg-primary-light dark:text-white"
            style={{ maxHeight: snapPoints[snapPoints.length - 1] || '85%' }}
          >
            {showHandle && (
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-white/30" />
              </div>
            )}
            {(title) && (
              <div className="flex items-center justify-between px-4 pb-2">
                {title && (
                  <h3 className="font-heading text-lg font-bold">{title}</h3>
                )}
                {onClose && (
                  <button
                    onClick={onClose}
                    className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-black/5 hover:text-text-primary dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                    aria-label="Close sheet"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
            <div className="overflow-y-auto px-4 pb-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
