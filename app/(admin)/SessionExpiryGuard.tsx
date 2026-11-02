'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

const STATUS_CHECK_INTERVAL_MS = 15_000
const IDLE_TIMEOUT_MS = 15 * 60 * 1_000
const LAST_ACTIVITY_KEY = 'maibuddy:last-admin-activity'
const ACTIVITY_WRITE_INTERVAL_MS = 5_000

export default function SessionExpiryGuard() {
  useEffect(() => {
    const supabase = createClient()
    let expired = false
    let idleTimer: number | undefined
    let lastActivityWrite = 0

    const endSession = async (reason: 'inactivity' | 'account') => {
      if (expired) return
      expired = true
      if (idleTimer !== undefined) window.clearTimeout(idleTimer)
      window.localStorage.removeItem(LAST_ACTIVITY_KEY)
      await supabase.auth.signOut({ scope: 'local' })
      window.location.replace(reason === 'inactivity' ? '/login?error=session_expired' : '/login?error=account_not_active')
    }

    const scheduleIdleCheck = () => {
      if (expired) return
      if (idleTimer !== undefined) window.clearTimeout(idleTimer)

      const lastActivity = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY))
      const elapsed = Number.isFinite(lastActivity) && lastActivity > 0 ? Date.now() - lastActivity : 0
      const remaining = IDLE_TIMEOUT_MS - elapsed
      if (remaining <= 0) {
        void endSession('inactivity')
        return
      }

      idleTimer = window.setTimeout(scheduleIdleCheck, remaining)
    }

    const recordActivity = () => {
      if (expired) return
      const now = Date.now()
      if (now - lastActivityWrite >= ACTIVITY_WRITE_INTERVAL_MS) {
        window.localStorage.setItem(LAST_ACTIVITY_KEY, String(now))
        lastActivityWrite = now
      }
      scheduleIdleCheck()
    }

    if (!window.localStorage.getItem(LAST_ACTIVITY_KEY)) {
      window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
      lastActivityWrite = Date.now()
    } else {
      lastActivityWrite = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY)) || 0
    }
    scheduleIdleCheck()

    const activityEvents = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'] as const
    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }))
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_KEY) scheduleIdleCheck()
    }
    window.addEventListener('storage', handleStorage)

    const checkAccountStatus = async () => {
      if (expired || document.visibilityState === 'hidden') return

      let response: Response
      try {
        response = await fetch('/api/session-status', { cache: 'no-store', credentials: 'same-origin' })
      } catch (error) {
        console.error('Could not check staff session status:', error)
        return
      }
      if (response.ok) return
      if (response.status !== 401) {
        console.error('Staff session check failed:', response.status, await response.text())
        return
      }

      void endSession('account')
    }

    void checkAccountStatus()
    const interval = window.setInterval(checkAccountStatus, STATUS_CHECK_INTERVAL_MS)
    window.addEventListener('focus', checkAccountStatus)
    document.addEventListener('visibilitychange', checkAccountStatus)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', checkAccountStatus)
      document.removeEventListener('visibilitychange', checkAccountStatus)
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity))
      window.removeEventListener('storage', handleStorage)
      if (idleTimer !== undefined) window.clearTimeout(idleTimer)
    }
  }, [])

  return null
}
