import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const supabase = createClient()
    await supabase.auth.signOut()
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (e) {
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
