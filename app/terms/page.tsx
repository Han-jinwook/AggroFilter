export const metadata = {
  title: '이용약관 | 어그로필터',
  description: '어그로필터 서비스 이용약관',
}

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'sans-serif', lineHeight: 1.8, color: '#222' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>서비스 이용약관</h1>
      <p style={{ color: '#888', marginBottom: 40 }}>최종 업데이트: 2026년 4월 23일</p>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>1. 목적 및 회사정보</h2>
        <p>본 약관은 <strong>썬드림 주식회사</strong>(이하 &quot;회사&quot;)가 제공하는 어그로필터 서비스(이하 &quot;서비스&quot;)의 이용 조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.</p>
        <ul style={{ paddingLeft: 24, marginTop: 8 }}>
          <li>상호: 썬드림 주식회사</li>
          <li>대표: 한진욱</li>
          <li>이메일: beakes@naver.com</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>2. 이용권 및 결제</h2>
        <p>회사는 서비스 내에서 사용 가능한 디지털 재화(이하 &quot;크레딧&quot; 또는 &quot;이용권&quot;)를 유료로 제공합니다.</p>
        <ul style={{ paddingLeft: 24, marginTop: 8 }}>
          <li>결제 수단: 신용카드, 휴대폰 결제 등 회사가 제공하는 결제 수단</li>
          <li>상품 형태: 결제 즉시 계정에 부여되는 디지털 콘텐츠 (배송 없음)</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>3. 청약철회 및 환불</h2>
        <p>무형의 디지털 콘텐츠의 특성상 다음과 같은 환불 규정을 따릅니다.</p>
        <ul style={{ paddingLeft: 24, marginTop: 8 }}>
          <li>결제 후 7일 이내, 이용권을 단 1회도 사용하지 않은 경우 전액 환불이 가능합니다.</li>
          <li>이용권을 1회 이상 사용한 경우 서비스 제공이 개시된 것으로 간주하여 환불이 불가능합니다.</li>
          <li><strong>휴대폰 결제 취소</strong>: 결제 당월에 한해 취소가 가능하며, 당월 경과 후 환불 시에는 휴대폰 결제 취소가 불가능하므로 환불 수수료를 공제한 후 현금으로 환불됩니다.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>4. 서비스 이용 및 제한</h2>
        <p>회사는 이용자가 타인의 권리를 침해하거나 서비스의 정상적인 운영을 방해하는 경우 서비스 이용을 제한하거나 계정을 삭제할 수 있습니다.</p>
      </section>

      <section>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>5. 관할 법원</h2>
        <p>서비스 이용과 관련하여 발생한 분쟁에 대해서는 회사의 본점 소재지를 관할하는 법원을 전용 관할 법원으로 합니다.</p>
      </section>
    </main>
  )
}
