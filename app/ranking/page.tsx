import { redirect } from 'next/navigation'

type TPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

export default function Page({ searchParams }: TPageProps) {
  const sp = new URLSearchParams()

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === 'string') sp.set(key, value)
      else if (Array.isArray(value)) value.forEach((v) => sp.append(key, v))
    }
  }

  const qs = sp.toString()
  redirect(qs ? `/p-ranking?${qs}` : '/p-ranking')
}
