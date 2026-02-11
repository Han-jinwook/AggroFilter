import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      return NextResponse.json({ user: null }, { status: 200 })
    }

    const user = data.user
    if (!user) return NextResponse.json({ user: null }, { status: 200 })

    return NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 200 })
  } catch (e) {
    return NextResponse.json({ user: null }, { status: 200 })
  }
}
