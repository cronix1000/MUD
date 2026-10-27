<script setup lang="ts">
import { resolveWikiId } from '~/utils/wikiId'

const props = defineProps<{
  entityId: string
}>()
const emit = defineEmits<{ close: [] }>()

const { data, refresh } = await useFetch<{
  record: { entity_type: string; entity_id: string; doc: Record<string, unknown>; parent_id: string | null; updated_at: string }
}>(() => `/api/entities/zone/${encodeURIComponent(props.entityId)}`)

const currentDoc = ref<Record<string, unknown>>({})
const parentId = ref('')

watchEffect(() => {
  if (!data.value?.record) return
  currentDoc.value = data.value.record.doc
  parentId.value = data.value.record.parent_id ?? ''
})

const regionId = computed(() => String(currentDoc.value.region_id ?? props.entityId.split('::')[0] ?? ''))
const zoneId = computed(() => Number(currentDoc.value.zone_id ?? Number(props.entityId.split('::')[1] ?? 0)))

const name = ref('')
const description = ref('')
const isActive = ref(true)
const scriptRef = ref('')
const rulesText = ref('')

watchEffect(() => {
  const d = currentDoc.value
  name.value = String(d.name ?? '')
  description.value = String(d.description ?? '')
  isActive.value = d.is_active === undefined ? true : d.is_active === true
  scriptRef.value = String(d.zone_script_ref ?? '')
  rulesText.value = d.rules === undefined ? '' : JSON.stringify(d.rules, null, 2)
})

const saving = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

const showRaw = ref(false)
const rawText = ref('')
const rawError = ref<string | null>(null)

function openRaw() {
  rawText.value = JSON.stringify(currentDoc.value, null, 2)
  rawError.value = null
  showRaw.value = true
}
function applyRaw() {
  try {
    const parsed = JSON.parse(rawText.value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('doc must be a JSON object')
    }
    currentDoc.value = parsed
    rawError.value = null
    showRaw.value = false
  } catch (e) {
    rawError.value = e instanceof Error ? e.message : 'Invalid JSON'
  }
}

async function save() {
  saving.value = true
  error.value = null
  success.value = null
  try {
    let rules: unknown = null
    if (rulesText.value.trim()) {
      const parsed = JSON.parse(rulesText.value)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('rules must be an object')
      }
      rules = parsed
    }
    const next: Record<string, unknown> = {
      ...currentDoc.value,
      region_id: regionId.value,
      zone_id: zoneId.value,
      name: name.value.trim(),
      description: description.value,
      is_active: isActive.value === true,
    }
    const script = resolveWikiId(scriptRef.value)
    if (script) next.zone_script_ref = script
    else delete next.zone_script_ref
    if (rules === null) delete next.rules
    else next.rules = rules

    await $fetch(`/api/entities/zone/${encodeURIComponent(props.entityId)}`, {
      method: 'PUT',
      body: { doc: next, parent_id: parentId.value.trim() || null },
    })
    success.value = 'Saved.'
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    error.value = err.data?.statusMessage ?? err.message ?? 'Save failed'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <button class="text-sky-400 hover:underline text-sm" @click="emit('close')">← back</button>
        <h2 class="text-xl font-semibold font-mono truncate">{{ name || props.entityId }} <span class="text-neutral-500 text-sm">({{ props.entityId }})</span></h2>
      </div>
      <div class="flex items-center gap-2">
        <button class="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-sm" @click="openRaw">Raw JSON</button>
        <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50" :disabled="saving" @click="save">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ error }}</div>
    <div v-if="success" class="bg-emerald-900/40 border border-emerald-700 rounded px-3 py-2 text-sm text-emerald-200">{{ success }}</div>

    <div v-if="showRaw" class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">Raw document</h3>
        <div class="flex gap-2">
          <button class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded" @click="applyRaw">Apply</button>
          <button class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded" @click="showRaw = false">Cancel</button>
        </div>
      </div>
      <textarea v-model="rawText" rows="16" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"></textarea>
      <p v-if="rawError" class="text-xs text-red-300">{{ rawError }}</p>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">Identity</h3>
      <div class="grid grid-cols-4 gap-3">
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">region_id</span>
          <input :value="regionId" disabled class="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 font-mono text-sm opacity-60" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">zone_id</span>
          <input :value="zoneId" disabled type="number" class="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-sm opacity-60" />
        </label>
        <label class="col-span-2 text-sm">
          <span class="block text-neutral-400 mb-1">name</span>
          <input v-model="name" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="col-span-3 text-sm">
          <AdminWikiText v-model="description" :rows="3" />
        </label>
        <label class="text-sm flex items-end gap-2 pb-1">
          <input v-model="isActive" type="checkbox" />
          <span>is_active</span>
        </label>
      </div>
      <p class="mt-2 text-xs text-neutral-500">The zone key is fixed at creation ({{ regionId }}::{{ zoneId }}). Create a new zone to change it.</p>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">Script</h3>
      <label class="block text-sm">
        <span class="block text-neutral-400 mb-1">zone_script_ref</span>
        <AdminWikiIdInput v-model="scriptRef" placeholder="zone script id" />
      </label>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">Advanced</h3>
      <div class="space-y-3">
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">parent_id (prototype inheritance)</span>
          <input v-model="parentId" placeholder="zone id to inherit from, e.g. floor1::2" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
        </label>
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">rules (JSON object — empty removes)</span>
          <textarea v-model="rulesText" rows="5" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
        </label>
      </div>
    </div>
  </div>
</template>
