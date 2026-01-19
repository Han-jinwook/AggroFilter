"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { TChannelItem } from "@/types/T-ranking";
import { ChevronUp, TrendingUp } from "lucide-react";

interface TRankingListProps {
  f_initial_items: TChannelItem[];
  f_my_rank?: TChannelItem;
  f_category_id: number;
}

export const RankingList = ({
  f_initial_items,
  f_my_rank,
  f_category_id,
}: TRankingListProps) => {
  const [f_items, setFItems] = useState<TChannelItem[]>(f_initial_items);
  const [f_is_loading, setFIsLoading] = useState(false);
  const [f_show_sticky, setFShowSticky] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const myRankRef = useRef<HTMLDivElement>(null);

  // Sticky My-Rank 노출 로직
  useEffect(() => {
    const handleScroll = () => {
      if (!myRankRef.current || !f_my_rank) return;
      
      const rect = myRankRef.current.getBoundingClientRect();
      // 내 순위가 화면 밖에 있거나(뷰포트 아래), 아직 리스트에 포함되지 않았을 때
      const is_off_screen = rect.top > window.innerHeight || rect.bottom < 0;
      setFShowSticky(is_off_screen);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [f_my_rank, f_items]);

  const scrollToMyRank = () => {
    myRankRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto" ref={listRef}>
      {/* Ranking Header Information */}
      <div className="mb-6 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-indigo-600 h-5 w-5" />
          <h2 className="text-lg font-bold text-slate-900">카테고리 랭킹</h2>
        </div>
        {f_my_rank && (
          <div className="text-sm font-medium text-slate-500">
            상위 <span className="text-indigo-600 font-bold">{f_my_rank.f_top_percentile}%</span> 
            <span className="mx-1">({f_my_rank.f_rank}위 / {f_my_rank.f_total_count}개)</span>
          </div>
        )}
      </div>

      {/* Ranking List Items */}
      <div className="space-y-3 pb-24">
        {f_items.map((item) => (
          <div
            key={item.f_channel_id}
            ref={item.f_channel_id === f_my_rank?.f_channel_id ? myRankRef : null}
            className={`flex items-center gap-4 p-4 rounded-3xl transition-all border ${
              item.f_channel_id === f_my_rank?.f_channel_id
                ? "bg-indigo-50 border-indigo-200 shadow-md ring-2 ring-indigo-100"
                : "bg-white border-slate-100 hover:border-slate-200"
            }`}
          >
            <div className="w-10 text-center font-black text-slate-400 italic">
              {item.f_rank}
            </div>
            <div className="relative h-12 w-12 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
              <Image
                src={item.f_thumbnail_url || "/placeholder-avatar.svg"}
                alt={item.f_title}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-900 truncate">
                {item.f_title}
                {item.f_channel_id === f_my_rank?.f_channel_id && (
                  <span className="ml-2 text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">My</span>
                )}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                상위 {item.f_top_percentile}%
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs font-bold text-slate-400 leading-none mb-1">신뢰도</p>
                <p className={`text-xl font-black leading-none ${
                  item.f_trust_grade === 'green' ? 'text-emerald-500' : 
                  item.f_trust_grade === 'yellow' ? 'text-amber-500' : 'text-rose-500'
                }`}>
                  {item.f_trust_score}
                </p>
              </div>
              <div className={`h-3 w-3 rounded-full ${
                item.f_trust_grade === 'green' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                item.f_trust_grade === 'yellow' ? 'bg-amber-500' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
              }`} />
            </div>
          </div>
        ))}
      </div>

      {/* Sticky My-Rank Bar */}
      {f_show_sticky && f_my_rank && (
        <div 
          onClick={scrollToMyRank}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl z-50 animate-in slide-in-from-bottom-4 duration-300"
        >
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between cursor-pointer group hover:bg-slate-800 transition-colors">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 px-3 py-1 rounded-full text-xs font-bold">MY</div>
              <div>
                <span className="font-bold">{f_my_rank.f_rank}위</span>
                <span className="mx-2 text-slate-400">|</span>
                <span className="text-slate-300">상위 {f_my_rank.f_top_percentile}%</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-indigo-400 group-hover:text-indigo-300 transition-colors">
              <span className="text-xs font-bold uppercase tracking-widest">Jump to Me</span>
              <ChevronUp className="h-4 w-4 animate-bounce" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
