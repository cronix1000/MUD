<script setup lang="ts">
import type { ScriptKind } from '~/utils/entitySchemas'

const props = defineProps<{
  kind: ScriptKind
}>()

const emit = defineEmits<{ pick: [path: string]; close: [] }>()

interface ScriptItem {
  path: string
  size: number
  mtime: number
}

const scripts = ref<ScriptItem[]>([])
const scriptRoot = ref('')
const loading = ref(false)
const fileBody = ref<string | null>(null)
const previewing = ref<string | null>(null)
const previewError = ref<string | null>(null)

watch(() => props.kind, load, { immediate: true })

async function load() {
  loading.value = true
  previewing.value = null
  fileBody.value = null
  try {
    const res = await $fetch<{ type: string; root: string; scripts: ScriptItem[] }>(`/api/scripts/list`, {
      params: { type: props.kind },
    })
    scripts.value = res.scripts
    scriptRoot.value = res.root
  } finally {
    loading.value = false
  }
}

async function preview(path: string) {
  previewing.value = path
  previewError.value = null
  fileBody.value = null
  try {
    const res = await $fetch<{ path: string; body: string }>(`/api/scripts/${path}`)
    fileBody.value = res.body
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    previewError.value = err.data?.statusMessage ?? 'Failed to load'
  }
}

function vscodeUrl(path: string): string {
  const abs = scriptRoot.value ? `${scriptRoot.value.replace(/\\/g, '/')}/${path}` : path
  return `vscode://file/${encodeURI(abs).replace(/^\//, '')}`
}
</script>

<template>
  <div class="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" @click.self="$emit('close')">
    <div class="bg-neutral-900 border border-neutral-700 rounded p-4 w-full max-w-4xl max-h-[80vh] overflow-auto">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-semibold">Pick a script — {{ kind }}/</h3>
        <button class="text-sm text-neutral-400 hover:text-neutral-200" @click="$emit('close')">close</button>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <div v-if="loading" class="text-neutral-500">Loading…</div>
          <ul v-else class="space-y-1 text-sm font-mono">
            <li v-for="s in scripts" :key="s.path" class="flex items-center gap-2 hover:bg-neutral-800 px-2 py-1 rounded cursor-pointer" @click="preview(s.path)">
              <span class="flex-1">{{ s.path }}</span>
              <a :href="vscodeUrl(s.path)" target="_blank" class="text-sky-400 hover:underline text-xs">VSCode</a>
              <button class="text-emerald-400 hover:underline text-xs" @click.stop="$emit('pick', s.path)">use</button>
            </li>
            <li v-if="!scripts.length" class="text-neutral-500">No .lua files under {{ kind }}/</li>
          </ul>
        </div>
        <div>
          <div v-if="!previewing" class="text-neutral-500">Click a path to preview.</div>
          <div v-else>
            <div class="text-sm text-neutral-400 mb-1">{{ previewing }}</div>
            <pre v-if="fileBody" class="bg-neutral-950 p-2 rounded text-xs overflow-auto max-h-80"><code>{{ fileBody }}</code></pre>
            <div v-if="previewError" class="text-red-400 text-sm">{{ previewError }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
