/**
 * 简单的工具：生成 nanoid 风格 id（不引入外部包）
 */
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function uid(prefix = ''): string {
  let s = ''
  for (let i = 0; i < 12; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return prefix ? `${prefix}_${s}` : s
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function safeDate(input: string | number | Date | undefined | null): Date | null {
  if (!input) return null
  const d = new Date(input)
  return isNaN(d.getTime()) ? null : d
}

export function formatDate(input: string | number | Date | undefined | null, withTime = false): string {
  const d = safeDate(input)
  if (!d) return '—'
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (!withTime) return date
  return `${date} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function diffDays(a: Date, b: Date): number {
  const ax = startOfDay(a).getTime()
  const bx = startOfDay(b).getTime()
  return Math.round((bx - ax) / 86400000)
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi)
}

export function downloadBlob(filename: string, content: string | Blob, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as unknown as Pick<T, K>
  for (const k of keys) {
    if (k in obj) (out as any)[k] = obj[k]
  }
  return out
}

export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr]
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

export function uniqBy<T, K>(arr: T[], fn: (x: T) => K): T[] {
  const seen = new Set<K>()
  const out: T[] = []
  for (const x of arr) {
    const k = fn(x)
    if (!seen.has(k)) {
      seen.add(k)
      out.push(x)
    }
  }
  return out
}

export function groupBy<T, K extends string | number>(arr: T[], fn: (x: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>
  for (const x of arr) {
    const k = fn(x)
    ;(out[k] ||= []).push(x)
  }
  return out
}

export function sortBy<T>(arr: T[], fn: (x: T) => string | number, direction: 'asc' | 'desc' = 'asc'): T[] {
  const sign = direction === 'asc' ? 1 : -1
  return arr.slice().sort((a, b) => {
    const av = fn(a)
    const bv = fn(b)
    if (av < bv) return -1 * sign
    if (av > bv) return 1 * sign
    return 0
  })
}
