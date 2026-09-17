<script setup lang="ts">
import { ansiToCss, ansiToForeground } from '~/utils/ansi'

export interface Terrain {
  symbol: string
  name: string
  color: string | null
  blocks_move?: number | null
  blocks_sight?: number | null
  move_cost?: number | null
}

export interface SpawnMarker {
  x: number
  y: number
  type: string
  template_id?: string | null
}

interface PaletteEntry {
  symbol: string
  css: string
  foreground: string
  name: string
  blocks_move: boolean
  blocks_sight: boolean
  move_cost: number
}

interface SpawnEntry {
  type: string
  template_id: string
}

const props = withDefaults(defineProps<{
  layout: string[]
  terrain: Terrain[]
  spawns?: SpawnMarker[]
  cellSize?: number
  showCoords?: boolean
  interactive?: boolean
}>(), {
  spawns: () => [],
  cellSize: 28,
  showCoords: true,
  interactive: false,
})

const emit = defineEmits<{
  'cell-click': [x: number, y: number, event: MouseEvent]
}>()

const palette = computed<Map<string, PaletteEntry>>(() => {
  const m = new Map<string, PaletteEntry>()
  for (const t of props.terrain) {
    m.set(t.symbol, {
      symbol: t.symbol,
      css: ansiToCss(t.color),
      foreground: ansiToForeground(t.color),
      name: t.name,
      blocks_move: !!t.blocks_move,
      blocks_sight: !!t.blocks_sight,
      move_cost: Number(t.move_cost ?? 1),
    })
  }
  return m
})

const spawnAt = computed<Map<string, SpawnEntry>>(() => {
  const m = new Map<string, SpawnEntry>()
  for (const s of props.spawns) {
    m.set(`${s.x},${s.y}`, { type: s.type, template_id: s.template_id ?? '' })
  }
  return m
})

function spawnColor(type: string): string {
  switch (type) {
    case 'mob': return '#ef4444'
    case 'npc': return '#06b6d4'
    case 'item': return '#eab308'
    case 'interactable': return '#a855f7'
    default: return '#a3a3a3'
  }
}

function cellStyle(ch: string): Record<string, string> {
  const p = palette.value.get(ch)
  if (!p) return { background: '#1f1f1f', color: '#a3a3a3', 'box-shadow': 'inset 0 0 0 1px #ef4444' }
  return { background: p.css, color: p.foreground }
}

function titleFor(ch: string): string {
  const p = palette.value.get(ch)
  if (p) {
    const flags: string[] = []
    if (p.blocks_move) flags.push('blocks movement')
    if (p.blocks_sight) flags.push('blocks sight')
    const extra = flags.length ? ` · ${flags.join(', ')}` : ` · move cost ${p.move_cost}`
    return `${p.symbol} — ${p.name}${extra}`
  }
  if (ch === ' ') return '(space) — void'
  return `${ch} — (unknown symbol — add to Palette)`
}

function ariaFor(ch: string): string {
  const p = palette.value.get(ch)
  return p ? `${p.name}` : ch === ' ' ? 'void' : 'unknown'
}

function colLabel(x: number): string {
  return String.fromCharCode(65 + (x % 26))
}

const maxCols = computed(() => props.layout.reduce((m, r) => Math.max(m, r.length), 0))
</script>

<template>
  <div class="inline-block font-mono text-sm leading-none bg-neutral-950 p-2 rounded border border-neutral-800">
    <div v-if="showCoords" class="flex items-center mb-1">
      <div class="w-6 h-6 mr-1"></div>
      <div v-for="x in maxCols" :key="`col-${x}`" class="flex items-center justify-center" :style="{ width: cellSize + 'px', height: '24px' }">
        <span class="text-neutral-500 text-xs">{{ colLabel(x - 1) }}</span>
      </div>
    </div>
    <div v-for="(row, y) in layout" :key="y" class="flex items-center">
      <div v-if="showCoords" class="w-6 h-6 flex items-center justify-center text-neutral-500 text-xs mr-1">{{ y + 1 }}</div>
      <template v-for="(ch, x) in row.split('')" :key="`${y}-${x}`">
        <div
          class="relative flex items-center justify-center"
          :class="interactive ? 'cursor-pointer hover:ring-2 hover:ring-emerald-400' : ''"
          :style="{ width: cellSize + 'px', height: cellSize + 'px', ...cellStyle(ch) }"
          :title="titleFor(ch)"
          :aria-label="`${y},${x} ${ariaFor(ch)}`"
          @click="(e) => interactive && emit('cell-click', x, y, e)"
        >
          <span class="relative z-0">{{ ch === ' ' ? '·' : ch }}</span>
          <div
            v-if="spawnAt.get(`${x},${y}`)"
            class="absolute top-0 right-0 w-2.5 h-2.5 rounded-full border border-black/60 pointer-events-none"
            :style="{ background: spawnColor(spawnAt.get(`${x},${y}`)!.type) }"
            :title="`${spawnAt.get(`${x},${y}`)!.type} · ${spawnAt.get(`${x},${y}`)!.template_id} · (${x},${y})`"
          />
        </div>
      </template>
    </div>
  </div>
</template>
