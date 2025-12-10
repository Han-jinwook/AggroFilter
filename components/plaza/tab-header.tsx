"use client"

import { Search, X } from "lucide-react"

interface TabHeaderProps {
  activeTab: "video" | "channel"
  isSearchExpanded: boolean
  searchQuery: string
  onTabChange: (tab: "video" | "channel") => void
  onSearchToggle: (expanded: boolean) => void
  onSearchChange: (query: string) => void
}

export function TabHeader({
  activeTab,
  isSearchExpanded,
  searchQuery,
  onTabChange,
  onSearchToggle,
  onSearchChange,
}: TabHeaderProps) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <button
        onClick={() => onTabChange("video")}
        className={`flex-1 rounded-full text-base font-bold transition-all border shadow-sm ${
          activeTab === "video"
            ? "bg-slate-900 text-white border-transparent shadow-md transform scale-[1.02]"
            : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
        } ${isSearchExpanded ? "px-3 py-3 opacity-50 md:px-6 md:py-3.5" : "px-4 py-3.5 md:px-6 md:py-4"}`}
      >
        <span className={isSearchExpanded ? "md:hidden" : ""}>{isSearchExpanded ? "영상" : "영상 트렌드"}</span>
        <span className={isSearchExpanded ? "hidden md:inline" : "hidden"}>영상 트렌드</span>
      </button>

      {!isSearchExpanded ? (
        <button
          onClick={() => onSearchToggle(true)}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all group"
        >
          <Search className="h-5 w-5 text-slate-400 group-hover:text-slate-600" />
        </button>
      ) : (
        <div className="flex max-w-xs flex-1 items-center gap-2 rounded-full border border-blue-500 bg-white px-4 py-3 shadow-md animate-in fade-in zoom-in-95 duration-200">
          <Search className="h-5 w-5 text-slate-600 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="검색..."
            className="flex-1 text-sm text-slate-700 placeholder:text-slate-400 outline-none min-w-0"
            autoFocus
            onBlur={() => {
              if (!searchQuery) {
                onSearchToggle(false)
              }
            }}
          />
          {searchQuery && (
            <button
              onClick={() => {
                onSearchChange("")
                onSearchToggle(false)
              }}
              className="flex-shrink-0"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          )}
        </div>
      )}

      <button
        onClick={() => onTabChange("channel")}
        className={`flex-1 rounded-full text-base font-bold transition-all border shadow-sm ${
          activeTab === "channel"
            ? "bg-slate-900 text-white border-transparent shadow-md transform scale-[1.02]"
            : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
        } ${isSearchExpanded ? "px-3 py-3 opacity-50 md:px-6 md:py-3.5" : "px-4 py-3.5 md:px-6 md:py-4"}`}
      >
        <span className={isSearchExpanded ? "md:hidden" : ""}>{isSearchExpanded ? "채널" : "채널 트렌드"}</span>
        <span className={isSearchExpanded ? "hidden md:inline" : "hidden"}>채널 트렌드</span>
      </button>
    </div>
  )
}
