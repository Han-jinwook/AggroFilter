import { NextRequest, NextResponse } from 'next/server'

/**
 * [근본 해결책] KCP 결제 전용 순수 HTML 페이지
 *
 * React/Next.js SPA에서는 HTML 파싱이 끝난 후 스크립트를 로드하므로
 * KCP의 payplus_web.jsp 내부의 document.write가 작동하지 않아 js_f_pay가 정의되지 않음.
 *
 * 이 API 라우트는 순수 HTML 페이지를 반환하여 팝업으로 열리게 함.
 * 팝업 내부는 전통적인 HTML 환경이므로 KCP 스크립트가 정상 동작함.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams

  // 파라미터 이스케이프 처리 (XSS 방지)
  const esc = (val: string) =>
    val.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>결제 진행 중 | 어그로필터</title>
  <script src="https://pay.kcp.co.kr/plugin/payplus_web.jsp"></script>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; }
    .box { text-align: center; color: #475569; }
    .spinner { width: 40px; height: 40px; border: 4px solid #e2e8f0; border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="box">
    <div class="spinner"></div>
    <p id="status">결제창을 불러오는 중입니다...</p>
  </div>

  <form name="order_info" method="post" style="display:none">
    <input type="hidden" name="ordr_idxx"    value="${esc(p.get('ordr_idxx') || '')}" />
    <input type="hidden" name="good_name"    value="${esc(p.get('good_name') || '')}" />
    <input type="hidden" name="good_mny"     value="${esc(p.get('good_mny') || '')}" />
    <input type="hidden" name="buyr_name"    value="${esc(p.get('buyr_name') || '')}" />
    <input type="hidden" name="buyr_mail"    value="" />
    <input type="hidden" name="site_cd"      value="${esc(p.get('site_cd') || 'ALRJ8')}" />
    <input type="hidden" name="site_name"    value="어그로필터" />
    <input type="hidden" name="pay_method"   value="${esc(p.get('pay_method') || '')}" />
    <input type="hidden" name="req_tx"       value="pay" />
    <input type="hidden" name="currency"     value="WON" />
    <input type="hidden" name="module_type"  value="01" />
    <input type="hidden" name="res_cd"       value="" />
    <input type="hidden" name="res_msg"      value="" />
    <input type="hidden" name="enc_info"     value="" />
    <input type="hidden" name="enc_data"     value="" />
    <input type="hidden" name="ret_pay_method" value="" />
    <input type="hidden" name="tran_cd"      value="" />
    <input type="hidden" name="use_pay_method" value="" />
    <input type="hidden" name="buyr_tel1"    value="" />
    <input type="hidden" name="buyr_tel2"    value="" />
    <input type="hidden" name="param_opt_1"  value="${esc(p.get('param_opt_1') || '')}" />
    <input type="hidden" name="Ret_URL"      value="${esc(p.get('Ret_URL') || '')}" />
  </form>

  <script>
    var attempts = 0;
    var maxAttempts = 100; // 10초 (100ms * 100)

    function checkAndPay() {
      console.log('[KCP-POPUP] Checking js_f_pay... attempt=' + attempts + ', defined=' + (typeof js_f_pay));
      
      if (typeof js_f_pay === 'function') {
        console.log('[KCP-POPUP] js_f_pay found! Triggering...');
        document.getElementById('status').textContent = '결제창을 여는 중...';
        js_f_pay(document.order_info);
      } else if (attempts++ < maxAttempts) {
        document.getElementById('status').textContent = '결제 모듈 로드 중... (' + Math.ceil((maxAttempts - attempts) / 10) + '초)';
        setTimeout(checkAndPay, 100);
      } else {
        console.error('[KCP-POPUP] js_f_pay NOT defined after 10s. window keys:', Object.keys(window).filter(k => k.includes('js') || k.includes('kcp') || k.includes('pay')));
        document.body.innerHTML =
          '<div style="text-align:center;padding:40px;font-family:sans-serif;color:#ef4444">' +
          '<p style="font-size:18px;font-weight:bold;">결제 모듈 로드 실패</p>' +
          '<p>이 창을 닫고 페이지를 새로고침 후 다시 시도해 주세요.</p>' +
          '<p style="font-size:12px;color:#94a3b8;margin-top:16px;">오류코드: KCP_MODULE_UNAVAILABLE</p>' +
          '</div>';
      }
    }

    // DOM 로드 완료 후 즉시 시작
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(checkAndPay, 300);
    });
  </script>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
