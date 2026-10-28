<script lang="ts">
export interface EntityArrayColumn {
  key: string
  label?: string
  widget: 'text' | 'number' | 'select' | 'wiki' | 'color' | 'bgcolor'
  options?: Array<{ value: string; label: string }>
  step?: number
  min?: number
  placeholder?: string
}
</script>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: Record<string, unknown>[] | string[]
  columns?: EntityArrayColumn[]
  addLabel?: string
  emptyLabel?: string
}>(), {
  columns: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [Record<string, unknown>[] | string[]] }>()

const isStringMode = computed(() => !props.columns?.length)

const gridStyle = computed(() => {
  if (isStringMode.value) return { gridTemplateColumns: 'minmax(0, 1fr) 84px' }
  return { gridTemplateColumns: `${props.columns!.map(() => 'minmax(0, 1fr)').join(' ')} 84px` }
})

function defaultRow(): Record<string, unknown> | string {
  if (isStringMode.value) return ''
  const row: Record<string, unknown> = {}
  for (const c of props.columns!) {
    row[c.key] = c.widget === 'number' ? (c.min ?? 1) : ''
  }
  return row
}

function setCell(i: number, key: string, value: unknown) {
  emit('update:modelValue', (props.modelValue as Record<string, unknown>[]).map((r, idx) => (idx === i ? { ...r, [key]: value } : r)))
}

function setStringCell(i: number, value: string) {
  emit('update:modelValue', (props.modelValue as string[]).map((r, idx) => (idx === i ? value : r)))
}

function addRow() {
  emit('update:modelValue', [...props.modelValue, defaultRow()])
}

function removeRow(i: number) {
  emit('update:modelValue', props.modelValue.filter((_, idx) => idx !== i))
}

function move(i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= props.modelValue.length) return
  const next = [...props.modelValue]
  const tmp = next[i]
  next[i] = next[j]
  next[j] = tmp
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="columns?.length" class="grid gap-2 items-center" :style="gridStyle">
      <span v-for="c in columns" :key="c.key" class="text-xs text-neutral-500 font-mono">{{ c.label ?? c.key }}</span>
      <span />
    </div>

    <p v-if="!modelValue.length" class="text-xs text-neutral-500">{{ emptyLabel ?? 'No rows yet.' }}</p>

    <div v-for="(row, i) in modelValue" :key="i" class="grid gap-2 items-center" :style="gridStyle">
      <input
        v-if="isStringMode"
        :value="String(row)"
        class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
        @input="setStringCell(i, ($event.target as HTMLInputElement).value)"
      />
      <template v-else>
        <template v-for="c in columns" :key="c.key">
        <input
          v-if="c.widget === 'text'"
          :value="String(row[c.key] ?? '')"
          :placeholder="c.placeholder"
          class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
          @input="setCell(i, c.key, ($event.target as HTMLInputElement).value)"
        />
        <input
          v-else-if="c.widget === 'number'"
          :value="Number(row[c.key] ?? c.min ?? 0)"
          type="number"
          :step="c.step ?? 1"
          :min="c.min"
          class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm"
          @input="setCell(i, c.key, Number(($event.target as HTMLInputElement).value))"
        />
        <select
          v-else-if="c.widget === 'select'"
          :value="String(row[c.key] ?? '')"
          class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
          @change="setCell(i, c.key, ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="o in c.options ?? []" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <AdminAnsiColorSelect
          v-else-if="c.widget === 'color' || c.widget === 'bgcolor'"
          :model-value="String(row[c.key] ?? '')"
          :background="c.widget === 'bgcolor'"
          @update:model-value="(v: string) => setCell(i, c.key, v)"
        />
        <AdminWikiIdInput
          v-else
          :model-value="String(row[c.key] ?? '')"
          :placeholder="c.placeholder"
          @update:model-value="(v: string) => setCell(i, c.key, v)"
        />
        </template>
      </template>
      <div class="flex items-center justify-end gap-1">
        <button type="button" class="px-1.5 py-0.5 text-xs bg-neutral-800 hover:bg-neutral-700 rounded disabled:opacity-30" :disabled="i === 0" @click="move(i, -1)">↑</button>
        <button type="button" class="px-1.5 py-0.5 text-xs bg-neutral-800 hover:bg-neutral-700 rounded disabled:opacity-30" :disabled="i === modelValue.length - 1" @click="move(i, 1)">↓</button>
        <button type="button" class="px-1.5 py-0.5 text-xs bg-red-900/60 hover:bg-red-800 rounded" @click="removeRow(i)">✕</button>
      </div>
    </div>

    <button type="button" class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded" @click="addRow">
      {{ addLabel ?? '+ Add row' }}
    </button>
  </div>
</template>
