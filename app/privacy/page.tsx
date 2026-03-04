export const metadata = {
  title: '개인정보처리방침 | 어그로필터',
  description: '어그로필터 개인정보처리방침',
}

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'sans-serif', lineHeight: 1.8, color: '#222' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>개인정보처리방침</h1>
      <p style={{ color: '#888', marginBottom: 40 }}>최종 업데이트: 2026년 3월 4일</p>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>1. 수집하는 개인정보</h2>
        <p>어그로필터(이하 "서비스")는 다음과 같은 정보를 수집합니다.</p>
        <ul style={{ paddingLeft: 24, marginTop: 8 }}>
          <li><strong>이메일 주소</strong>: 로그인 및 알림 발송 목적</li>
          <li><strong>닉네임</strong>: 서비스 내 프로필 표시 목적 (선택)</li>
          <li><strong>YouTube 영상 자막 및 메타데이터</strong>: AI 신뢰도 분석 목적 (분석 요청 시에만 수집)</li>
          <li><strong>서비스 이용 기록</strong>: 분석 이력, 채널 구독 현황</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>2. 개인정보의 이용 목적</h2>
        <ul style={{ paddingLeft: 24 }}>
          <li>YouTube 영상 AI 신뢰도 분석 서비스 제공</li>
          <li>채널 신뢰도 랭킹 산출 및 표시</li>
          <li>구독 채널 변화 알림 이메일 발송</li>
          <li>서비스 이용 통계 및 품질 개선</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>3. 개인정보의 보유 및 이용 기간</h2>
        <ul style={{ paddingLeft: 24 }}>
          <li>회원 탈퇴 시 즉시 삭제 (단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 보관)</li>
          <li>비로그인 분석 데이터: 3년 보관 후 삭제</li>
          <li>결제 기록: 전자상거래법에 따라 5년 보관</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>4. 개인정보의 제3자 제공</h2>
        <p>서비스는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 단, 다음의 경우는 예외로 합니다.</p>
        <ul style={{ paddingLeft: 24, marginTop: 8 }}>
          <li>이용자가 사전에 동의한 경우</li>
          <li>법령의 규정에 의거하거나 수사기관의 요청이 있는 경우</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>5. 크롬 확장프로그램 관련</h2>
        <p>어그로필터 크롬 확장프로그램은 다음과 같이 동작합니다.</p>
        <ul style={{ paddingLeft: 24, marginTop: 8 }}>
          <li>YouTube 영상 페이지에서 <strong>분석 버튼 클릭 시에만</strong> 자막·메타데이터를 서버로 전송합니다.</li>
          <li>시청 기록, 검색 기록, 로그인 정보 등은 일절 수집하지 않습니다.</li>
          <li>확장프로그램은 YouTube 및 aggrofilter.com 도메인에서만 동작합니다.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>6. 이용자의 권리</h2>
        <p>이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
        <ul style={{ paddingLeft: 24, marginTop: 8 }}>
          <li>개인정보 열람, 수정, 삭제 요청</li>
          <li>서비스 탈퇴 및 데이터 삭제 요청</li>
        </ul>
        <p style={{ marginTop: 8 }}>요청은 아래 이메일로 연락 주세요.</p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>7. 개인정보보호 책임자</h2>
        <ul style={{ paddingLeft: 24 }}>
          <li><strong>서비스명</strong>: 어그로필터 (AggroFilter)</li>
          <li><strong>문의 이메일</strong>: chiu3@aggrofilter.com</li>
          <li><strong>웹사이트</strong>: https://aggrofilter.com</li>
        </ul>
      </section>

      <section>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>8. 개인정보처리방침 변경</h2>
        <p>본 방침은 법령·서비스 변경에 따라 업데이트될 수 있으며, 변경 시 서비스 내 공지합니다.</p>
      </section>
    </main>
  )
}
