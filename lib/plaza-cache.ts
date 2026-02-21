const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1시간

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

export function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() })
}
