import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('settings')
    .select('*')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const settingsMap: Record<string, string> = {}
  data?.forEach((setting) => {
    settingsMap[setting.key] = setting.value
  })

  return NextResponse.json(settingsMap)
}
