import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import type { Database } from '@/types/supabase'

type Setting = Database['public']['Tables']['settings']['Row']

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('settings')
    .select('*')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const settingsMap: Record<string, string> = {}
  data?.forEach((setting: Setting) => {
    settingsMap[setting.key] = setting.value
  })

  return NextResponse.json(settingsMap)
}
