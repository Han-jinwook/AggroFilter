'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { AppHeader } from '@/components/c-app-header'
import { Search, X, ChevronDown, Filter, TrendingUp } from 'lucide-react'
import Image from 'next/image'
import { LoginModal } from '@/components/c-login-modal'
import Link from 'next/link'

interface TRealtimeVideo {
  id: string
  date: string
  title: string
  channel: string
  channelIcon: string
  score: number
  rank: number
  totalRank: number
  trustLevel: 'high' | 'low'
}

interface TRealtimeChannel {
  id: string
  date: string
  channelName: string
  topic: string
  videoCount: number
  rankScore: number
  trustLevel: 'high' | 'low'
}

const mockRealtimeVideos: TRealtimeVideo[] = [
  {
    id: '1',
    date: '25.02.07',
    title: '곧 컴백한다는 지드래곤의 솔로곡',
    channel: '아이돌아카이브',
    channelIcon: '/winding-waterway.png',
    score: 100,
    rank: 1,
    totalRank: 20,
    trustLevel: 'high',
  },
  {
    id: '2',
    date: '25.02.07',
    title: '비트코인은 몇 송 모두에게 자비가 없다',
    channel: '비트코인 차트두우',
    channelIcon: '/bitcoin-concept.png',
    score: 85,
    rank: 2,
    totalRank: 20,
    trustLevel: 'high',
  },
  {
    id: '3',
    date: '25.02.07',
    title: '🚨긴급🚨 비트코인 지금 당장 사세요!!!',
    channel: '코인왕',
    channelIcon: '/crypto-digital-landscape.png',
    score: 35,
    rank: 15,
    totalRank: 20,
    trustLevel: 'low',
  },
  {
    id: '4',
    date: '25.02.06',
    title: '혹백요리사 에기잘 갈데 꺼더리면 안 된다',
    channel: '백종원 PAIK JONG WON',
    channelIcon: '/diverse-chef-preparing-food.png',
    score: 80,
    rank: 3,
    totalRank: 20,
    trustLevel: 'high',
  },
  {
    id: '5',
    date: '25.02.06',
    title: '충격! 이 영상 보면 인생 바뀝니다',
    channel: '클릭베이트TV',
    channelIcon: '/news-collage.png',
    score: 25,
    rank: 18,
    totalRank: 20,
    trustLevel: 'low',
  },
]

const mockRealtimeChannels: TRealtimeChannel[] = [
  {
    id: '1',
    date: '25.02.18',
    channelName: '백종원 PAIK JONG WON',
    topic: '요리',
    videoCount: 15,
    rankScore: 85,
    trustLevel: 'high',
  },
  {
    id: '2',
    date: '25.02.18',
    channelName: 'Soothing Ghibli Piano',
    topic: '일본 애니',
    videoCount: 22,
    rankScore: 92,
    trustLevel: 'high',
  },
  {
    id: '3',
    date: '25.02.18',
    channelName: '코인왕',
    topic: '암호화폐',
    videoCount: 8,
    rankScore: 30,
    trustLevel: 'low',
  },
  {
    id: '4',
    date: '25.02.17',
    channelName: '서울경제TV',
    topic: '경제 뉴스',
    videoCount: 25,
    rankScore: 88,
    trustLevel: 'high',
  },
  {
    id: '5',
    date: '25.02.17',
    channelName: '클릭베이트TV',
    topic: '엔터',
    videoCount: 12,
    rankScore: 22,
    trustLevel: 'low',
  },
]

const channelVideos: { [key: string]: TRealtimeVideo[] } = {
  '1': [ // 백종원 PAIK JONG WON
    {
      id: 'v1',
      date: '25.02.05',
      title: '영상을 만든 어떤 아쿠타아아?',
      channel: '백종원 PAIK JONG WON',
      channelIcon: '/diverse-chef-preparing-food.png',
      score: 85,
      rank: 1,
      totalRank: 3,
      trustLevel: 'high',
    },
    {
      id: 'v2',
      date: '25.02.01',
      title: '[티티뉴스] 백종원 대변 맛있다빔띠다',
      channel: '백종원 PAIK JONG WON',
      channelIcon: '/diverse-chef-preparing-food.png',
      score: 88,
      rank: 2,
      totalRank: 3,
      trustLevel: 'high',
    },
  ],
  '2': [ // Soothing Ghibli Piano
    {
      id: 'v3',
      date: '25.02.10',
      title: 'Relaxing Piano Music for Study',
      channel: 'Soothing Ghibli Piano',
      channelIcon: '/placeholder.svg',
      score: 92,
      rank: 1,
      totalRank: 6,
      trustLevel: 'high',
    },
  ],
}

export default function RealTimeBestClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tabParam = searchParams.get('tab') as 'videos' | 'channels' | null
  const [activeTab, setActiveTab] = useState<'videos' | 'channels'>(tabParam || 'videos')
  const [videos, setVideos] = useState(mockRealtimeVideos)
  const [channels, setChannels] = useState(mockRealtimeChannels)
  const [filterTrust, setFilterTrust] = useState<'all' | 'high' | 'low'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'topic' | 'videoCount' | 'score'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null)

  const longPressTimerRef = useRef<NodeJS.Timeout>()
  const isLongPressRef = useRef(false)

  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    const handleOpenLoginModal = () => setShowLoginModal(true)
    window.addEventListener('openLoginModal', handleOpenLoginModal)
    
    return () => {
      window.removeEventListener('openLoginModal', handleOpenLoginModal)
    }
  }, [])

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  if (!isMounted) return null

  const handleSort = (type: 'date' | 'name' | 'topic' | 'videoCount' | 'score') => {
    if (sortBy === type) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(type)
      setSortOrder('desc')
    }
  }

  const handleChannelClick = (channelId: string) => {
    if (!isLongPressRef.current) {
      setExpandedChannelId(expandedChannelId === channelId ? null : channelId)
    }
  }

  const handleChannelPressStart = () => {
    isLongPressRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true
      router.push('/p-ranking?tab=realtime_channel')
    }, 500)
  }

  const handleChannelPressEnd = (channelId: string) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
    }
    
    setTimeout(() => {
      if (!isLongPressRef.current) {
        handleChannelClick(channelId)
      }
      isLongPressRef.current = false
    }, 0)
  }

  const handleChannelPressCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
    }
    isLongPressRef.current = false
  }

  const filteredVideos = videos.filter((video) => {
    const matchesFilter = filterTrust === 'all' || video.trustLevel === filterTrust;
    const matchesSearch = !searchQuery || 
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      video.channel.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  })

  const filteredChannels = channels.filter((channel) => {
    const matchesFilter = filterTrust === 'all' || channel.trustLevel === filterTrust;
    const matchesSearch = !searchQuery || 
      channel.channelName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      channel.topic.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  })

  const sortedChannels = [...filteredChannels].sort((a, b) => {
    const multiplier = sortOrder === 'asc' ? 1 : -1

    switch (sortBy) {
      case 'date':
        return multiplier * a.date.localeCompare(b.date)
      case 'name':
        return multiplier * a.channelName.localeCompare(b.channelName)
      case 'topic':
        return multiplier * a.topic.localeCompare(b.topic)
      case 'videoCount':
        return multiplier * (a.videoCount - b.videoCount)
      case 'score':
        return multiplier * (a.rankScore - b.rankScore)
      default:
        return 0
    }
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
      <AppHeader onLoginClick={() => setShowLoginModal(true)} />

      <LoginModal
        open={showLoginModal}
        onOpenChange={setShowLoginModal}
        onLoginSuccess={(email) => {
          const nickname = email.split('@')[0]
          localStorage.setItem('userEmail', email)
          localStorage.setItem('userNickname', nickname)
          window.dispatchEvent(new CustomEvent('profileUpdated'))
          setShowLoginModal(false)
        }}
      />

      <main className="container mx-auto max-w-[var(--app-max-width)] px-4 py-3">
        {/* 원데이 핫이슈 섹션 (마이페이지와 동일하게 최상단 배치) */}
        <section className="mb-3">
          <div className="flex items-end justify-between mb-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              원데이 핫이슈 3
            </h2>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            {/* Tab Headers */}
            <div className="flex border-b border-slate-100">
              <button
                className="flex-1 py-2.5 text-center text-xs sm:text-sm font-bold text-slate-900 bg-slate-50/50 border-b-2 border-slate-500"
              >
                분석수
              </button>
              <button
                className="flex-1 py-2.5 text-center text-xs sm:text-sm font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              >
                신뢰도
              </button>
              <button
                className="flex-1 py-2.5 text-center text-xs sm:text-sm font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              >
                어그로
              </button>
            </div>

            {/* Content Area */}
            <div className="p-8 text-center">
              <p className="text-sm text-slate-400">최근 24시간 내 분석된 영상이 없습니다</p>
            </div>
          </div>
        </section>

        {/* Navigation Tabs (마이페이지와 동일한 캡슐형 UI) */}
        <div className="z-40 mb-2 flex flex-col lg:flex-row items-center justify-between gap-2 bg-transparent transition-all py-0.5">
          <div className="flex items-center gap-1.5 sm:gap-2 w-full lg:w-auto flex-1 max-w-[var(--app-max-width)] transition-all duration-300 ease-in-out">
            <button
              onClick={() => setActiveTab('videos')}
              className={`flex-1 rounded-full px-3 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-bold transition-all shadow-sm border whitespace-nowrap ${
                activeTab === 'videos'
                  ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white border-transparent shadow-md shadow-orange-200"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              } ${isSearchExpanded ? "px-3 sm:px-4" : ""}`}
            >
              {isSearchExpanded ? "영상" : <><span className="sm:hidden">영상</span><span className="hidden sm:inline">영상 트렌드</span></>}
            </button>

            {!isSearchExpanded ? (
              <button
                onClick={() => setIsSearchExpanded(true)}
                className="flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all group"
              >
                <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 group-hover:text-slate-600" />
              </button>
            ) : (
              <div className="flex flex-[2] items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 shadow-md animate-in fade-in zoom-in-95 duration-200 transition-all">
                <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.currentTarget.blur() 
                    }
                  }}
                  enterKeyHint="search"
                  placeholder="검색"
                  className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none"
                  autoFocus
                  onBlur={() => {
                    if (!searchQuery) setIsSearchExpanded(false)
                  }}
                />
                <button
                  onClick={() => {
                    setSearchQuery("")
                    setIsSearchExpanded(false)
                  }}
                  className="flex-shrink-0 rounded-full p-1 hover:bg-slate-100"
                >
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400" />
                </button>
              </div>
            )}

            <button
              onClick={() => setActiveTab('channels')}
              className={`flex-1 rounded-full px-3 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-bold transition-all shadow-sm border whitespace-nowrap ${
                activeTab === 'channels'
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-transparent shadow-md shadow-blue-200"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              } ${isSearchExpanded ? "px-3 sm:px-4" : ""}`}
            >
               {isSearchExpanded ? "채널" : <><span className="sm:hidden">채널</span><span className="hidden sm:inline">채널 트렌드</span></>}
            </button>
          </div>
        </div>

        {/* Filter Section */}
        <div className="mb-2 flex items-center gap-2">
          <Filter className="h-5 w-5 text-slate-600" />
          <span className="text-sm font-medium text-slate-600">필터:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterTrust('all')}
              className={`rounded-full px-4 py-1 text-sm font-medium transition-colors ${
                filterTrust === 'all'
                  ? 'bg-slate-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-300'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setFilterTrust('high')}
              className={`rounded-full px-4 py-1 text-sm font-medium transition-colors ${
                filterTrust === 'high'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-green-600 border border-green-300'
              }`}
            >
              신뢰도 높음
            </button>
            <button
              onClick={() => setFilterTrust('low')}
              className={`rounded-full px-4 py-1 text-sm font-medium transition-colors ${
                filterTrust === 'low'
                  ? 'bg-orange-600 text-white'
                  : 'bg-white text-orange-600 border border-orange-300'
              }`}
            >
              어그로성
            </button>
          </div>
        </div>

        {activeTab === 'videos' ? (
          /* Video List */
          <div className="space-y-2">
            {filteredVideos.map((video) => (
              <div
                key={video.id}
                className="relative rounded-2xl border-4 border-slate-600 bg-white p-4 shadow-md"
              >
                {/* Removed the Trust Badge div that was here */}

                <div className="flex gap-3">
                  {/* Date */}
                  <div className="flex flex-col items-center justify-start text-center w-12">
                    <div className="text-sm font-bold text-slate-700 leading-tight">
                      {video.date.split('.')[0]}
                    </div>
                    <div className="text-sm font-bold text-slate-700 leading-tight">
                      {video.date.split('.')[1]}.{video.date.split('.')[2]}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 border-l-2 border-slate-200 pl-3">
                    <Link href={`/p-result?from=p-real-time-best&tab=videos`} className="block">
                      <h3 className="text-sm font-semibold leading-tight text-blue-600 line-clamp-2 mb-2 hover:underline">
                        {video.title}
                      </h3>
                    </Link>
                    
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <span className="font-medium">Ch.</span>
                      <Link href="/p-ranking?tab=realtime_video" className="flex items-center gap-1.5 hover:opacity-80">
                        <Image
                          src={video.channelIcon || "/placeholder.svg"}
                          alt={video.channel}
                          width={16}
                          height={16}
                          className="rounded-full flex-shrink-0"
                        />
                        <span className="font-medium truncate">{video.channel}</span>
                      </Link>
                    </div>
                  </div>

                  {/* Score and Rank */}
                  <div className="flex flex-col items-end justify-between">
                    <div className="text-3xl font-bold text-slate-700 leading-none">
                      {video.score}
                    </div>
                    <div className="text-xs font-medium text-slate-500 mt-auto">
                      {video.rank}등 / {video.totalRank}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Channels View */
          <div className="rounded-3xl bg-white p-4 shadow-lg">
            {/* Table Header */}
            <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-3 text-sm font-medium text-slate-600">
              <button
                onClick={() => handleSort('date')}
                className="flex items-center gap-1 hover:text-slate-800"
              >
                날짜
                <ChevronDown
                  className={`h-4 w-4 transition-colors ${
                    sortBy === 'date'
                      ? 'text-slate-800 stroke-[3px]'
                      : 'text-slate-300'
                  }`}
                />
              </button>
              <button
                onClick={() => handleSort('name')}
                className="flex items-center gap-1 hover:text-slate-800 ml-9"
              >
                채널명
                <ChevronDown
                  className={`h-4 w-4 transition-colors ${
                    sortBy === 'name'
                      ? 'text-slate-800 stroke-[3px]'
                      : 'text-slate-300'
                  }`}
                />
              </button>
              <div className="ml-auto flex gap-4">
                <button
                  onClick={() => handleSort('topic')}
                  className="flex items-center gap-1 hover:text-slate-800 w-24 justify-start pl-8"
                >
                  카테고리
                  <ChevronDown className={`h-4 w-4 transition-colors ${sortBy === 'topic' ? 'text-slate-800 stroke-[3px]' : 'text-slate-300'}`} />
                </button>
                <button
                  onClick={() => handleSort('videoCount')}
                  className="flex items-center gap-1 hover:text-slate-800"
                >
                  영상수
                  <ChevronDown className={`h-4 w-4 transition-colors ${sortBy === 'videoCount' ? 'text-slate-800 stroke-[3px]' : 'text-slate-300'}`} />
                </button>
                <button
                  onClick={() => handleSort('score')}
                  className="flex items-center gap-1 hover:text-slate-800 mr-2"
                >
                  점수
                  <ChevronDown className={`h-4 w-4 transition-colors ${sortBy === 'score' ? 'text-slate-800 stroke-[3px]' : 'text-slate-300'}`} />
                </button>
              </div>
            </div>

            {/* Channel List */}
            <div className="space-y-2">
              {sortedChannels.map((channel) => (
                <div key={channel.id} className="relative">
                  <button
                    onMouseDown={handleChannelPressStart}
                    onMouseUp={() => handleChannelPressEnd(channel.id)}
                    onMouseLeave={handleChannelPressCancel}
                    onTouchStart={handleChannelPressStart}
                    onTouchEnd={() => handleChannelPressEnd(channel.id)}
                    onTouchCancel={handleChannelPressCancel}
                    className={`w-full rounded-xl p-3 text-white transition-all ${
                      channel.trustLevel === 'high'
                        ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'
                        : 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Date */}
                      <div className="flex flex-col text-center text-xs">
                        <div>{channel.date.split('.')[1]}.</div>
                        <div>{channel.date.split('.')[2]}</div>
                      </div>

                      {/* Channel Name */}
                      <div className="flex-1 text-left text-sm font-medium ml-2">
                        {channel.channelName}
                      </div>

                      {/* Topic */}
                      <div className="text-sm text-left w-24 truncate">{channel.topic}</div>

                      {/* Video Count */}
                      <div className="w-8 text-center text-sm">{channel.videoCount}</div>

                      {/* Rank Score */}
                      <div className="w-10 text-center text-sm font-semibold">
                        {channel.rankScore}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Video List */}
                  {expandedChannelId === channel.id && channelVideos[channel.id] && (
                    <div className="mt-1 space-y-1 rounded-xl bg-slate-50 p-2">
                      {channelVideos[channel.id].map((video) => (
                        <Link
                          key={video.id}
                          href={`/p-result?id=${video.id}&from=p-real-time-best&tab=channels`}
                          className="flex items-center gap-2 rounded-lg bg-white p-2 hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex items-center gap-1 text-xs text-slate-600">
                            <span>{video.date}</span>
                            <Image
                              src="/youtube-homepage.png"
                              alt="YouTube"
                              width={16}
                              height={16}
                              className="flex-shrink-0"
                            />
                          </div>
                          <div className="flex-1 text-sm text-slate-700 line-clamp-1">
                            {video.title}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-4 text-center text-sm font-medium text-slate-600">
              총 채널 수: {filteredChannels.length}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
