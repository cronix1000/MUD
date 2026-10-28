<script setup lang="ts">
interface ScriptRef {
  on_enter?: string | null
  on_exit?: string | null
  on_pulse?: string | null
  script_ref?: string | null
}

type BrowseField = 'on_enter' | 'on_exit' | 'on_pulse' | 'script_ref'

const props = defineProps<{
  modelValue: ScriptRef
  type: 'room' | 'mob'
}>()

const emit = defineEmits<{ 'update:modelValue': [ScriptRef] }>()

function update<K extends keyof ScriptRef>(key: K, value: string) {
  const next = { ...props.modelValue }
  if (value) next[key] = value
  else delete next[key]
  emit('update:modelValue', next)
}

const showBrowse = ref(false)
const browseField = ref<BrowseField>('script_ref')
const validateResults = ref<Array<{ path: string; ok: boolean; error?: string; missing?: boolean }> | null>(null)
const validating = ref(false)

function openBrowse(field: BrowseField) {
  browseField.value = field
  showBrowse.value = true
}

function pick(path: string) {
  update(browseField.value, path)
  showBrowse.value = false
}

function vscodeUrl(path: string): string {
  const abs = scriptRoot.value ? `${scriptRoot.value.replace(/\\/g, '/')}/${path}` : path
  return `vscode://file/${encodeURI(abs).replace(/^\//, '')}`
}

const scriptRoot = ref('')
onMounted(async () => {
  try {
    const res = await $fetch<{ root: string }>('/api/scripts/root')
    scriptRoot.value = res.root
  } catch {
    scriptRoot.value = ''
  }
})

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
          <button class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded" @click="openBrowse('on_enter')">…</button>
        </div>
      </div>
      <div>
        <label class="block text-sm text-neutral-400 mb-1">on_exit</label>
        <div class="flex gap-1">
          <input
            :value="modelValue.on_exit ?? ''"
            @input="update('on_exit', ($event.target as HTMLInputElement).value)"
            class="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
            placeholder="room/room_one.lua"
          />
          <button class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded" @click="openBrowse('on_exit')">…</button>
        </div>
      </div>
      <div>
        <label class="block text-sm text-neutral-400 mb-1">on_pulse</label>
        <div class="flex gap-1">
          <input
            :value="modelValue.on_pulse ?? ''"
            @input="update('on_pulse', ($event.target as HTMLInputElement).value)"
            class="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
            placeholder="room/room_one.lua"
          />
          <button class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded" @click="openBrowse('on_pulse')">…</button>
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
        <button class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded" @click="openBrowse('script_ref')">…</button>
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

    <AdminScriptBrowseModal v-if="showBrowse" :kind="type === 'room' ? 'room' : 'mob'" @pick="pick" @close="showBrowse = false" />
  </div>
</template>
