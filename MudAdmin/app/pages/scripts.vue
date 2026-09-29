<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface ScriptListResponse {
  type: string
  root: string
  scripts: Array<{ path: string; size: number; mtime: number }>
}

const type = ref<'room' | 'mob' | 'quest' | 'interactable' | 'system' | 'skills'>('room')

const { data, refresh } = await useFetch<ScriptListResponse>('/api/scripts/list', {
  query: { type },
})

watch(type, () => refresh())

const fileBody = ref<string | null>(null)
const previewing = ref<string | null>(null)
const previewError = ref<string | null>(null)
const validateResults = ref<Array<{ path: string; ok: boolean; error?: string; missing?: boolean }> | null>(null)

function vscodeUrl(path: string): string {
  if (!data.value?.root) return '#'
  const abs = `${data.value.root.replace(/\\/g, '/')}/${path}`
  return `vscode://file/${encodeURI(abs).replace(/^\//, '')}`
}

async function preview(path: string) {
  previewing.value = path
  previewError.value = null
  fileBody.value = null
  try {
    const res = await $fetch<{ body: string }>(`/api/scripts/${path}`)
    fileBody.value = res.body
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    previewError.value = err.data?.statusMessage ?? 'Failed to load'
  }
}

async function validateAll() {
  const paths = (data.value?.scripts ?? []).map((s) => s.path)
  if (!paths.length) return
  const res = await $fetch<{ results: typeof validateResults.value }>('/api/scripts/validate', {
    method: 'POST',
    body: { paths },
  })
  validateResults.value = res.results
}

function fmtTs(ms: number) {
  return new Date(ms).toLocaleString()
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-semibold font-mono">Scripts</h2>
        <p class="text-neutral-400 text-sm mt-1">
          Browse Lua scripts. Click a path to preview. <strong>Edit in VSCode</strong> — this page is read-only.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <select v-model="type" class="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono">
          <option value="room">room</option>
          <option value="mob">mob</option>
          <option value="quest">quest</option>
          <option value="interactable">interactable</option>
          <option value="system">system</option>
          <option value="skills">skills</option>
        </select>
        <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm" @click="validateAll">Validate all</button>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="bg-neutral-900 border border-neutral-800 rounded">
        <ul class="divide-y divide-neutral-800">
          <li v-for="s in data?.scripts ?? []" :key="s.path" class="px-3 py-2 hover:bg-neutral-800/60 cursor-pointer flex items-center gap-2" @click="preview(s.path)">
            <span class="flex-1 font-mono text-sm">{{ s.path }}</span>
            <span class="text-xs text-neutral-500">{{ fmtTs(s.mtime) }}</span>
            <a :href="vscodeUrl(s.path)" target="_blank" class="text-sky-400 hover:underline text-xs">VSCode</a>
          </li>
          <li v-if="!(data?.scripts ?? []).length" class="px-3 py-6 text-center text-neutral-500">No .lua files in scripts/{{ type }}/</li>
        </ul>
      </div>
      <div class="bg-neutral-900 border border-neutral-800 rounded p-3">
        <div v-if="!previewing" class="text-neutral-500 text-sm">Click a path to preview.</div>
        <div v-else>
          <div class="text-sm text-neutral-400 mb-2 font-mono">{{ previewing }}</div>
          <pre v-if="fileBody" class="bg-neutral-950 p-2 rounded text-xs overflow-auto max-h-[60vh]"><code>{{ fileBody }}</code></pre>
          <div v-if="previewError" class="text-red-400 text-sm">{{ previewError }}</div>
        </div>
      </div>
    </div>

    <div v-if="validateResults" class="bg-neutral-900 border border-neutral-800 rounded p-3">
      <h3 class="text-sm font-semibold mb-2">Validation results</h3>
      <ul class="text-sm font-mono space-y-1">
        <li v-for="v in validateResults" :key="v.path">
          <span :class="v.ok ? 'text-emerald-400' : 'text-red-400'">[{{ v.ok ? 'OK' : 'ERR' }}]</span>
          {{ v.path }}
          <span v-if="v.error" class="text-neutral-400">— {{ v.error }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
