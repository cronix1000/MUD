export interface AnsiColor {
  code: string
  label: string
  css: string
  foreground: string
}

export const ANSI_COLORS: AnsiColor[] = [
  { code: '&x', label: 'Black', css: '#a3a3a3', foreground: '#000000' },
  { code: '&r', label: 'Red', css: '#ef4444', foreground: '#ef4444' },
  { code: '&g', label: 'Green', css: '#22c55e', foreground: '#22c55e' },
  { code: '&y', label: 'Yellow', css: '#eab308', foreground: '#eab308' },
  { code: '&b', label: 'Blue', css: '#3b82f6', foreground: '#3b82f6' },
  { code: '&m', label: 'Magenta', css: '#a855f7', foreground: '#a855f7' },
  { code: '&c', label: 'Cyan', css: '#06b6d4', foreground: '#06b6d4' },
  { code: '&w', label: 'White (reset)', css: '#f5f5f5', foreground: '#f5f5f5' },
  { code: '&R', label: 'Bright Red', css: '#fca5a5', foreground: '#fca5a5' },
  { code: '&G', label: 'Bright Green', css: '#86efac', foreground: '#86efac' },
  { code: '&Y', label: 'Bright Yellow', css: '#fde68a', foreground: '#fde68a' },
  { code: '&B', label: 'Bright Blue', css: '#93c5fd', foreground: '#93c5fd' },
  { code: '&M', label: 'Bright Magenta', css: '#d8b4fe', foreground: '#d8b4fe' },
  { code: '&C', label: 'Bright Cyan', css: '#67e8f9', foreground: '#67e8f9' },
  { code: '&W', label: 'Bright White', css: '#ffffff', foreground: '#ffffff' },
  { code: '&D', label: 'Dark Gray', css: '#a3a3a3', foreground: '#525252' },
  { code: '&n', label: 'Brown', css: '#a3a3a3', foreground: '#92400e' },
  { code: '&o', label: 'Orange', css: '#a3a3a3', foreground: '#f97316' },
  { code: '&p', label: 'Pink', css: '#a3a3a3', foreground: '#ec4899' },
]

export interface AnsiBgColor {
  code: string
  label: string
  css: string
}

export const ANSI_BG_COLORS: AnsiBgColor[] = [
  { code: '', label: '— none —', css: 'transparent' },
  { code: '{x', label: 'Black bg', css: '#000000' },
  { code: '{r', label: 'Red bg', css: '#7f1d1d' },
  { code: '{g', label: 'Green bg', css: '#14532d' },
  { code: '{y', label: 'Yellow bg', css: '#713f12' },
  { code: '{b', label: 'Blue bg', css: '#1e3a8a' },
  { code: '{m', label: 'Magenta bg', css: '#581c87' },
  { code: '{c', label: 'Cyan bg', css: '#164e63' },
  { code: '{w', label: 'White bg', css: '#e5e5e5' },
  { code: '{X', label: 'Gray bg', css: '#4b5563' },
  { code: '{R', label: 'Bright Red bg', css: '#ef4444' },
  { code: '{G', label: 'Bright Green bg', css: '#22c55e' },
  { code: '{Y', label: 'Bright Yellow bg', css: '#eab308' },
  { code: '{B', label: 'Bright Blue bg', css: '#3b82f6' },
  { code: '{M', label: 'Bright Magenta bg', css: '#a855f7' },
  { code: '{C', label: 'Bright Cyan bg', css: '#06b6d4' },
  { code: '{W', label: 'Bright White bg', css: '#f5f5f5' },
]

const ANSI_MAP = new Map(ANSI_COLORS.map((c) => [c.code, c]))
const ANSI_BG_MAP = new Map(ANSI_BG_COLORS.map((c) => [c.code, c]))

export function ansiToCss(code: string | null | undefined): string {
  if (!code) return '#d4d4d4'
  const c = ANSI_MAP.get(code)
  return c ? c.css : '#d4d4d4'
}

export function ansiToForeground(code: string | null | undefined): string {
  if (!code) return '#d4d4d4'
  const c = ANSI_MAP.get(code)
  return c ? c.foreground : '#d4d4d4'
}

export function ansiBgToCss(code: string | null | undefined): string | null {
  if (!code) return null
  const c = ANSI_BG_MAP.get(code)
  return c && c.css !== 'transparent' ? c.css : null
}

export function findAnsiByCode(code: string | null | undefined): AnsiColor | null {
  if (!code) return null
  return ANSI_MAP.get(code) ?? null
}

export function tilePreviewStyle(fg: string | null | undefined, bg: string | null | undefined): { color: string; backgroundColor: string } {
  return {
    color: ansiToCss(fg),
    backgroundColor: ansiBgToCss(bg) ?? '#1a1a1a',
  }
}
