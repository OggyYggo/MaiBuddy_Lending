import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ active: false }, {
      status: 401,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Could not verify staff session status:', profileError.message)
    return NextResponse.json({ error: 'Could not verify account status.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  }

  if (profile?.status !== 'active') {
    await supabase.auth.signOut({ scope: 'local' })
    return NextResponse.json({ active: false }, {
      status: 401,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  }

  return NextResponse.json({ active: true }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
