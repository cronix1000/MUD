<script setup lang="ts">
import AdminComponentEditor from './AdminComponentEditor.vue'
import { resolveWikiId } from '~/utils/wikiId'
import { ANSI_COLORS } from '~/utils/ansi'

const props = defineProps<{
  entityId: string
}>()
const emit = defineEmits<{ close: [] }>()

const { data, refresh } = await useFetch<{
  record: { entity_type: string; entity_id: string; doc: Record<string, unknown>; parent_id: string | null; updated_at: string }
}>(() => `/api/entities/item/${encodeURIComponent(props.entityId)}`)

const currentDoc = ref<Record<string, unknown>>({})
const parentId = ref('')

watchEffect(() => {
  if (!data.value?.record) return
  currentDoc.value = data.value.record.doc
  parentId.value = data.value.record.parent_id ?? ''
})

const ITEM_TYPE_SUGGESTIONS = ['weapon', 'armour', 'consumable', 'misc']

const draft = reactive({
  name: '',
  char: '',
  description: '',
  color: '',
  type: '',
  value: 0,
  weight: 0,
  equippable: false,
  script: '',
})

const componentsText = ref('')
const metaText = ref('')
const advancedMode = ref(false)
const advancedDirty = ref(false)

watchEffect(() => {
  const d = currentDoc.value
  draft.name = String(d.name ?? '')
  draft.char = String(d.char ?? '')
  draft.description = String(d.description ?? '')
  draft.color = String(d.color ?? '')
  draft.type = String(d.type ?? '')
  draft.value = Number(d.value ?? 0)
  draft.weight = Number(d.weight ?? 0)
  draft.equippable = d.equippable === true
  draft.script = String(d.script ?? '')
  componentsText.value = d.components === undefined ? '' : JSON.stringify(d.components, null, 2)
  metaText.value = d.meta === undefined ? '' : JSON.stringify(d.meta, null, 2)
})

function parseEnvelope(raw: string): Record<string, unknown> {
  let parsed: unknown = {}
  try {
    parsed = raw.trim() === '' ? {} : JSON.parse(raw)
  } catch {
    return {}
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>
    if (obj.components && typeof obj.components === 'object' && !Array.isArray(obj.components)) {
      return obj.components as Record<string, unknown>
    }
    return obj
  }
  return {}
}

const parsedComponents = computed<Record<string, unknown>>(() => parseEnvelope(componentsText.value))

function onTypedComponentsChange(next: Record<string, unknown>) {
  componentsText.value = JSON.stringify(next, null, 2)
  advancedDirty.value = false
}

function onAdvancedTextChange(text: string) {
  componentsText.value = text
  advancedDirty.value = true
}

function adoptAdvancedEdits() {
  advancedDirty.value = false
}

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
    let components: Record<string, unknown> | null = null
    if (componentsText.value.trim()) {
      components = parseEnvelope(componentsText.value)
    }
    let meta: unknown = null
    if (metaText.value.trim()) {
      const parsed = JSON.parse(metaText.value)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('meta must be an object')
      }
      meta = parsed
    }

    const next: Record<string, unknown> = {
      ...currentDoc.value,
      name: draft.name,
      char: draft.char,
      description: draft.description,
      color: draft.color,
      type: draft.type,
      value: Number(draft.value),
      weight: Number(draft.weight),
      equippable: draft.equippable === true,
    }
    const script = resolveWikiId(draft.script)
    if (script) next.script = script
    else {
      delete next.script
      delete next.script_ref
    }
    if (components === null) delete next.components
    else next.components = components
    if (meta === null) delete next.meta
    else next.meta = meta

    await $fetch(`/api/entities/item/${encodeURIComponent(props.entityId)}`, {
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
        <h2 class="text-xl font-semibold font-mono truncate">{{ draft.name || props.entityId }} <span class="text-neutral-500 text-sm">({{ props.entityId }})</span></h2>
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
      <textarea v-model="rawText" rows="18" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"></textarea>
      <p v-if="rawError" class="text-xs text-red-300">{{ rawError }}</p>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">Identity</h3>
      <div class="grid grid-cols-3 gap-3">
        <label class="col-span-2 text-sm">
          <span class="block text-neutral-400 mb-1">name</span>
          <input v-model="draft.name" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">char</span>
          <input v-model="draft.char" maxlength="1" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-center" />
        </label>
        <label class="col-span-2 text-sm">
          <AdminWikiText v-model="draft.description" :rows="3" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">color</span>
          <select v-model="draft.color" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono">
            <option value="">— none —</option>
            <option v-for="c in ANSI_COLORS" :key="c.code" :value="c.code">{{ c.code }} {{ c.label }}</option>
          </select>
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">type</span>
          <input v-model="draft.type" list="item-type-suggestions" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono" />
          <datalist id="item-type-suggestions">
            <option v-for="t in ITEM_TYPE_SUGGESTIONS" :key="t" :value="t" />
          </datalist>
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">value</span>
          <input v-model.number="draft.value" type="number" min="0" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">weight</span>
          <input v-model.number="draft.weight" type="number" min="0" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="text-sm flex items-end gap-2">
          <input v-model="draft.equippable" type="checkbox" />
          <span>equippable</span>
        </label>
      </div>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">Components</h3>
      <p class="text-xs text-neutral-500 mb-3">
        Each component is a typed wrapper over a key under <span class="font-mono">components</span>. Add the ones that apply.
      </p>
      <AdminComponentEditor
        archetype="item"
        :row="currentDoc"
        :model-value="parsedComponents"
        @update:model-value="onTypedComponentsChange"
      />
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">Script</h3>
      <label class="block text-sm">
        <span class="block text-neutral-400 mb-1">script (WikiId, e.g. <span class="font-mono">[[skill:fireball]]</span>)</span>
        <AdminWikiIdInput v-model="draft.script" placeholder="script id" />
      </label>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">Advanced</h3>
      <div class="space-y-3">
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">parent_id (prototype inheritance)</span>
          <input v-model="parentId" placeholder="item id to inherit from, e.g. iron_sword" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
        </label>
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">meta (JSON — empty removes)</span>
          <textarea v-model="metaText" rows="3" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
        </label>
      </div>
    </div>

    <details class="bg-neutral-900 border border-neutral-800 rounded p-4" :open="advancedMode" @toggle="(e) => advancedMode = (e.target as HTMLDetailsElement).open">
      <summary class="text-sm font-semibold cursor-pointer">Advanced — raw components JSON</summary>
      <p class="mt-2 text-xs text-neutral-500 mb-2">
        Hand-edit the raw envelope. Saved verbatim on Save. The typed cards above re-render only after you click <strong>Mark typed cards in sync</strong>.
      </p>
      <textarea
        :value="componentsText"
        rows="10"
        class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
        @input="(e) => onAdvancedTextChange((e.target as HTMLTextAreaElement).value)"
      />
      <div class="mt-2 flex items-center gap-2">
        <button
          type="button"
          class="px-2 py-1 text-xs border border-neutral-700 rounded hover:bg-neutral-800"
          @click="adoptAdvancedEdits"
        >Mark typed cards in sync</button>
        <span v-if="advancedDirty" class="text-xs text-amber-400">Raw edits pending — typed cards will overwrite on next Save unless you click above.</span>
      </div>
    </details>
  </div>
</template>
