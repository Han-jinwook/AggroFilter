import { NextResponse } from 'next/server'
import {
  addCreditsByEmail,
  calculateCreditsFromOrder,
  extractUserEmailFromOrder,
  fetchCafe24Order,
  getCafe24WebhookSecret,
  logUnclaimedPayment, // Import the new function
  markWebhookEventOnce,
} from '@/lib/cafe24'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    if (!secret || secret !== getCafe24WebhookSecret()) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const bodyText = await request.text()
    let payload: any = null
    try {
      payload = bodyText ? JSON.parse(bodyText) : {}
    } catch {
      payload = {}
    }

    const eventId = String(payload?.event_id || payload?.id || '') || `${Date.now()}-${Math.random()}`
    const eventType = payload?.event_type ? String(payload.event_type) : payload?.type ? String(payload.type) : null
    const orderId = payload?.order_id ? String(payload.order_id) : payload?.orderId ? String(payload.orderId) : null

    const inserted = await markWebhookEventOnce({ id: eventId, eventType, orderId })
    if (!inserted) {
      return NextResponse.json({ ok: true, deduped: true })
    }

    if (!orderId) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const orderData = await fetchCafe24Order(orderId)

    // Security Check: Verify payment status
    // payment_status: 'T' means Paid/Completed in Cafe24
    const paymentStatus = orderData?.order?.payment_status
    if (paymentStatus !== 'T') {
      return NextResponse.json({ 
        ok: true, 
        skipped: true, 
        reason: 'payment_not_completed', 
        paymentStatus 
      })
    }

    const email = extractUserEmailFromOrder(orderData)
    if (!email) {
      return NextResponse.json({ ok: false, error: 'user_email_not_found', orderId }, { status: 422 })
    }

    const credits = calculateCreditsFromOrder(orderData)
    if (!Number.isFinite(credits) || credits <= 0) {
      return NextResponse.json({ ok: false, error: 'no_credit_items', orderId }, { status: 422 })
    }

    const { success: userFoundAndCredited, userId } = await addCreditsByEmail({ email, amount: credits })

    if (!userFoundAndCredited) {
      // User not found, log as an unclaimed payment
      await logUnclaimedPayment(orderData);
      return NextResponse.json({ ok: true, status: 'unclaimed_payment_logged', orderId, email });
    }

    // Log successful payment
    const { logPayment } = await import('@/lib/cafe24');
    await logPayment({
      orderId,
      userId: userId || null,
      email,
      amount: parseFloat(orderData?.order?.actual_order_amount) || 0,
      credits,
      data: orderData
    });

    return NextResponse.json({ ok: true, status: 'credits_added', orderId, email, credits })
  } catch (e) {
    console.error('Cafe24 webhook error:', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
