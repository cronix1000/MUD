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

const selectedChar = ref<string | null>(null)

function pickTile(symbol: string) {
  if (selectedChar.value === symbol) {
    selectedChar.value = null
  } else {
    selectedChar.value = symbol
  }
}

function clearSelection() {
  selectedChar.value = null
}

function paintCell(x: number, y: number) {
  if (selectedChar.value === null) return
  const ch = selectedChar.value
  const rows = props.layout.map((r) => r)
  while (rows.length <= y) rows.push('')
  const row = rows[y] ?? ''
  let next = row
  while (next.length <= x) next += ' '
  if (next[x] === ch) return
  next = next.slice(0, x) + ch + next.slice(x + 1)
  rows[y] = next
  emit('update:layout', rows)
}

function onCellClick(x: number, y: number, e: MouseEvent) {
  if (e.shiftKey || e.metaKey || e.ctrlKey) {
    clearSelection()
    return
  }
  paintCell(x, y)
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    clearSelection()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-2">
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
        :style="{ background: ansiToCss(t.color), color: ansiToForeground(t.color) }"
        @click="pickTile(t.symbol)"
      >
        {{ t.symbol === ' ' ? '·' : t.symbol }}
      </button>
    </div>

    <AsciiGridPreview
      v-if="layout.length"
      :layout="layout"
      :terrain="terrain"
      :spawns="spawns ?? []"
      :cell-size="28"
      interactive
      @cell-click="onCellClick"
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
          class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
          :style="{ letterSpacing: '0.4em' }"
          spellcheck="false"
        />
        <div class="mt-2 text-xs text-neutral-500">
          Type characters to draw the room. Spaces = void. Edits sync with the painter above.
        </div>
      </div>
    </details>
  </div>
</template>
