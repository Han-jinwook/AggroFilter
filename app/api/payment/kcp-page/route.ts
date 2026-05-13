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
  return handleRequest(req)
}

export async function POST(req: NextRequest) {
  return handleRequest(req)
}

async function handleRequest(req: NextRequest) {
  const isPost = req.method === 'POST'
  const p = req.nextUrl.searchParams
  
  // POST일 경우 폼 데이터 파싱
  let formData: FormData | null = null
  if (isPost) {
    try {
      formData = await req.formData()
    } catch (e) {
      console.warn('[KCP-PAGE] Failed to parse form data in POST')
    }
  }

  // 데이터 획득 유틸리티: URL 파라미터 우선, 그 다음 폼 데이터
  const getVal = (key: string, defaultValue: string = '') => {
    const urlVal = p.get(key)
    if (urlVal) return urlVal
    if (formData && formData.has(key)) return String(formData.get(key))
    return defaultValue
  }

  // 파라미터 이스케이프 처리 (XSS 방지)
  const esc = (val: string) =>
    val.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="referrer" content="no-referrer-when-downgrade">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>결제 진행 중 | 어그로필터</title>
  <script src="https://pay.kcp.co.kr/plugin/payplus_web.jsp"></script>
  <style>
    body { margin: 0; padding: 0; overflow: hidden; display: flex; align-items: flex-start; justify-content: center; min-height: 100vh; background: #fff; }
    #loading-box { text-align: center; color: #475569; transition: opacity 0.3s ease; padding-top: 200px; }
    .spinner { width: 40px; height: 40px; border: 4px solid #e2e8f0; border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="loading-box">
    <div class="spinner"></div>
    <p id="status">결제창을 불러오는 중입니다...</p>
  </div>

  <form name="order_info" method="post">
    <input type="hidden" name="ordr_idxx"    value="${esc(getVal('ordr_idxx'))}" />
    <input type="hidden" name="good_name"    value="${esc(getVal('good_name'))}" />
    <input type="hidden" name="good_mny"     value="${esc(getVal('good_mny'))}" />
    <input type="hidden" name="buyr_name"    value="${esc(getVal('buyr_name'))}" />
    <input type="hidden" name="buyr_mail"    value="${esc(getVal('buyr_mail'))}" />
    <input type="hidden" name="site_cd"      value="${esc(getVal('site_cd', 'ALRJ8'))}" />
    <input type="hidden" name="site_name"    value="어그로필터" />
    <input type="hidden" name="pay_method"   value="${esc(getVal('pay_method'))}" />
    <input type="hidden" name="req_tx"       value="pay" />
    <input type="hidden" name="currency"     value="WON" />
    <input type="hidden" name="module_type"  value="01" />
    <input type="hidden" name="res_cd"       value="${esc(getVal('res_cd'))}" />
    <input type="hidden" name="res_msg"      value="${esc(getVal('res_msg'))}" />
    <input type="hidden" name="enc_info"     value="${esc(getVal('enc_info'))}" />
    <input type="hidden" name="enc_data"     value="${esc(getVal('enc_data'))}" />
    <input type="hidden" name="ret_pay_method" value="${esc(getVal('ret_pay_method'))}" />
    <input type="hidden" name="tran_cd"      value="${esc(getVal('tran_cd'))}" />
    <input type="hidden" name="use_pay_method" value="${esc(getVal('use_pay_method'))}" />
    <input type="hidden" name="buyr_tel1"    value="${esc(getVal('buyr_tel1'))}" />
    <input type="hidden" name="buyr_tel2"    value="${esc(getVal('buyr_tel2'))}" />
    <input type="hidden" name="param_opt_1"  value="${esc(getVal('param_opt_1'))}" />
    <input type="hidden" name="Ret_URL"      value="${esc(getVal('Ret_URL'))}" />
  </form>

  <script>
    var attempts = 0;
    var maxAttempts = 100;
    var isTriggered = false;

    function checkAndPay() {
      if (isTriggered) return;

      var kcpFunc = (typeof js_f_pay === 'function') ? js_f_pay : 
                    (typeof KCP_Pay_Execute === 'function') ? KCP_Pay_Execute : null;
      
      if (kcpFunc) {
        isTriggered = true;
        console.log('[KCP-POPUP] KCP function found! Triggering...');
        
        var lb = document.getElementById('loading-box');
        lb.style.opacity = '0';
        setTimeout(function() {
          lb.style.display = 'none';
          try {
            kcpFunc(document.order_info);
          } catch (e) {
            console.error('[KCP-POPUP] Execution error:', e);
            alert('결제 실행 중 오류가 발생했습니다.');
          }
        }, 300);
      } else if (attempts++ < maxAttempts) {
        document.getElementById('status').textContent = '결제 모듈 로드 중... (' + Math.ceil((maxAttempts - attempts) / 10) + '초)';
        setTimeout(checkAndPay, 100);
      } else {
        isTriggered = true;
        document.body.innerHTML =
          '<div style="text-align:center;padding:40px;font-family:sans-serif;color:#ef4444">' +
          '<p style="font-size:18px;font-weight:bold;">결제 모듈 로드 실패</p>' +
          '<p>이 창을 닫고 다시 시도해 주세요.</p>' +
          '</div>';
      }
    }

    document.addEventListener('DOMContentLoaded', function() {
      // POST로 들어온 경우(암호화 데이터 등이 채워진 상태) 즉시 실행 시도
      var delay = ${isPost ? 0 : 200};
      setTimeout(checkAndPay, delay);
    });
  </script>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer-when-downgrade'
    },
  })
}
