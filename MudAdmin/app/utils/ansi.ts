export interface AnsiColor {
  code: string
  label: string
  css: string
  foreground: string
}

export const ANSI_COLORS: AnsiColor[] = [
  { code: '&x', label: 'Black', css: 'black', foreground: '#fff' },
  { code: '&r', label: 'Red', css: '#ef4444', foreground: '#fff' },
  { code: '&g', label: 'Green', css: '#22c55e', foreground: '#000' },
  { code: '&y', label: 'Yellow', css: '#eab308', foreground: '#000' },
  { code: '&b', label: 'Blue', css: '#3b82f6', foreground: '#fff' },
  { code: '&m', label: 'Magenta', css: '#a855f7', foreground: '#fff' },
  { code: '&c', label: 'Cyan', css: '#06b6d4', foreground: '#000' },
  { code: '&w', label: 'White', css: '#f5f5f5', foreground: '#000' },
  { code: '&R', label: 'Bright Red', css: '#fca5a5', foreground: '#000' },
  { code: '&G', label: 'Bright Green', css: '#86efac', foreground: '#000' },
  { code: '&Y', label: 'Bright Yellow', css: '#fde68a', foreground: '#000' },
  { code: '&B', label: 'Bright Blue', css: '#93c5fd', foreground: '#000' },
  { code: '&M', label: 'Bright Magenta', css: '#d8b4fe', foreground: '#000' },
  { code: '&C', label: 'Bright Cyan', css: '#67e8f9', foreground: '#000' },
  { code: '&W', label: 'Bright White', css: '#ffffff', foreground: '#000' },
  { code: '&D', label: 'Dark Gray', css: '#525252', foreground: '#fff' },
  { code: '&n', label: 'Brown', css: '#92400e', foreground: '#fff' },
  { code: '&o', label: 'Orange', css: '#f97316', foreground: '#000' },
  { code: '&p', label: 'Pink', css: '#ec4899', foreground: '#000' },
]

const ANSI_MAP = new Map(ANSI_COLORS.map((c) => [c.code, c]))

export function ansiToCss(code: string | null | undefined): string {
  if (!code) return '#a3a3a3'
  const c = ANSI_MAP.get(code)
  return c ? c.css : '#a3a3a3'
}

export function ansiToForeground(code: string | null | undefined): string {
  if (!code) return '#fff'
  const c = ANSI_MAP.get(code)
  return c ? c.foreground : '#fff'
}

export function findAnsiByCode(code: string | null | undefined): AnsiColor | null {
  if (!code) return null
  return ANSI_MAP.get(code) ?? null
}
