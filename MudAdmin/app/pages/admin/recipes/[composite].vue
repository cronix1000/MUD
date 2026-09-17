<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const route = useRoute()
const compositeKey = computed(() => decodeURIComponent(String(route.params.composite)))
const split = computed(() => compositeKey.value.split('::'))
const worldId = computed(() => split.value[0] ?? '')
const recipeId = computed(() => split.value[1] ?? '')

interface RecipeRow {
  world_id: string
  recipe_id: string
  name: string
  description: string | null
  skill_id: string | null
  required_skill_level: number
  station_type: string | null
  outputs_json: string | null
  inputs_json: string | null
  craft_time_seconds: number
  experience_gain: number
  script_ref: string | null
  is_auto_learned: number
  xp_curve?: string | null
  xp_curve_params?: string | null
}

interface Item { world_id: string; template_id: string; name: string }
interface Skill { world_id: string; skill_id: string; name: string; xp_curve?: string | null }

interface IoEntry { item_template_id: string; quantity: number }

const { data, refresh } = await useFetch<{ rows: RecipeRow[] }>('/api/tables/world_recipes')
const { data: itemsData } = await useFetch<{ rows: Item[] }>('/api/tables/world_items')
const { data: skillsData } = await useFetch<{ rows: Skill[] }>('/api/tables/world_skills')

const recipe = computed(() => (data.value?.rows ?? []).find((r) => r.world_id === worldId.value && r.recipe_id === recipeId.value))

const itemsInWorld = computed(() => (itemsData.value?.rows ?? []).filter((i) => i.world_id === worldId.value))
const skillsInWorld = computed(() => (skillsData.value?.rows ?? []).filter((s) => s.world_id === worldId.value))

const draft = reactive({
  name: '',
  description: '',
  skill_id: '' as string,
  required_skill_level: 0,
  station_type: '' as string,
  inputs: [] as IoEntry[],
  outputs: [] as IoEntry[],
  craft_time_seconds: 3.0,
  experience_gain: 0,
  is_auto_learned: 1,
  script_ref: '' as string,
})

watchEffect(() => {
  if (!recipe.value) return
  draft.name = recipe.value.name
  draft.description = recipe.value.description ?? ''
  draft.skill_id = recipe.value.skill_id ?? ''
  draft.required_skill_level = recipe.value.required_skill_level ?? 0
  draft.station_type = recipe.value.station_type ?? ''
  draft.craft_time_seconds = recipe.value.craft_time_seconds ?? 3.0
  draft.experience_gain = recipe.value.experience_gain ?? 0
  draft.is_auto_learned = recipe.value.is_auto_learned ?? 1
  draft.script_ref = recipe.value.script_ref ?? ''
  try { draft.inputs = JSON.parse(recipe.value.inputs_json ?? '[]') } catch { draft.inputs = [] }
  try { draft.outputs = JSON.parse(recipe.value.outputs_json ?? '[]') } catch { draft.outputs = [] }
})

function addInput() { draft.inputs.push({ item_template_id: '', quantity: 1 }) }
function removeInput(i: number) { draft.inputs.splice(i, 1) }
function addOutput() { draft.outputs.push({ item_template_id: '', quantity: 1 }) }
function removeOutput(i: number) { draft.outputs.splice(i, 1) }

const saving = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

async function save() {
  if (!recipe.value) return
  saving.value = true
  error.value = null
  try {
    const key = `${worldId.value}::${recipeId.value}`
    await $fetch(`/api/tables/world_recipes/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: {
        name: draft.name,
        description: draft.description || null,
        skill_id: draft.skill_id || null,
        required_skill_level: Number(draft.required_skill_level) || 0,
        station_type: draft.station_type || null,
        craft_time_seconds: Number(draft.craft_time_seconds) || 3.0,
        experience_gain: Number(draft.experience_gain) || 0,
        script_ref: draft.script_ref || null,
        is_auto_learned: draft.is_auto_learned ? 1 : 0,
        inputs_json: JSON.stringify(draft.inputs),
        outputs_json: JSON.stringify(draft.outputs),
      },
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
</script>

<template>
  <div v-if="!recipe" class="text-neutral-400">Recipe not found.</div>
  <div v-else class="space-y-4 max-w-3xl">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <NuxtLink to="/admin/recipes" class="text-sky-400 hover:underline text-sm">← recipes</NuxtLink>
        <h2 class="text-xl font-semibold font-mono">{{ recipe.recipe_id }}</h2>
        <span class="text-neutral-500 text-sm">{{ worldId }}</span>
      </div>
      <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50" :disabled="saving" @click="save">
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </div>

    <div v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ error }}</div>
    <div v-if="success" class="bg-emerald-900/40 border border-emerald-700 rounded px-3 py-2 text-sm text-emerald-200">{{ success }}</div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3">
      <h3 class="text-sm font-semibold">Identity</h3>
      <label class="block text-sm">
        <span class="block text-neutral-400 mb-1">name</span>
        <input v-model="draft.name" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
      </label>
      <div>
        <AdminWikiText v-model="draft.description" :world-id="worldId" :rows="3" />
      </div>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3">
      <h3 class="text-sm font-semibold">Skill gate</h3>
      <div class="grid grid-cols-2 gap-3">
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">skill</span>
          <select v-model="draft.skill_id" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm">
            <option value="">— none —</option>
            <option v-for="s in skillsInWorld" :key="s.skill_id" :value="s.skill_id">{{ s.skill_id }} — {{ s.name }}</option>
          </select>
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">required skill level</span>
          <input v-model.number="draft.required_skill_level" type="number" min="0" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">station type</span>
          <select v-model="draft.station_type" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm">
            <option value="">— any —</option>
            <option value="forge">forge</option>
            <option value="alchemy_lab">alchemy_lab</option>
            <option value="campfire">campfire</option>
            <option value="anvil">anvil</option>
            <option value="alchemy_circle">alchemy_circle (portable)</option>
          </select>
        </label>
        <label class="text-sm flex items-center gap-2 mt-5">
          <input v-model="draft.is_auto_learned" type="checkbox" :true-value="1" :false-value="0" />
          <span>auto-learn at level</span>
        </label>
      </div>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-semibold">Inputs ({{ draft.inputs.length }})</h3>
        <button class="px-2 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 rounded" @click="addInput">+ Add input</button>
      </div>
      <div v-if="!draft.inputs.length" class="text-neutral-500 text-sm">No inputs.</div>
      <div v-for="(inp, i) in draft.inputs" :key="i" class="flex gap-2 items-center mb-1">
        <select v-model="inp.item_template_id" class="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm">
          <option value="">— pick item —</option>
          <option v-for="it in itemsInWorld" :key="it.template_id" :value="it.template_id">{{ it.template_id }} — {{ it.name }}</option>
        </select>
        <input v-model.number="inp.quantity" type="number" min="1" class="w-16 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
        <button class="text-red-400 hover:underline text-xs" @click="removeInput(i)">remove</button>
      </div>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-semibold">Outputs ({{ draft.outputs.length }})</h3>
        <button class="px-2 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 rounded" @click="addOutput">+ Add output</button>
      </div>
      <div v-if="!draft.outputs.length" class="text-neutral-500 text-sm">No outputs.</div>
      <div v-for="(out, i) in draft.outputs" :key="i" class="flex gap-2 items-center mb-1">
        <select v-model="out.item_template_id" class="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm">
          <option value="">— pick item —</option>
          <option v-for="it in itemsInWorld" :key="it.template_id" :value="it.template_id">{{ it.template_id }} — {{ it.name }}</option>
        </select>
        <input v-model.number="out.quantity" type="number" min="1" class="w-16 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
        <button class="text-red-400 hover:underline text-xs" @click="removeOutput(i)">remove</button>
      </div>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3">
      <h3 class="text-sm font-semibold">Craft details</h3>
      <div class="grid grid-cols-3 gap-3">
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">craft time (seconds)</span>
          <input v-model.number="draft.craft_time_seconds" type="number" step="0.5" min="0" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">experience gain</span>
          <input v-model.number="draft.experience_gain" type="number" min="0" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">script_ref (optional)</span>
          <input v-model="draft.script_ref" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" placeholder="scripts/craft/special.lua" />
        </label>
      </div>
    </div>
  </div>
</template>
