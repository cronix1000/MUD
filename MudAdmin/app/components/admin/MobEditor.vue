<script setup lang="ts">
import ScriptPicker from './ScriptPicker.vue'
import { resolveWikiId } from '~/utils/wikiId'

interface ColumnInfo { name: string; type: string; pk: number; dflt_value: unknown; notnull: number }

const split = computed(() => decodeURIComponent(props.compositeKey).split('::'))
const worldId = computed(() => split.value[0] ?? '')
const templateId = computed(() => split.value[1] ?? '')

const props = defineProps<{
  compositeKey: string
}>()
const emit = defineEmits<{ close: [] }>()

const { data, refresh } = await useFetch<{ columns: ColumnInfo[]; rows: Record<string, unknown>[] }>(
  () => `/api/tables/world_mobs`,
)

interface DialogueSummary {
  world_id: string
  node_id: string
  text: string | null
}

const { data: dialoguesData } = await useFetch<{ rows: DialogueSummary[] }>(`/api/tables/world_dialogues`)

const dialoguesInWorld = computed(() => (dialoguesData.value?.rows ?? []).filter((d) => d.world_id === worldId.value))

const mob = computed(() => {
  return data.value?.rows.find((r) => String(r.world_id) === worldId.value && String(r.template_id) === templateId.value)
})

const draft = ref<Record<string, string>>({})
const scriptRef = ref<string | null>(null)

watchEffect(() => {
  if (!mob.value) return
  const next: Record<string, string> = {}
  for (const c of data.value?.columns ?? []) {
    const v = mob.value[c.name]
    next[c.name] = v === null || v === undefined ? '' : String(v)
  }
  draft.value = next
  scriptRef.value = (mob.value.script_ref as string | null) ?? null
})

const saving = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

async function save() {
  if (!mob.value) return
  saving.value = true
  error.value = null
  try {
    const key = `${mob.value.world_id}::${mob.value.template_id}`
    const body = {
      ...draft.value,
      loot_drop: resolveWikiId(draft.value.loot_drop, mob.value.world_id),
      dialogue_root: resolveWikiId(draft.value.dialogue_root, mob.value.world_id),
      script_ref: resolveWikiId(scriptRef.value) || '',
    }
    await $fetch(`/api/tables/world_mobs/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body,
    })
    success.value = 'Saved.'
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Save failed'
  } finally {
    saving.value = false
  }
}

const intCols = new Set(['hp', 'level', 'strength', 'dexterity', 'intelligence', 'attack_damage'])
const realCols = new Set(['attack_speed', 'crit_chance', 'crit_mult'])

interface ScriptModelShape { on_enter?: string | null; on_exit?: string | null; on_pulse?: string | null; script_ref?: string | null }

const scriptModel = computed<ScriptModelShape>(() => ({
  script_ref: scriptRef.value,
}))
function updateScriptRef(v: ScriptModelShape) {
  scriptRef.value = v.script_ref ?? null
}
</script>

<template>
  <div v-if="!mob" class="text-neutral-400">Mob not found.</div>
  <div v-else class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <button class="text-sky-400 hover:underline text-sm" @click="emit('close')">← back</button>
        <h2 class="text-xl font-semibold font-mono">{{ mob.name }} <span class="text-neutral-500 text-sm">({{ templateId }})</span></h2>
      </div>
      <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50" :disabled="saving" @click="save">
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </div>

    <div v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ error }}</div>
    <div v-if="success" class="bg-emerald-900/40 border border-emerald-700 rounded px-3 py-2 text-sm text-emerald-200">{{ success }}</div>

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
          <AdminWikiText v-model="draft.description" :world-id="worldId" :rows="3" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">color</span>
          <input v-model="draft.color" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono" />
        </label>
      </div>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">Stats</h3>
      <div class="grid grid-cols-4 gap-3">
        <label v-for="col in (data?.columns ?? []).filter((c) => intCols.has(c.name))" :key="col.name" class="text-sm">
          <span class="block text-neutral-400 mb-1">{{ col.name }}</span>
          <input v-model.number="draft[col.name]" type="number" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label v-for="col in (data?.columns ?? []).filter((c) => realCols.has(c.name))" :key="col.name" class="text-sm">
          <span class="block text-neutral-400 mb-1">{{ col.name }}</span>
          <input v-model.number="draft[col.name]" type="number" step="0.05" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
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
          <AdminWikiIdInput v-model="draft.loot_drop" :world-id="worldId" placeholder="loot table id" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">dialogue_root</span>
          <select v-model="draft.dialogue_root" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono">
            <option value="">— none —</option>
            <option v-for="d in dialoguesInWorld" :key="d.node_id" :value="d.node_id">{{ d.node_id }} {{ d.text ? '— ' + d.text.slice(0, 40) : '' }}</option>
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
          <span class="block text-neutral-400 mb-1">attack_patterns_json</span>
          <textarea v-model="draft.attack_patterns_json" rows="3" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
        </label>
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">extra_json</span>
          <textarea v-model="draft.extra_json" rows="3" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
        </label>
      </div>
    </div>
  </div>
</template>
