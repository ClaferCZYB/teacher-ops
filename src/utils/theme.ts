/**
 * 六套主题：墨绿（默认/沉静）、靛蓝（冷静）、暖咖（温暖）
 *         活力橙（明亮活泼）、清新薄荷（清爽）、梦樱紫（温柔梦幻）
 * - 通过 <html data-theme="xxx"> 控制
 * - CSS 变量由 index.css 提供
 * - 选择持久化到 localStorage（与 Zustand 无关，避免与业务数据混杂）
 */
export type ThemeId = 'ink' | 'indigo' | 'coffee' | 'orange' | 'mint' | 'violet'

export interface ThemePreset {
  id: ThemeId
  label: string
  blurb: string
  swatch: string
}

export const THEMES: ThemePreset[] = [
  { id: 'ink',     label: '墨绿',     blurb: '沉静专业 · 默认', swatch: '#33463a' },
  { id: 'indigo',  label: '靛蓝',     blurb: '冷静理性',         swatch: '#1e3a5f' },
  { id: 'coffee',  label: '暖咖',     blurb: '温暖人文',         swatch: '#5a3a22' },
  { id: 'orange',  label: '活力橙',   blurb: '明亮活泼',         swatch: '#cf4e10' },
  { id: 'mint',    label: '清新薄荷', blurb: '清爽松弛',         swatch: '#0a6044' },
  { id: 'violet',  label: '梦樱紫',   blurb: '温柔梦幻',         swatch: '#582a91' },
]

export const DEFAULT_THEME: ThemeId = 'ink'
const KEY = 'teacher-ops:theme'

export function getTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME
  const v = window.localStorage.getItem(KEY) as ThemeId | null
  return v && THEMES.some((t) => t.id === v) ? v : DEFAULT_THEME
}

export function applyTheme(id: ThemeId): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', id)
  window.localStorage.setItem(KEY, id)
}

export function cycleTheme(): ThemeId {
  const cur = getTheme()
  const idx = THEMES.findIndex((t) => t.id === cur)
  const next = THEMES[(idx + 1) % THEMES.length]
  applyTheme(next.id)
  return next.id
}