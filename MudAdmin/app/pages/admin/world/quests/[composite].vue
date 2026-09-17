<script setup lang="ts">
import ScriptPicker from '~/components/admin/ScriptPicker.vue'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const compositeKey = computed(() => decodeURIComponent(String(route.params.composite)))
const split = computed(() => compositeKey.value.split('::'))
const worldId = computed(() => split.value[0] ?? '')
const questId = computed(() => split.value[1] ?? '')

const { data, refresh } = await useFetch<{ rows: Array<{ world_id: string; quest_id: string; name: string; description: string | null; script_ref: string | null }> }>(
  `/api/tables/world_quests`,
)
const { data: objectivesData, refresh: refreshObjectives } = await useFetch<{ rows: Array<{ world_id: string; quest_id: string; ordinal: number; kind: string; target: string | null; count: number }> }>(
  `/api/tables/world_quest_objectives`,
)
const { data: rewardsData, refresh: refreshRewards } = await useFetch<{ rows: Array<{ world_id: string; quest_id: string; ordinal: number; kind: string; payload_json: string | null }> }>(
  `/api/tables/world_quest_rewards`,
)

const quest = computed(() => (data.value?.rows ?? []).find((q) => q.world_id === worldId.value && q.quest_id === questId.value))

const draft = reactive({
  name: '',
  description: '',
  script_ref: '' as string,
})

watchEffect(() => {
  if (!quest.value) return
  draft.name = quest.value.name
  draft.description = quest.value.description ?? ''
  draft.script_ref = quest.value.script_ref ?? ''
})

const objectives = ref<Array<{ ordinal: number; kind: string; target: string; count: number; _deleted?: boolean; _isNew?: boolean }>>([])
watchEffect(() => {
  if (!objectivesData.value) return
  objectives.value = (objectivesData.value.rows as Array<Record<string, unknown>>)
    .filter((r) => r.world_id === worldId.value && r.quest_id === questId.value)
    .sort((a, b) => Number(a.ordinal) - Number(b.ordinal))
    .map((r) => ({
      ordinal: Number(r.ordinal),
      kind: String(r.kind),
      target: String(r.target ?? ''),
      count: Number(r.count ?? 1),
    }))
})

const rewards = ref<Array<{ ordinal: number; kind: string; payload_json: string; _deleted?: boolean; _isNew?: boolean }>>([])
watchEffect(() => {
  if (!rewardsData.value) return
  rewards.value = (rewardsData.value.rows as Array<Record<string, unknown>>)
    .filter((r) => r.world_id === worldId.value && r.quest_id === questId.value)
    .sort((a, b) => Number(a.ordinal) - Number(b.ordinal))
    .map((r) => ({
      ordinal: Number(r.ordinal),
      kind: String(r.kind),
      payload_json: String(r.payload_json ?? ''),
    }))
})

function addObjective() {
  const next = (objectives.value[objectives.value.length - 1]?.ordinal ?? 0) + 1
  objectives.value.push({ ordinal: next, kind: 'kill_mob', target: '', count: 1, _isNew: true })
}
function removeObjective(i: number) {
  const o = objectives.value[i]
  if (o._isNew) objectives.value.splice(i, 1)
  else objectives.value[i] = { ...o, _deleted: true }
}
function addReward() {
  const next = (rewards.value[rewards.value.length - 1]?.ordinal ?? 0) + 1
  rewards.value.push({ ordinal: next, kind: 'xp', payload_json: '{}', _isNew: true })
}
function removeReward(i: number) {
  const r = rewards.value[i]
  if (r._isNew) rewards.value.splice(i, 1)
  else rewards.value[i] = { ...r, _deleted: true }
}

const scriptModel = computed(() => ({ script_ref: draft.script_ref || null }))
function updateScriptRef(v: { script_ref?: string | null }) {
  draft.script_ref = v.script_ref ?? ''
}

const saving = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

async function save() {
  if (!quest.value) return
  saving.value = true
  error.value = null
  try {
    const key = `${worldId.value}::${questId.value}`
    await $fetch(`/api/tables/world_quests/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: {
        name: draft.name,
        description: draft.description || null,
        script_ref: draft.script_ref || null,
      },
    })

    for (const o of objectives.value.filter((x) => x._deleted)) {
      const id = `${worldId.value}::${questId.value}::${o.ordinal}`
      await $fetch(`/api/tables/world_quest_objectives/${encodeURIComponent(id)}`, { method: 'DELETE' })
    }
    for (const o of objectives.value.filter((x) => !x._deleted && x._isNew)) {
      await $fetch(`/api/tables/world_quest_objectives`, {
        method: 'POST',
        body: {
          world_id: worldId.value,
          quest_id: questId.value,
          ordinal: o.ordinal,
          kind: o.kind,
          target: o.target,
          count: o.count,
        },
      })
    }
    for (const o of objectives.value.filter((x) => !x._deleted && !x._isNew)) {
      const id = `${worldId.value}::${questId.value}::${o.ordinal}`
      await $fetch(`/api/tables/world_quest_objectives/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: { kind: o.kind, target: o.target, count: o.count },
      })
    }

    for (const r of rewards.value.filter((x) => x._deleted)) {
      const id = `${worldId.value}::${questId.value}::${r.ordinal}`
      await $fetch(`/api/tables/world_quest_rewards/${encodeURIComponent(id)}`, { method: 'DELETE' })
    }
    for (const r of rewards.value.filter((x) => !x._deleted && x._isNew)) {
      await $fetch(`/api/tables/world_quest_rewards`, {
        method: 'POST',
        body: {
          world_id: worldId.value,
          quest_id: questId.value,
          ordinal: r.ordinal,
          kind: r.kind,
          payload_json: r.payload_json || null,
        },
      })
    }
    for (const r of rewards.value.filter((x) => !x._deleted && !x._isNew)) {
      const id = `${worldId.value}::${questId.value}::${r.ordinal}`
      await $fetch(`/api/tables/world_quest_rewards/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: { kind: r.kind, payload_json: r.payload_json || null },
      })
    }

    success.value = 'Saved.'
    await refresh()
    await refreshObjectives()
    await refreshRewards()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Save failed'
  } finally {
    saving.value = false
  }
}

const KINDS_OBJ = ['kill_mob', 'collect_item', 'reach_room', 'lua_predicate']
const KINDS_REW = ['xp', 'gold', 'item', 'faction', 'lua']
</script>

<template>
  <div v-if="!quest" class="text-neutral-400">Quest not found.</div>
  <div v-else class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <NuxtLink to="/admin/world/quests" class="text-sky-400 hover:underline text-sm">← quests</NuxtLink>
        <h2 class="text-xl font-semibold font-mono">{{ quest.quest_id }}</h2>
        <span class="text-neutral-500 text-sm">{{ quest.name }}</span>
      </div>
      <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50" :disabled="saving" @click="save">
        {{ saving ? 'Saving…' : 'Save all' }}
      </button>
    </div>

    <div v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ error }}</div>
    <div v-if="success" class="bg-emerald-900/40 border border-emerald-700 rounded px-3 py-2 text-sm text-emerald-200">{{ success }}</div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3">
      <label class="block text-sm">
        <span class="block text-neutral-400 mb-1">name</span>
        <input v-model="draft.name" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
      </label>
      <label class="block text-sm">
        <span class="block text-neutral-400 mb-1">description</span>
        <textarea v-model="draft.description" rows="3" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" />
      </label>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <ScriptPicker :model-value="scriptModel" type="mob" @update:model-value="updateScriptRef" />
      <p class="text-xs text-neutral-500 mt-2">Tip: this script gets <code>subscribe('RoomEntered', …)</code> etc. — see <code>scripts/quest/newbie_move_quest.lua</code> for the pattern.</p>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold">Objectives</h3>
        <button class="px-2 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 rounded" @click="addObjective">+ Add objective</button>
      </div>
      <table class="w-full text-sm">
        <thead class="text-left text-neutral-500 text-xs">
          <tr><th class="px-2 py-1 w-12">#</th><th class="px-2 py-1">kind</th><th class="px-2 py-1">target</th><th class="px-2 py-1 w-16">count</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="(o, i) in objectives.filter((x)=>!x._deleted)" :key="o.ordinal" class="border-t border-neutral-800">
            <td class="px-2 py-1 font-mono text-neutral-500">{{ o.ordinal }}</td>
            <td class="px-2 py-1">
              <select v-model="o.kind" class="bg-neutral-950 border border-neutral-700 rounded px-1 py-0.5 font-mono">
                <option v-for="k in KINDS_OBJ" :key="k" :value="k">{{ k }}</option>
              </select>
            </td>
            <td class="px-2 py-1"><input v-model="o.target" class="w-full bg-neutral-950 border border-neutral-700 rounded px-1 py-0.5 font-mono" /></td>
            <td class="px-2 py-1"><input v-model.number="o.count" type="number" min="1" class="w-14 bg-neutral-950 border border-neutral-700 rounded px-1 py-0.5 font-mono" /></td>
            <td class="px-2 py-1 text-right"><button class="text-red-400 hover:underline text-xs" @click="removeObjective(objectives.indexOf(o))">remove</button></td>
          </tr>
          <tr v-if="!objectives.filter((x)=>!x._deleted).length"><td colspan="5" class="px-2 py-3 text-center text-neutral-500">No objectives.</td></tr>
        </tbody>
      </table>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold">Rewards</h3>
        <button class="px-2 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 rounded" @click="addReward">+ Add reward</button>
      </div>
      <table class="w-full text-sm">
        <thead class="text-left text-neutral-500 text-xs">
          <tr><th class="px-2 py-1 w-12">#</th><th class="px-2 py-1">kind</th><th class="px-2 py-1">payload_json</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in rewards.filter((x)=>!x._deleted)" :key="r.ordinal" class="border-t border-neutral-800">
            <td class="px-2 py-1 font-mono text-neutral-500">{{ r.ordinal }}</td>
            <td class="px-2 py-1">
              <select v-model="r.kind" class="bg-neutral-950 border border-neutral-700 rounded px-1 py-0.5 font-mono">
                <option v-for="k in KINDS_REW" :key="k" :value="k">{{ k }}</option>
              </select>
            </td>
            <td class="px-2 py-1"><input v-model="r.payload_json" class="w-full bg-neutral-950 border border-neutral-700 rounded px-1 py-0.5 font-mono" :placeholder="r.kind === 'gold' ? '50' : '{}'" /></td>
            <td class="px-2 py-1 text-right"><button class="text-red-400 hover:underline text-xs" @click="removeReward(rewards.indexOf(r))">remove</button></td>
          </tr>
          <tr v-if="!rewards.filter((x)=>!x._deleted).length"><td colspan="4" class="px-2 py-3 text-center text-neutral-500">No rewards.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
