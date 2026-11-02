'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

const STATUS_CHECK_INTERVAL_MS = 15_000

export default function SessionExpiryGuard() {
  useEffect(() => {
    const supabase = createClient()
    let expired = false

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

      expired = true
      await supabase.auth.signOut({ scope: 'local' })
      window.location.replace('/login?error=account_not_active')
    }

    void checkAccountStatus()
    const interval = window.setInterval(checkAccountStatus, STATUS_CHECK_INTERVAL_MS)
    window.addEventListener('focus', checkAccountStatus)
    document.addEventListener('visibilitychange', checkAccountStatus)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', checkAccountStatus)
      document.removeEventListener('visibilitychange', checkAccountStatus)
    }
  }, [])

  return null
}
