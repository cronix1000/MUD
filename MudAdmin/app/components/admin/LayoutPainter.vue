<script setup lang="ts">
import { ansiToCss, ansiToForeground } from '~/utils/ansi'
import AsciiGridPreview from './AsciiGridPreview.vue'
import type { Terrain, SpawnMarker } from './AsciiGridPreview.vue'

const props = defineProps<{
  layout: string[]
  terrain: Terrain[]
  width: number
  height: number
  spawns?: SpawnMarker[]
}>()

const emit = defineEmits<{
  'update:layout': [string[]]
}>()

const selectedChar = ref<string>('.')
const cursorX = ref(0)
const cursorY = ref(0)
const isPainting = ref(false)
const paintMode = ref<'paint' | 'erase'>('paint')
const eyedropper = ref(false)
const lastPainted = ref<string>('')

function pickTile(symbol: string) {
  if (selectedChar.value === symbol) {
    selectedChar.value = '.'
  } else {
    selectedChar.value = symbol
  }
  eyedropper.value = false
  paintMode.value = 'paint'
}

function clearSelection() {
  selectedChar.value = '.'
  eyedropper.value = false
}

function clampCursor() {
  if (cursorX.value >= props.width) cursorX.value = Math.max(0, props.width - 1)
  if (cursorY.value >= props.height) cursorY.value = Math.max(0, props.height - 1)
  if (cursorX.value < 0) cursorX.value = 0
  if (cursorY.value < 0) cursorY.value = 0
}

function ensureRows(rows: string[]): string[] {
  const out = rows.map((r) => r)
  while (out.length < props.height) out.push('.')
  return out
}

function setCell(rows: string[], x: number, y: number, ch: string): string[] {
  const out = ensureRows(rows)
  const row = out[y] ?? ''
  let next = row
  while (next.length < props.width) next += '.'
  if (x < next.length) next = next.slice(0, x) + ch + next.slice(x + 1)
  out[y] = next
  return out
}

function getCell(rows: string[], x: number, y: number): string {
  return (rows[y] ?? '')[x] ?? ' '
}

function paintAt(x: number, y: number) {
  const ch = paintMode.value === 'erase' ? ' ' : selectedChar.value
  const key = `${x},${y},${ch}`
  if (key === lastPainted.value) return
  lastPainted.value = key
  emit('update:layout', setCell(props.layout, x, y, ch))
}

function eyedropAt(x: number, y: number) {
  const ch = getCell(props.layout, x, y)
  selectedChar.value = ch === ' ' ? '.' : ch
  eyedropper.value = false
  paintMode.value = 'paint'
}

function onCellMouseDown(x: number, y: number, e: MouseEvent) {
  cursorX.value = x
  cursorY.value = y
  if (e.button === 2) {
    paintMode.value = 'erase'
    isPainting.value = true
    paintAt(x, y)
    return
  }
  if (eyedropper.value) {
    eyedropAt(x, y)
    return
  }
  isPainting.value = true
  paintMode.value = 'paint'
  paintAt(x, y)
}

function onCellMouseEnter(x: number, y: number) {
  cursorX.value = x
  cursorY.value = y
  if (isPainting.value) paintAt(x, y)
}

function onMouseUp() {
  isPainting.value = false
  lastPainted.value = ''
}

function onGlobalKeyDown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return

  if (e.key === 'Escape') {
    clearSelection()
    return
  }
  if (e.key === 'i' || e.key === 'I') {
    eyedropper.value = !eyedropper.value
    return
  }
  if (e.key === '[') {
    paintMode.value = 'paint'
    return
  }
  if (e.key === ']') {
    paintMode.value = 'erase'
    return
  }

  let dx = 0
  let dy = 0
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dx = -1
  else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dx = 1
  else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') dy = -1
  else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') dy = 1
  if (dx !== 0 || dy !== 0) {
    e.preventDefault()
    cursorX.value = Math.max(0, Math.min(props.width - 1, cursorX.value + dx))
    cursorY.value = Math.max(0, Math.min(props.height - 1, cursorY.value + dy))
    if (e.shiftKey) paintAt(cursorX.value, cursorY.value)
    return
  }

  const tile = props.terrain.find((t) => t.symbol.toLowerCase() === e.key.toLowerCase())
  if (tile) {
    pickTile(tile.symbol)
    return
  }
  if (e.key === '.') {
    pickTile('.')
    return
  }
  if (e.key === ' ' || e.key === 'Spacebar') {
    pickTile(' ')
    return
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeyDown)
  window.addEventListener('mouseup', onMouseUp)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeyDown)
  window.removeEventListener('mouseup', onMouseUp)
})

const cursorColLabel = computed(() => String.fromCharCode(65 + (cursorX.value % 26)))

const currentCell = computed(() => getCell(props.layout, cursorX.value, cursorY.value))
const currentTile = computed(() => {
  const ch = currentCell.value
  if (ch === ' ') return { name: 'void', symbol: ' ' }
  return props.terrain.find((t) => t.symbol === ch) ?? { name: 'unknown', symbol: ch }
})
</script>

<template>
  <div class="space-y-3" @contextmenu.prevent>
    <div class="flex flex-wrap items-center gap-2">
      <button
        class="w-8 h-8 inline-flex items-center justify-center font-mono rounded border-2 transition-all"
        :class="selectedChar === ' ' ? 'border-emerald-400 shadow-[0_0_0_2px_rgba(16,185,129,0.4)] -translate-y-0.5' : 'border-neutral-700 bg-neutral-950 hover:border-neutral-500'"
        :title="selectedChar === ' ' ? 'void (click again to deselect)' : 'paint with void'"
        @click="pickTile(' ')"
      >
        <span class="text-neutral-500">·</span>
      </button>
      <button
        v-for="t in terrain"
        :key="t.symbol"
        class="w-8 h-8 inline-flex items-center justify-center font-mono rounded border-2 transition-all"
        :class="selectedChar === t.symbol ? 'border-emerald-400 shadow-[0_0_0_2px_rgba(16,185,129,0.4)] -translate-y-0.5' : 'border-neutral-700 hover:border-neutral-500'"
        :title="`${t.name}${selectedChar === t.symbol ? ' (click again to deselect)' : ''}`"
        :style="{ background: '#1a1a1a', color: ansiToCss(t.color) }"
        @click="pickTile(t.symbol)"
      >
        {{ t.symbol === ' ' ? '·' : t.symbol }}
      </button>
      <span class="text-neutral-700 mx-1">|</span>
      <button
        class="text-xs px-2 py-1 rounded border transition-all"
        :class="eyedropper ? 'bg-amber-700 border-amber-500 text-white' : 'bg-neutral-950 border-neutral-700 hover:border-neutral-500'"
        title="Toggle eyedropper (I). Click a cell to pick that tile."
        @click="eyedropper = !eyedropper"
      >I eyedropper</button>
      <button
        class="text-xs px-2 py-1 rounded border transition-all"
        :class="paintMode === 'erase' ? 'bg-red-700 border-red-500 text-white' : 'bg-neutral-950 border-neutral-700 hover:border-neutral-500'"
        title="Erase mode (]). Right-click on grid also erases."
        @click="paintMode = paintMode === 'erase' ? 'paint' : 'erase'"
      >erase</button>
    </div>

    <div class="text-xs text-neutral-400 flex items-center gap-3 flex-wrap">
      <span>cursor: <span class="font-mono text-emerald-300">{{ cursorColLabel }}{{ cursorY + 1 }}</span> · <span class="font-mono">{{ currentTile.symbol === ' ' ? '·' : currentTile.symbol }}</span> {{ currentTile.name }}</span>
      <span class="text-neutral-600">·</span>
      <span><kbd class="px-1 bg-neutral-800 rounded">I</kbd> eyedrop · <kbd class="px-1 bg-neutral-800 rounded">[</kbd>/<kbd class="px-1 bg-neutral-800 rounded">]</kbd> paint/erase · <kbd class="px-1 bg-neutral-800 rounded">wasd</kbd>/<kbd class="px-1 bg-neutral-800 rounded">arrows</kbd> move · shift+key to paint while moving · click chip then click cell to paint</span>
    </div>

    <AsciiGridPreview
      v-if="layout.length"
      :layout="layout"
      :terrain="terrain"
      :spawns="spawns ?? []"
      :cell-size="28"
      interactive
      :cursor-x="cursorX"
      :cursor-y="cursorY"
      :cursor-active="true"
      @cell-click="(x, y, e) => onCellMouseDown(x, y, e as MouseEvent)"
      @cell-enter="(x, y) => onCellMouseEnter(x, y)"
    />
    <div v-else class="text-neutral-500 text-sm italic p-4 border border-dashed border-neutral-800 rounded">
      No layout yet. Set width and height in Identity tab.
    </div>

    <details class="bg-neutral-900 border border-neutral-800 rounded">
      <summary class="px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 cursor-pointer select-none">edit as text (advanced)</summary>
      <div class="p-3 border-t border-neutral-800">
        <textarea
          :value="layout.join('\n')"
          @input="emit('update:layout', ($event.target as HTMLTextAreaElement).value.split('\n').filter((l) => l.length > 0))"
          :rows="Math.max(height, 3)"
          class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-base"
          :style="{ letterSpacing: '0.5em' }"
          spellcheck="false"
        />
        <div class="mt-2 text-xs text-neutral-500">
          Type characters to draw the room. Spaces = void. Edits sync with the painter above.
        </div>
      </div>
    </details>
  </div>
</template>