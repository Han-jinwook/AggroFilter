# AggroFilter - 컴포넌트 기반 리팩토링 전체 코드
# VIBE CODING NAMING RULES (v2.0) 적용 - 최종 확정 버전

## 전체 컴포넌트 트리 구조

\`\`\`
프로젝트 컴포넌트 구조 (Vibe Coding Rules v2.0 적용)
├── app/
│   ├── page.tsx (MainPage) ─────────────────── 홈페이지 메인
│   ├── p-plaza/page.tsx (PlazaPage) ────────── 분석 Plaza (p- 접두사)
│   ├── result/page.tsx (ResultPage) ────────── 분석 결과
│   └── channel/[id]/page.tsx (ChannelPage) ── 채널 리포트
│
├── components/
│   ├── c-home/ ────────────────────────────── 홈페이지 전용 (c- 접두사)
│   │   ├── hero-section.tsx ─────────────── URL 입력 영역
│   │   ├── feature-cards.tsx ────────────── 기능 소개 카드 3개
│   │   ├── analysis-status.tsx ──────────── 분석 상태 표시
│   │   ├── onboarding-guide.tsx ─────────── 사용 안내
│   │   └── disclaimer.tsx ───────────────── 유의사항
│   │
│   ├── c-plaza/ ───────────────────────────── Plaza 페이지 전용 (c- 접두사)
│   │   ├── tab-header.tsx ───────────────── 영상/채널 탭 + 검색
│   │   ├── filter-tabs.tsx ──────────────── 분석수/신뢰도/어그로 필터
│   │   └── hot-issue-card.tsx ───────────── 핫이슈 리스트 아이템
│   │
│   ├── c-result/ ──────────────────────────── Result 페이지 전용 (c- 접두사)
│   │   ├── analysis-header.tsx ──────────── 채널 정보 헤더
│   │   ├── score-card.tsx ───────────────── 점수 표시 카드
│   │   └── interaction-bar.tsx ──────────── 좋아요/싫어요/공유
│   │
│   └── ui/ ────────────────────────────────── 공통 UI (shadcn)
│       ├── button.tsx
│       ├── card.tsx
│       └── ...
│
├── types/
│   └── t-components/ ──────────────────────── 타입 정의 (t- 접두사)
│       └── component.types.ts
│
└── utils/
    └── u-score/ ───────────────────────────── 유틸리티 (u- 접두사)
        └── score.util.ts
\`\`\`

---

## 0. 타입 정의 파일

\`\`\`ts
// filepath: types/t-components/component.types.ts
/*
 * ============================================
 * TYPE DEFINITIONS (Vibe Coding Rules v2.0)
 * ============================================
 * - 타입/인터페이스: T + PascalCase
 * - 열거형: E + PascalCase
 * - DB 컬럼: f_ + snake_case
 * ============================================
 */

import type { LucideIcon } from 'lucide-react'

// === [Enum: ETabType] ===
export enum ETabType {
  VIDEO = "video",
  CHANNEL = "channel",
}

// === [Enum: EFilterType] ===
export enum EFilterType {
  VIEWS = "views",
  TRUST = "trust",
  AGGRO = "aggro",
}

// === [Enum: ESortDirection] ===
export enum ESortDirection {
  BEST = "best",
  WORST = "worst",
}

// === [Type: THeroSectionProps] ===
export interface THeroSectionProps {
  url: string
  isAnalyzing: boolean
  isCompleted: boolean
  onUrlChange: (url: string) => void
  onAnalyze: () => void
}

// === [Type: TAnalysisStatusProps] ===
export interface TAnalysisStatusProps {
  isAnalyzing: boolean
  isCompleted: boolean
}

// === [Type: TDisclaimerProps] ===
export interface TDisclaimerProps {
  isAnalyzing: boolean
  isCompleted: boolean
}

// === [Type: TFeatureCard] ===
export interface TFeatureCard {
  icon: LucideIcon
  title: string
  description: string
  gradient: string
  iconColor: string
}

// === [Type: TTabHeaderProps] ===
export interface TTabHeaderProps {
  activeTab: ETabType
  isSearchExpanded: boolean
  searchQuery: string
  onTabChange: (tab: ETabType) => void
  onSearchToggle: (expanded: boolean) => void
  onSearchChange: (query: string) => void
}

// === [Type: TFilterTabsProps] ===
export interface TFilterTabsProps {
  activeFilter: EFilterType
  sortDirection: ESortDirection
  onFilterChange: (filter: EFilterType) => void
  onSortToggle: () => void
}

// === [Type: THotIssueItem] - DB 컬럼 규칙 적용 ===
export interface THotIssueItem {
  f_id: number
  f_rank: number
  f_title: string
  f_channel: string
  f_topic?: string
  f_views?: string
  f_score: number
}

// === [Type: THotIssueCardProps] ===
export interface THotIssueCardProps {
  item: THotIssueItem
  type: EFilterType
}

// === [Type: TAnalysisHeaderProps] ===
export interface TAnalysisHeaderProps {
  channelImage: string
  channelName: string
  date: string
  onBack: () => void
  onChannelClick: () => void
}

// === [Type: TScoreCardProps] ===
export interface TScoreCardProps {
  accuracy: number
  clickbait: number
  trust: number
  trafficLightImage: string
}

// === [Type: TInteractionBarProps] ===
export interface TInteractionBarProps {
  liked: boolean
  disliked: boolean
  likeCount: number
  dislikeCount: number
  onLike: () => void
  onDislike: () => void
  onShare: () => void
}

// === [Type: TTooltipButtonProps] ===
export interface TTooltipButtonProps {
  active: boolean
  onToggle: () => void
  content: string
}
\`\`\`

---

## 1. 홈페이지 메인 파일

\`\`\`tsx
// filepath: app/page.tsx
/*
 * ============================================
 * COMPONENT TREE - MainPage (Homepage)
 * ============================================
 * Vibe Coding Rules v2.0 적용
 * - 컴포넌트 폴더: c- 접두사
 * - 타입: T 접두사
 * ============================================
 */

"use client"

import { useState, useEffect } from "react"
import { useRouter } from 'next/navigation'
import { AppHeader } from "@/components/app-header"
import { LoginModal } from "@/components/login-modal"
import { HeroSection } from "@/components/c-home/hero-section"
import { AnalysisStatus, AnalysisCharacter } from "@/components/c-home/analysis-status"
import { FeatureCards } from "@/components/c-home/feature-cards"
import { OnboardingGuide } from "@/components/c-home/onboarding-guide"
import { Disclaimer } from "@/components/c-home/disclaimer"

// === [Component: MainPage] ===
export default function MainPage() {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const storedEmail = localStorage.getItem("userEmail")
    if (storedEmail) {
      setUserEmail(storedEmail)
    }
  }, [])

  useEffect(() => {
    if (isCompleted) {
      const timer = setTimeout(() => {
        router.push("/result")
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isCompleted, router])

  useEffect(() => {
    const handleOpenLoginModal = () => {
      setShowLoginModal(true)
    }
    window.addEventListener("openLoginModal", handleOpenLoginModal)
    return () => {
      window.removeEventListener("openLoginModal", handleOpenLoginModal)
    }
  }, [])

  const handleAnalyze = async () => {
    if (!url.trim()) return

    if (!userEmail) {
      setShowLoginModal(true)
      return
    }

    setIsAnalyzing(true)
    console.log("분석 요청:", url)

    setTimeout(() => {
      setIsAnalyzing(false)
      setIsCompleted(true)
    }, 5000)
  }

  const handleLoginSuccess = (email: string) => {
    localStorage.setItem("userEmail", email)
    setUserEmail(email)

    const nickname = email.split("@")[0]
    localStorage.setItem("userNickname", nickname)
    localStorage.setItem("userProfileImage", "")

    window.dispatchEvent(new CustomEvent("profileUpdated"))

    if (url.trim()) {
      setIsAnalyzing(true)
      console.log("분석 요청:", url)
      setTimeout(() => {
