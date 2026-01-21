'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { AppHeader } from '@/components/c-app-header'
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react'
import Image from 'next/image'

interface TAnalysisVideo {
  id: string
  date: string
  title: string
  channel: string
  channelIcon: string
  score: number
  rank: number
  totalRank: number
}

interface TSubscribedChannel {
  id: string
  date: string
  channelName: string
  topic: string
  videoCount: number
  rankScore: number
}

const mockVideos: TAnalysisVideo[] = [
  {
    id: '1',
    date: '25.02.07',
    title: '곧 컴백한다는 지드래곤의 솔로곡',
    channel: '아이돌아카이브',
    channelIcon: '/winding-waterway.png',
    score: 100,
    rank: 1,
    totalRank: 5,
  },
  {
    id: '2',
    date: '25.02.06',
    title: '비트코인은 몇 송 모두에게 자비가 없다',
    channel: '비트코인 차트두우',
    channelIcon: '/bitcoin-concept.png',
    score: 85,
    rank: 2,
    totalRank: 5,
  },
  {
    id: '3',
    date: '25.01.25',
    title: '혹백요리사 에기잘 갈데 꺼더리면 안 된다',
    channel: '백종원 PAIK JONG WON',
    channelIcon: '/diverse-chef-preparing-food.png',
    score: 80,
    rank: 3,
    totalRank: 5,
  },
  {
    id: '4',
    date: '25.01.15',
    title: '"데이터출퇴션, 딥시크 쇼크 대응 산업별 AI기술 총합해 경쟁력 강화',
    channel: '서울경제TV',
    channelIcon: '/news-collage.png',
    score: 75,
    rank: 4,
    totalRank: 5,
  },
  {
    id: '5',
    date: '25.01.10',
    title: '도지코인 [긴급] 이번주 "트기적" 입박했습니다! 정확도 100%...',
    channel: 'FAKE호두',
    channelIcon: '/crypto-digital-landscape.png',
    score: 70,
    rank: 5,
    totalRank: 5,
  },
]

const mockChannels: TSubscribedChannel[] = [
  {
    id: '1',
    date: '25.02.18',
    channelName: '백종원 PAIK JONG WON',
    topic: '요리',
    videoCount: 3,
    rankScore: 85,
  },
  {
    id: '2',
    date: '25.02.18',
    channelName: 'Soothing Ghibli Piano',
    topic: '일본 애니',
    videoCount: 6,
    rankScore: 92,
  },
  {
    id: '3',
    date: '25.02.18',
    channelName: 'The Everyday Recipe',
    topic: '코리 블로그',
    videoCount: 5,
    rankScore: 78,
  },
  {
    id: '4',
    date: '25.02.15',
    channelName: '또마미마 Yummy Yammy',
    topic: '맛집 콘스트',
    videoCount: 7,
    rankScore: 88,
  },
  {
    id: '5',
    date: '25.02.14',
    channelName: 'FOOD★STAR フードスター',
    topic: '맛집 콘스트',
    videoCount: 3,
    rankScore: 81,
  },
  {
    id: '6',
    date: '25.02.13',
    channelName: '甘党スイーツ amaito sweets',
    topic: '디저트 제작',
    videoCount: 4,
    rankScore: 90,
  },
  {
    id: '7',
    date: '25.02.12',
    channelName: 'EBS 세계테마기행-메코마마? 괴만절!',
    topic: '먹여둘 일상',
    videoCount: 10,
    rankScore: 95,
  },
]

export default function AnalysisListClient() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as 'analysis' | 'subscribed' | null
  const [activeTab, setActiveTab] = useState<'analysis' | 'subscribed'>(tabParam || 'analysis')
  const [videos, setVideos] = useState(mockVideos)
  const [channels, setChannels] = useState(mockChannels)
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  const handleRemoveVideo = (id: string) => {
    setVideos(videos.filter((video) => video.id !== id))
  }

  const handleSort = (type: 'date' | 'name') => {
    if (sortBy === type) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(type)
      setSortOrder('desc')
    }
  }

  const sortedChannels = [...channels].sort((a, b) => {
    if (sortBy === 'date') {
      return sortOrder === 'desc' 
        ? b.date.localeCompare(a.date)
        : a.date.localeCompare(b.date)
    } else {
      return sortOrder === 'desc'
        ? b.channelName.localeCompare(a.channelName)
        : a.channelName.localeCompare(b.channelName)
    }
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
      <AppHeader />
      
      <main className="container mx-auto max-w-2xl px-4 py-6">
        {/* Tab Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => setActiveTab('analysis')}
            className={`flex-1 rounded-3xl text-xl font-bold transition-all ${
              activeTab === 'analysis'
                ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-pink-400 shadow-lg'
                : 'bg-gradient-to-r from-purple-200 to-blue-200 text-slate-600'
            } ${
              isSearchExpanded 
                ? 'px-3 py-3 opacity-50 md:px-6 md:py-3.5' 
                : 'px-4 py-3 md:px-6 md:py-3.5'
            }`}
          >
            <span className={isSearchExpanded ? 'md:hidden' : ''}>
              {isSearchExpanded ? '영상' : '분석 영상'}
            </span>
            <span className={isSearchExpanded ? 'hidden md:inline' : 'hidden'}>
              분석 영상
            </span>
          </button>
          
          {!isSearchExpanded ? (
            <button 
              onClick={() => setIsSearchExpanded(true)}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-md hover:shadow-lg transition-shadow"
            >
              <Search className="h-6 w-6 text-slate-600" />
            </button>
          ) : (
            <div className="flex max-w-xs flex-1 items-center gap-2 rounded-full border-2 border-blue-500 bg-white px-4 py-3 shadow-md">
              <Search className="h-5 w-5 text-slate-600 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="제목 / 채널명 검색..."
                className="flex-1 text-base text-slate-700 placeholder:text-slate-400 outline-none"
                autoFocus
                onBlur={() => {
                  if (!searchQuery) {
                    setIsSearchExpanded(false)
                  }
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setIsSearchExpanded(false)
                  }}
                  className="flex-shrink-0"
                >
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              )}
            </div>
          )}
          
          <button
            onClick={() => setActiveTab('subscribed')}
            className={`flex-1 rounded-3xl text-xl font-bold transition-all ${
              activeTab === 'subscribed'
                ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-pink-400 shadow-lg'
                : 'bg-gradient-to-r from-purple-200 to-blue-200 text-slate-600'
            } ${
              isSearchExpanded 
                ? 'px-3 py-3 opacity-50 md:px-6 md:py-3.5' 
                : 'px-4 py-3 md:px-6 md:py-3.5'
            }`}
          >
            <span className={isSearchExpanded ? 'md:hidden' : ''}>
              {isSearchExpanded ? '채널' : '구독 채널'}
            </span>
            <span className={isSearchExpanded ? 'hidden md:inline' : 'hidden'}>
              구독 채널
            </span>
          </button>
        </div>

        {activeTab === 'analysis' ? (
          /* Video List */
          <div className="space-y-4">
            {videos.map((video) => (
              <div
                key={video.id}
                className="relative rounded-2xl border-4 border-slate-600 bg-white p-4 shadow-md"
              >
                {/* Remove Button */}
                <button
                  onClick={() => handleRemoveVideo(video.id)}
                  className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 hover:bg-gray-400 transition-colors"
                >
                  <X className="h-4 w-4 text-gray-600" />
                </button>

                <div className="flex gap-4">
                  {/* Date */}
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="text-base font-semibold text-slate-700">
                      {video.date.split('.')[1]}.
                    </div>
                    <div className="text-base font-semibold text-slate-700">
                      {video.date.split('.')[2]}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    {/* Title */}
                    <h3 className="mb-2 text-base font-medium leading-tight text-blue-600">
                      {video.title}
                    </h3>
                    
                    {/* Channel Info */}
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="font-medium">Ch.</span>
                      <Image
                        src={video.channelIcon || "/placeholder.svg"}
                        alt={video.channel}
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                      <span>{video.channel}</span>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="text-3xl font-bold text-slate-700">
                      {video.score}
                    </div>
                  </div>
                </div>

                {/* Rank */}
                <div className="mt-3 text-right text-sm font-medium text-slate-600">
                  {video.rank}등 / {video.totalRank}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Subscribed Channels View */
          <div className="rounded-3xl bg-white p-4 shadow-lg">
            {/* Table Header */}
            <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-3 text-sm font-medium text-slate-600">
              <button
                onClick={() => handleSort('date')}
                className="flex items-center gap-1 hover:text-slate-800"
              >
                날짜 순
                {sortBy === 'date' && (
                  sortOrder === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => handleSort('name')}
                className="flex items-center gap-1 hover:text-slate-800"
              >
                채널명 순
                {sortBy === 'name' && (
                  sortOrder === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />
                )}
              </button>
              <div className="ml-auto flex gap-8">
                <span>카테고리</span>
                <span>영상 수</span>
                <span>순위도 점수</span>
              </div>
            </div>

            {/* Channel List */}
            <div className="space-y-2">
              {sortedChannels.map((channel) => (
                <div
                  key={channel.id}
                  className="rounded-xl bg-gradient-to-r from-slate-600 to-slate-700 p-3 text-white"
                >
                  <div className="flex items-center gap-3">
                    {/* Date */}
                    <div className="flex flex-col text-center text-xs">
                      <div>{channel.date.split('.')[1]}.</div>
                      <div>{channel.date.split('.')[2]}</div>
                    </div>

                    {/* Channel Name */}
                    <div className="flex-1 text-sm font-medium">
                      {channel.channelName}
                    </div>

                    {/* Topic */}
                    <div className="text-sm">{channel.topic}</div>

                    {/* Video Count */}
                    <div className="w-8 text-center text-sm">{channel.videoCount}</div>

                    {/* Rank Score */}
                    <div className="w-10 text-center text-sm font-semibold">{channel.rankScore}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-4 text-center text-sm font-medium text-slate-600">
              총 채널 수: {channels.length}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
