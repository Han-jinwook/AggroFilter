import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || 'https://aggrofilter.com').replace(/\/$/, '')
  const now = new Date()

  const routes = [
    '/',
    '/p-ranking',
    '/p-plaza',
    '/p-notification',
    '/p-my-page',
    '/p-settings',
    '/privacy',
  ]

  return routes.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: path === '/' ? 1 : 0.7,
  }))
}
