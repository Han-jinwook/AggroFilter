'use client';

import React, { useEffect, useRef } from 'react';

export interface HubGoogleAdProps {
  /** 구글 애드센스 클라이언트 ID (예: ca-pub-xxxx) */
  client: string;
  /** 구글 애드센스 슬롯 ID */
  slot: string;
  /** 구글 광고 포맷 (기본: auto) */
  format?: string;
  /** 반응형 지원 여부 (기본: true) */
  responsive?: boolean;
  /** 커스텀 클래스 */
  className?: string;
  /** 인라인 스타일 */
  style?: React.CSSProperties;
}

export function HubGoogleAd({ 
  client, 
  slot, 
  format = 'auto', 
  responsive = true,
  className,
  style
}: HubGoogleAdProps) {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    // 광고가 이미 로드되었는지 체크 방지용
    if (adRef.current && adRef.current.childElementCount === 0) {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } catch (e) {
        console.error('AdSense error', e);
      }
    }
  }, []);

  return (
    <ins
      ref={adRef}
      className={`adsbygoogle ${className || ''}`}
      style={{ display: 'block', ...style }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? 'true' : 'false'}
    />
  );
}
