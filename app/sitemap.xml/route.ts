function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export async function GET(): Promise<Response> {
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || 'https://aggrofilter.com').replace(/\/$/, '')
  const now = new Date().toISOString()

  const routes = [
    '/',
    '/p-ranking',
    '/p-plaza',
    '/p-notification',
    '/p-my-page',
    '/p-settings',
    '/privacy',
  ]

  const urlEntries = routes
    .map((path) => {
      const loc = escapeXml(`${baseUrl}${path}`)
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${now}</lastmod>\n  </url>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
