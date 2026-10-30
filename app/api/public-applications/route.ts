import { createHmac } from 'node:crypto'
import { NextResponse } from 'next/server'
import { publicLoanApplicationSchema } from '@/lib/validations'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Enter the application details and try again.' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Enter the application details and try again.' }, { status: 400 })
  }

  const rawBody = body as Record<string, unknown>
  // Silently accept honeypot submissions without storing them.
  if (typeof rawBody.website === 'string' && rawBody.website.trim()) {
    return NextResponse.json({ submitted: true }, { status: 202 })
  }

  const validation = publicLoanApplicationSchema.safeParse(rawBody)
  if (!validation.success) {
    return NextResponse.json({
      error: validation.error.issues[0]?.message || 'Check the application details and try again.',
    }, { status: 400 })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const address = request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown'
  if (!supabaseUrl || !secretKey) {
    console.error('Public application intake is missing its server secret configuration.')
    return NextResponse.json({ error: 'Applications are temporarily unavailable. Please try again later.' }, { status: 503 })
  }

  const submissionFingerprint = createHmac('sha256', secretKey).update(address).digest('hex')
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/submit_public_application`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        p_full_name: validation.data.full_name,
        p_birth_date: validation.data.birth_date,
        p_phone: validation.data.phone,
        p_address: validation.data.address,
        p_employer: validation.data.employer || null,
        p_monthly_income: validation.data.monthly_income ?? null,
        p_id_type: validation.data.id_type || null,
        p_id_number: validation.data.id_number || null,
        p_amount: validation.data.amount,
        p_term_months: validation.data.term_months,
        p_purpose: validation.data.purpose,
        p_repayment_style: validation.data.repayment_style,
        p_submission_fingerprint: submissionFingerprint,
      }),
    })
    const result = await response.json().catch(() => null)

    if (!response.ok) {
      if (result?.code === 'P0001' && String(result?.message).toLowerCase().includes('rate limit')) {
        return NextResponse.json({ error: 'Too many applications were submitted from this network. Please try again later.' }, { status: 429 })
      }
      console.error('Public application submission failed:', { status: response.status, code: result?.code, message: result?.message })
      return NextResponse.json({ error: 'We could not submit your application. Please try again later.' }, { status: 500 })
    }

    const application = Array.isArray(result) ? result[0] : result
    return NextResponse.json({ submitted: true, reference: application?.application_reference }, { status: 201 })
  } catch (error) {
    console.error('Public application service is unavailable:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Applications are temporarily unavailable. Please try again later.' }, { status: 503 })
  }
}
