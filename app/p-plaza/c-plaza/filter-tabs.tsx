"use client"

import { ArrowUpDown } from "lucide-react"

interface TFilterTabsProps {
  activeFilter: "views" | "trust" | "aggro"
  sortDirection: "best" | "worst"
  onFilterChange: (filter: "views" | "trust" | "aggro") => void
  onSortToggle: () => void
}

export function FilterTabs({ activeFilter, sortDirection, onFilterChange, onSortToggle }: TFilterTabsProps) {
  return (
    <div className="flex gap-2 mb-3 p-1 bg-slate-50 rounded-2xl">
      <button
        onClick={() => onFilterChange("views")}
        className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${
          activeFilter === "views"
            ? "bg-white text-slate-900 shadow-md ring-1 ring-black/5"
            : "text-slate-400 hover:text-slate-600"
        }`}
      >
        분석수
      </button>
      <button
        onClick={() => {
          if (activeFilter === "trust") {
            onSortToggle()
          } else {
            onFilterChange("trust")
          }
        }}
        className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-1 ${
          activeFilter === "trust"
            ? sortDirection === "worst"
              ? "bg-white text-red-600 shadow-md ring-1 ring-black/5"
              : "bg-white text-green-600 shadow-md ring-1 ring-black/5"
            : "text-slate-400 hover:text-slate-600"
        }`}
      >
        <span className="flex items-center gap-1">
          <span>
            {activeFilter === "trust" ? (sortDirection === "best" ? "신뢰도 TOP 3" : "신뢰도 WORST 3") : "신뢰도"}
          </span>
          {activeFilter === "trust" && <ArrowUpDown className="h-3 w-3 opacity-80" />}
        </span>
      </button>
      <button
        onClick={() => {
          if (activeFilter === "aggro") {
            onSortToggle()
          } else {
            onFilterChange("aggro")
          }
        }}
        className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-1 ${
          activeFilter === "aggro"
            ? sortDirection === "worst"
              ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-200"
              : "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-200"
            : "text-slate-400 hover:text-slate-600"
        }`}
      >
        <span className="flex items-center gap-1">
          <span>
            {activeFilter === "aggro" ? (
              <>
                어그로{" "}
                <span className={sortDirection === "worst" ? "text-xs tracking-tighter" : ""}>
                  {sortDirection === "best" ? "TOP 3" : "LOWEST 3"}
                </span>
              </>
            ) : (
              "어그로"
            )}
          </span>
          {activeFilter === "aggro" && <ArrowUpDown className="h-3 w-3 opacity-80" />}
        </span>
      </button>
    </div>
  )
}
