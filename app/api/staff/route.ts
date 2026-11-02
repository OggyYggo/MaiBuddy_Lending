import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

const allowedRoles = ['loan_officer', 'admin', 'super_admin'] as const

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'super_admin' || profile.status !== 'active') {
    return NextResponse.json({ error: 'Only an active super admin can add staff.' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Enter the staff details and try again.' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Enter the staff details and try again.' }, { status: 400 })
  }

  const input = body as Record<string, unknown>
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const fullName = typeof input.full_name === 'string' ? input.full_name.trim() : ''
  const role = input.role
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !fullName || fullName.length > 120
      || typeof role !== 'string' || !allowedRoles.includes(role as typeof allowedRoles[number])) {
    return NextResponse.json({ error: 'Provide a valid email, name, and staff role.' }, { status: 400 })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !secretKey) {
    console.error('Staff invitations are missing their server secret configuration.')
    return NextResponse.json({ error: 'Staff invitations are temporarily unavailable.' }, { status: 503 })
  }

  const headers = {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json',
  }
  const baseUrl = supabaseUrl.replace(/\/$/, '')

  try {
    const inviteResponse = await fetch(`${baseUrl}/auth/v1/invite`, {
      method: 'POST',
      cache: 'no-store',
      headers,
      body: JSON.stringify({ email, data: { full_name: fullName } }),
    })
    const invited = await inviteResponse.json().catch(() => null)
    if (!inviteResponse.ok) {
      return NextResponse.json({ error: invited?.msg || invited?.message || 'Could not invite this staff member.' }, { status: inviteResponse.status })
    }

    const profileResponse = await fetch(
      `${baseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(invited.id)}`,
      {
        method: 'PATCH',
        cache: 'no-store',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ full_name: fullName, role }),
      },
    )
    if (!profileResponse.ok) {
      console.error('Invited staff profile role assignment failed:', await profileResponse.text())
      return NextResponse.json({ error: 'The invite was sent, but the role could not be assigned. Update the profile in Supabase before the user signs in.' }, { status: 502 })
    }

    return NextResponse.json({ invited: true }, { status: 201 })
  } catch (error) {
    console.error('Staff invitation failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Staff invitations are temporarily unavailable.' }, { status: 503 })
  }
}
