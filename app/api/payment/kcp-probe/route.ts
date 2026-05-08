import { NextResponse } from 'next/server'

/**
 * KCP 스크립트가 실제로 어떤 내용을 반환하는지 서버 측에서 확인하는 진단 라우트
 * 브라우저 CORS 제약 없이 KCP 서버 응답을 직접 확인 가능
 */
export async function GET() {
  try {
    const res = await fetch('https://pay.kcp.co.kr/plugin/payplus_web.jsp', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://aggrofilter.com',
      },
    })

    const text = await res.text()

    return NextResponse.json({
      status: res.status,
      contentType: res.headers.get('content-type'),
      length: text.length,
      hasJsFPay: text.includes('js_f_pay'),
      preview: text.substring(0, 500),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
