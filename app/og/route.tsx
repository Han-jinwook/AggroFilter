import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET(): Promise<Response> {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #0ea5e9 0%, #4f46e5 50%, #9333ea 100%)',
          color: '#ffffff',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
          padding: '64px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: 36,
              background: 'rgba(255,255,255,0.15)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: 96,
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            A
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 68, fontWeight: 900, letterSpacing: '-0.02em' }}>어그로필터</div>
            <div style={{ fontSize: 34, fontWeight: 700, opacity: 0.95, marginTop: 8 }}>
              AI 유튜브 신뢰도 분석
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 44,
            fontSize: 30,
            fontWeight: 600,
            opacity: 0.95,
            textAlign: 'center',
            maxWidth: 980,
          }}
        >
          유튜브 영상의 신뢰도를 AI로 분석합니다. 정확성 · 어그로성 · 신뢰도 점수를 한눈에.
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 40,
            right: 56,
            fontSize: 24,
            fontWeight: 700,
            opacity: 0.9,
          }}
        >
          aggrofilter.com
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
