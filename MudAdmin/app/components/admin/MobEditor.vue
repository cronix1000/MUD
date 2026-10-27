<script setup lang="ts">
import ScriptPicker from './ScriptPicker.vue'
import { resolveWikiId } from '~/utils/wikiId'
import { ANSI_COLORS } from '~/utils/ansi'

const props = defineProps<{
  entityId: string
}>()
const emit = defineEmits<{ close: [] }>()

const { data, refresh } = await useFetch<{
  record: { entity_type: string; entity_id: string; doc: Record<string, unknown>; parent_id: string | null; updated_at: string }
}>(() => `/api/entities/mob/${encodeURIComponent(props.entityId)}`)

const currentDoc = ref<Record<string, unknown>>({})
const parentId = ref('')

watchEffect(() => {
  if (!data.value?.record) return
  currentDoc.value = data.value.record.doc
  parentId.value = data.value.record.parent_id ?? ''
})

interface DialogueRow {
  entity_id: string
  doc: { text?: string }
}

const { data: dialoguesData } = await useFetch<{ rows: DialogueRow[] }>(`/api/entities/dialogue`)

const draft = reactive({
  name: '',
  char: '',
  description: '',
  color: '',
  hp: 0,
  level: 1,
  ai: '',
  attack_damage: 0,
  attack_speed: 0,
  critical_chance: 0,
  critical_multiplier: 1.5,
  strength: 0,
  dexterity: 0,
  intelligence: 0,
  loot_drop: '',
  dialogue_root: '',
  script: '',
})

const patternsText = ref('')
const messagesText = ref('')
const metaText = ref('')

watchEffect(() => {
  const d = currentDoc.value
  const stat = (d.stat as Record<string, unknown>) ?? {}
  draft.name = String(d.name ?? '')
  draft.char = String(d.char ?? '')
  draft.description = String(d.description ?? '')
  draft.color = String(d.color ?? '')
  draft.hp = Number(d.hp ?? 0)
  draft.level = Number(d.level ?? 1)
  draft.ai = String(d.ai ?? '')
  draft.attack_damage = Number(d.attack_damage ?? 0)
  draft.attack_speed = Number(d.attack_speed ?? 0)
  draft.critical_chance = Number(d.critical_chance ?? 0)
  draft.critical_multiplier = Number(d.critical_multiplier ?? 1.5)
  draft.strength = Number(stat.strength ?? 0)
  draft.dexterity = Number(stat.dexterity ?? 0)
  draft.intelligence = Number(stat.intelligence ?? 0)
  draft.loot_drop = String(d.loot_drop ?? '')
  draft.dialogue_root = String(d.dialogue_root ?? '')
  draft.script = String(d.script ?? '')
  patternsText.value = d.attack_patterns === undefined ? '' : JSON.stringify(d.attack_patterns, null, 2)
  messagesText.value = d.messages === undefined ? '' : JSON.stringify(d.messages, null, 2)
  metaText.value = d.meta === undefined ? '' : JSON.stringify(d.meta, null, 2)
})

interface ScriptModelShape { on_enter?: string | null; on_exit?: string | null; on_pulse?: string | null; script_ref?: string | null }

const scriptModel = computed<ScriptModelShape>(() => ({ script_ref: draft.script }))
function updateScriptRef(v: ScriptModelShape) {
  draft.script = v.script_ref ?? ''
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

function parseOptionalJson(raw: string, label: string): Record<string, unknown> | unknown[] | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = JSON.parse(trimmed)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`${label} must be an object or array`)
  }
  return parsed
}

async function save() {
  saving.value = true
  error.value = null
  success.value = null
  try {
    let patterns: unknown = null
    let messages: unknown = null
    let meta: unknown = null
    try {
      patterns = parseOptionalJson(patternsText.value, 'attack_patterns')
      messages = parseOptionalJson(messagesText.value, 'messages')
      meta = parseOptionalJson(metaText.value, 'meta')
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Invalid JSON in advanced fields')
    }

    const next: Record<string, unknown> = {
      ...currentDoc.value,
      name: draft.name,
      char: draft.char,
      description: draft.description,
      color: draft.color,
      hp: Number(draft.hp),
      level: Number(draft.level),
      ai: draft.ai,
      attack_damage: Number(draft.attack_damage),
      attack_speed: Number(draft.attack_speed),
      critical_chance: Number(draft.critical_chance),
      critical_multiplier: Number(draft.critical_multiplier),
      stat: {
        strength: Number(draft.strength),
        dexterity: Number(draft.dexterity),
        intelligence: Number(draft.intelligence),
      },
      loot_drop: resolveWikiId(draft.loot_drop),
      dialogue_root: resolveWikiId(draft.dialogue_root),
      script: resolveWikiId(draft.script),
    }
    if (!next.loot_drop) delete next.loot_drop
    if (!next.dialogue_root) delete next.dialogue_root
    if (!next.script) delete next.script
    if (patterns === null) delete next.attack_patterns
    else next.attack_patterns = patterns
    if (messages === null) delete next.messages
    else next.messages = messages
    if (meta === null) delete next.meta
    else next.meta = meta

    await $fetch(`/api/entities/mob/${encodeURIComponent(props.entityId)}`, {
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
      </div>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">Stats</h3>
      <div class="grid grid-cols-4 gap-3">
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">hp</span>
          <input v-model.number="draft.hp" type="number" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">level</span>
          <input v-model.number="draft.level" type="number" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">attack_damage</span>
          <input v-model.number="draft.attack_damage" type="number" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">attack_speed</span>
          <input v-model.number="draft.attack_speed" type="number" step="0.05" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">critical_chance</span>
          <input v-model.number="draft.critical_chance" type="number" step="0.05" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">critical_multiplier</span>
          <input v-model.number="draft.critical_multiplier" type="number" step="0.05" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">stat.strength</span>
          <input v-model.number="draft.strength" type="number" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">stat.dexterity</span>
          <input v-model.number="draft.dexterity" type="number" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">stat.intelligence</span>
          <input v-model.number="draft.intelligence" type="number" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
      </div>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">AI / loot / dialogue</h3>
      <div class="grid grid-cols-3 gap-3">
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">ai</span>
          <input v-model="draft.ai" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">loot_drop</span>
          <AdminWikiIdInput v-model="draft.loot_drop" placeholder="loot table id" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">dialogue_root</span>
          <select v-model="draft.dialogue_root" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono">
            <option value="">— none —</option>
            <option v-for="d in dialoguesData?.rows ?? []" :key="d.entity_id" :value="d.entity_id">{{ d.entity_id }} {{ d.doc.text ? '— ' + String(d.doc.text).slice(0, 40) : '' }}</option>
          </select>
        </label>
      </div>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">Script</h3>
      <ScriptPicker :model-value="scriptModel" type="mob" @update:model-value="updateScriptRef" />
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">Advanced</h3>
      <div class="space-y-3">
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">parent_id (prototype inheritance)</span>
          <input v-model="parentId" placeholder="mob id to inherit from, e.g. goblin" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
        </label>
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">attack_patterns (JSON array — empty removes)</span>
          <textarea v-model="patternsText" rows="3" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
        </label>
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">messages (JSON — empty removes)</span>
          <textarea v-model="messagesText" rows="3" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
        </label>
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">meta (JSON — empty removes)</span>
          <textarea v-model="metaText" rows="3" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
        </label>
      </div>
    </div>
  </div>
</template>
