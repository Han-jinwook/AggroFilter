"use client"

import { usePathname } from "next/navigation"

export function BottomBanner() {
  const pathname = usePathname()

  // Exclude Home (/) and Settings (/settings)
  if (pathname === "/" || pathname === "/settings") {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex h-[60px] items-center justify-center border-t bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="text-sm font-medium text-slate-400">Bottom Fixed Banner Ad (320×50)</div>
    </div>
  )
}
