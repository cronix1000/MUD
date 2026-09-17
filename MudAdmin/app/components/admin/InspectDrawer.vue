<script setup lang="ts">
interface ColumnInfo { cid: number; name: string; type: string; notnull: 0 | 1; dflt_value: unknown; pk: 0 | 1 }

const props = defineProps<{
  row: Record<string, unknown>
  columns: ColumnInfo[]
  table: string
  rowKey: string
  editHref: string
}>()

const emit = defineEmits<{
  close: []
  delete: [row: Record<string, unknown>]
}>()

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return JSON.stringify(v, null, 2)
  return String(v)
}

function isJsonColumn(name: string): boolean {
  return name.endsWith('_json')
}

function tryParse(v: unknown): unknown {
  if (typeof v !== 'string') return null
  try { return JSON.parse(v) } catch { return null }
}

function copyValue(name: string, value: unknown) {
  const s = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
  navigator.clipboard?.writeText(s).catch(() => {})
}

function copyKey() {
  navigator.clipboard?.writeText(props.rowKey).catch(() => {})
}

const isPrimary = (col: ColumnInfo): boolean => col.pk === 1
</script>

<template>
  <div class="fixed inset-0 z-40 flex justify-end bg-black/40" @click.self="emit('close')">
    <div class="w-[480px] max-w-full h-full bg-neutral-950 border-l border-neutral-800 flex flex-col">
      <div class="flex items-center justify-between p-4 border-b border-neutral-800">
        <div class="flex-1 min-w-0">
          <div class="text-xs uppercase tracking-wide text-neutral-500">{{ table }}</div>
          <div class="font-mono text-sm truncate">{{ rowKey || '—' }}</div>
        </div>
        <button class="text-neutral-400 hover:text-neutral-200 px-2" @click="emit('close')">✕</button>
      </div>
      <div class="flex gap-2 px-4 py-2 border-b border-neutral-800">
        <NuxtLink
          :to="editHref"
          class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm"
        >Edit full →</NuxtLink>
        <button class="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-sm" @click="copyKey">Copy key</button>
        <button class="px-3 py-1.5 rounded bg-red-700 hover:bg-red-600 text-sm ml-auto" @click="emit('delete', row)">Delete</button>
      </div>
      <div class="flex-1 overflow-auto p-4 space-y-3">
        <div v-for="c in columns" :key="c.name" class="bg-neutral-900 border border-neutral-800 rounded p-3">
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono text-neutral-400">{{ c.name }}</span>
              <span class="text-xs text-neutral-600">({{ c.type }})</span>
              <span v-if="isPrimary(c)" class="text-xs px-1.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-700/50">PK</span>
            </div>
            <button class="text-xs text-neutral-500 hover:text-neutral-300" @click="copyValue(c.name, row[c.name])">copy</button>
          </div>
          <div v-if="isJsonColumn(c.name) && row[c.name]" class="space-y-1">
            <details>
              <summary class="text-xs text-neutral-500 cursor-pointer">raw</summary>
              <pre class="text-xs text-neutral-300 bg-neutral-950 p-2 rounded mt-1 overflow-auto max-h-40"><code>{{ formatValue(row[c.name]) }}</code></pre>
            </details>
            <div v-if="tryParse(row[c.name])" class="text-xs font-mono text-neutral-200 bg-neutral-950 p-2 rounded">
              <div v-for="(v, k) in (tryParse(row[c.name]) as Record<string, unknown>)" :key="k" class="flex gap-2">
                <span class="text-neutral-500 w-32 truncate">{{ k }}</span>
                <span class="text-neutral-300">{{ String(typeof v === 'object' ? JSON.stringify(v) : v) }}</span>
              </div>
            </div>
          </div>
          <div v-else-if="typeof row[c.name] === 'object' && row[c.name]">
            <pre class="text-xs text-neutral-300 bg-neutral-950 p-2 rounded overflow-auto"><code>{{ formatValue(row[c.name]) }}</code></pre>
          </div>
          <div v-else class="text-sm font-mono text-neutral-100 break-all">
            {{ formatValue(row[c.name]) || '—' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
