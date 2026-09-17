<script setup lang="ts">
interface ScriptRef {
  on_enter?: string | null
  on_exit?: string | null
  on_pulse?: string | null
  script_ref?: string | null
}

interface ScriptItem {
  path: string
  size: number
  mtime: number
}

const props = defineProps<{
  modelValue: ScriptRef
  type: 'room' | 'mob'
}>()

const emit = defineEmits<{ 'update:modelValue': [ScriptRef] }>()

function update<K extends keyof ScriptRef>(key: K, value: string) {
  emit('update:modelValue', { ...props.modelValue, [key]: value || null })
}

const showBrowse = ref(false)
const browseType = ref<'room' | 'mob' | 'quest' | 'interactable'>('room')
const scripts = ref<ScriptItem[]>([])
const scriptRoot = ref('')
const loading = ref(false)
const fileBody = ref<string | null>(null)
const previewing = ref<string | null>(null)
const previewError = ref<string | null>(null)
const validateResults = ref<Array<{ path: string; ok: boolean; error?: string; missing?: boolean }> | null>(null)
const validating = ref(false)

async function openBrowse(type: 'room' | 'mob' | 'quest' | 'interactable') {
  browseType.value = type
  showBrowse.value = true
  loading.value = true
  try {
    const res = await $fetch<{ type: string; root: string; scripts: ScriptItem[] }>(`/api/scripts/list`, {
      params: { type },
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

function pick(path: string) {
  const target = props.type === 'room' ? 'on_enter' : 'script_ref'
  update(target as keyof ScriptRef, path)
  showBrowse.value = false
}

function vscodeUrl(path: string): string {
  const abs = scriptRoot.value ? `${scriptRoot.value.replace(/\\/g, '/')}/${path}` : path
  return `vscode://file/${encodeURI(abs).replace(/^\//, '')}`
}

const referenced = computed(() => {
  const refs: string[] = []
  if (props.modelValue.on_enter) refs.push(props.modelValue.on_enter)
  if (props.modelValue.on_exit) refs.push(props.modelValue.on_exit)
  if (props.modelValue.on_pulse) refs.push(props.modelValue.on_pulse)
  if (props.modelValue.script_ref) refs.push(props.modelValue.script_ref)
  return refs.filter(Boolean) as string[]
})

async function validateAll() {
  if (!referenced.value.length) return
  validating.value = true
  validateResults.value = null
  try {
    const res = await $fetch<{ results: typeof validateResults.value }>(`/api/scripts/validate`, {
      method: 'POST',
      body: { paths: referenced.value },
    })
    validateResults.value = res.results
  } finally {
    validating.value = false
  }
}

const absolutePaths = computed(() => {
  if (!scriptRoot.value) return []
  return referenced.value.map((p) => `${scriptRoot.value}\\${p}`)
})
</script>

<template>
  <div class="space-y-4">
    <div v-if="type === 'room'" class="grid grid-cols-3 gap-3">
      <div>
        <label class="block text-sm text-neutral-400 mb-1">on_enter</label>
        <div class="flex gap-1">
          <input
            :value="modelValue.on_enter ?? ''"
            @input="update('on_enter', ($event.target as HTMLInputElement).value)"
            class="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
            placeholder="room/room_one.lua"
          />
          <button class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded" @click="openBrowse('room')">…</button>
        </div>
      </div>
      <div>
        <label class="block text-sm text-neutral-400 mb-1">on_exit</label>
        <div class="flex gap-1">
          <input
            :value="modelValue.on_exit ?? ''"
            @input="update('on_exit', ($event.target as HTMLInputElement).value)"
            class="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
          />
          <button class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded" @click="openBrowse('room')">…</button>
        </div>
      </div>
      <div>
        <label class="block text-sm text-neutral-400 mb-1">on_pulse</label>
        <div class="flex gap-1">
          <input
            :value="modelValue.on_pulse ?? ''"
            @input="update('on_pulse', ($event.target as HTMLInputElement).value)"
            class="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
          />
          <button class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded" @click="openBrowse('room')">…</button>
        </div>
      </div>
    </div>
    <div v-else>
      <label class="block text-sm text-neutral-400 mb-1">script_ref</label>
      <div class="flex gap-1">
        <input
          :value="modelValue.script_ref ?? ''"
          @input="update('script_ref', ($event.target as HTMLInputElement).value)"
          class="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
          placeholder="mobs/goblin_grunt.lua"
        />
        <button class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded" @click="openBrowse('mob')">…</button>
      </div>
    </div>

    <div v-if="referenced.length" class="bg-neutral-900 border border-neutral-800 rounded p-3">
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-sm font-medium">Referenced scripts</h4>
        <button class="px-2 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 rounded disabled:opacity-50" :disabled="validating" @click="validateAll">
          {{ validating ? 'Checking…' : 'Validate syntax' }}
        </button>
      </div>
      <ul class="text-sm font-mono space-y-1">
        <li v-for="r in referenced" :key="r" class="flex items-center gap-2">
          <span class="text-neutral-300">{{ r }}</span>
          <a :href="vscodeUrl(r)" target="_blank" class="text-sky-400 hover:underline text-xs">open in VSCode</a>
        </li>
      </ul>
      <div v-if="validateResults" class="mt-3 space-y-1">
        <div v-for="v in validateResults" :key="v.path" class="text-sm font-mono">
          <span :class="v.ok ? 'text-emerald-400' : 'text-red-400'">[{{ v.ok ? 'OK' : 'ERR' }}]</span>
          {{ v.path }}
          <span v-if="v.error" class="text-neutral-400">— {{ v.error }}</span>
        </div>
      </div>
    </div>

    <div v-if="showBrowse" class="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" @click.self="showBrowse = false">
      <div class="bg-neutral-900 border border-neutral-700 rounded p-4 w-full max-w-4xl max-h-[80vh] overflow-auto">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-semibold">Pick a script — {{ browseType }}/</h3>
          <button class="text-sm text-neutral-400 hover:text-neutral-200" @click="showBrowse = false">close</button>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <div v-if="loading" class="text-neutral-500">Loading…</div>
            <ul v-else class="space-y-1 text-sm font-mono">
              <li v-for="s in scripts" :key="s.path" class="flex items-center gap-2 hover:bg-neutral-800 px-2 py-1 rounded cursor-pointer" @click="preview(s.path)">
                <span class="flex-1">{{ s.path }}</span>
                <a :href="vscodeUrl(s.path)" target="_blank" class="text-sky-400 hover:underline text-xs">VSCode</a>
                <button class="text-emerald-400 hover:underline text-xs" @click.stop="pick(s.path)">use</button>
              </li>
              <li v-if="!scripts.length" class="text-neutral-500">No .lua files in scripts/{{ browseType }}/</li>
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
  </div>
</template>
