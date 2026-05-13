/**
 * /payment/* 전용 레이아웃
 * - 루트 layout의 Header, Footer, BottomBanner, SideWingAds를 모두 차단
 * - KCP 결제창은 팝업(popup) 형태로 열리므로 완전한 빈 껍데기 레이아웃이 필요
 */
export default function PaymentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
