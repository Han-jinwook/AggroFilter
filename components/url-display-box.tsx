interface UrlDisplayBoxProps {
  url: string
  className?: string
}

export function UrlDisplayBox({ url, className = "" }: UrlDisplayBoxProps) {
  return (
    <div className={`rounded-3xl border-4 border-black bg-background px-6 py-4 text-center ${className}`}>
      <p className="text-sm text-foreground break-all">{url}</p>
    </div>
  )
}
