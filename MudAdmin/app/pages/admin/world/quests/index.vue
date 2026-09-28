<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const { data, refresh } = await useFetch<{ rows: Array<{ quest_id: string; name: string; description: string | null; script_ref: string | null }> }>(
  `/api/tables/world_quests`,
)

const { data: objectivesData } = await useFetch<{ rows: Array<{ quest_id: string; ordinal: number; kind: string; target: string | null; count: number }> }>(
  `/api/tables/world_quest_objectives`,
)

const { data: rewardsData } = await useFetch<{ rows: Array<{ quest_id: string; ordinal: number; kind: string; payload_json: string | null }> }>(
  `/api/tables/world_quest_rewards`,
)

const showCreate = ref(false)
const newQuest = ref({ quest_id: '', name: '', description: '', script_ref: '' })

async function createQuest() {
  if (!newQuest.value.quest_id || !newQuest.value.name) return
  await $fetch(`/api/tables/world_quests`, {
    method: 'POST',
    body: {
      quest_id: newQuest.value.quest_id,
      name: newQuest.value.name,
      description: newQuest.value.description || null,
      script_ref: newQuest.value.script_ref || null,
    },
  })
  showCreate.value = false
  newQuest.value = { quest_id: '', name: '', description: '', script_ref: '' }
  await refresh()
}

async function deleteQuest(q: { quest_id: string }) {
  if (!confirm(`Delete quest '${q.quest_id}' and all objectives/rewards?`)) return
  for (const o of (objectivesData.value?.rows ?? []).filter((r) => r.quest_id === q.quest_id)) {
    const id = `${o.quest_id}::${o.ordinal}`
    await $fetch(`/api/tables/world_quest_objectives/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }
  for (const r of (rewardsData.value?.rows ?? []).filter((x) => x.quest_id === q.quest_id)) {
    const id = `${r.quest_id}::${r.ordinal}`
    await $fetch(`/api/tables/world_quest_rewards/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }
  const key = `${q.quest_id}`
  await $fetch(`/api/tables/world_quests/${encodeURIComponent(key)}`, { method: 'DELETE' })
  await refresh()
  await objectivesData.value
  await rewardsData.value
}

const objectiveCount = (qid: string) => (objectivesData.value?.rows ?? []).filter((o) => o.quest_id === qid).length
const rewardCount = (qid: string) => (rewardsData.value?.rows ?? []).filter((r) => r.quest_id === qid).length
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-semibold font-mono">Quests</h2>
        <p class="text-neutral-400 text-sm">Quest definitions. Player progress views deferred until a <code>player_quests</code> table exists.</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm" @click="showCreate = true">+ New quest</button>
      </div>
    </div>

    <div class="overflow-x-auto rounded border border-neutral-800">
      <table class="w-full text-sm">
        <thead class="bg-neutral-900 text-left">
          <tr>
            <th class="px-3 py-2">quest_id</th>
            <th class="px-3 py-2">name</th>
            <th class="px-3 py-2">script_ref</th>
            <th class="px-3 py-2 w-20">objectives</th>
            <th class="px-3 py-2 w-20">rewards</th>
            <th class="px-3 py-2 w-32"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="q in data?.rows" :key="q.quest_id" class="hover:bg-neutral-900/60">
            <td class="px-3 py-2 font-mono">{{ q.quest_id }}</td>
            <td class="px-3 py-2">{{ q.name }}</td>
            <td class="px-3 py-2 font-mono text-xs text-neutral-400">{{ q.script_ref ?? '—' }}</td>
            <td class="px-3 py-2">{{ objectiveCount(q.quest_id) }}</td>
            <td class="px-3 py-2">{{ rewardCount(q.quest_id) }}</td>
            <td class="px-3 py-2 text-right">
              <NuxtLink :to="`/admin/world/quests/${encodeURIComponent(q.quest_id)}`" class="text-sky-400 hover:underline mr-3 text-sm">edit</NuxtLink>
              <button class="text-red-400 hover:underline text-sm" @click="deleteQuest(q)">delete</button>
            </td>
          </tr>
          <tr v-if="!data?.rows.length">
            <td colspan="6" class="px-3 py-6 text-center text-neutral-500">No quests yet.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showCreate" class="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" @click.self="showCreate = false">
      <form class="bg-neutral-900 border border-neutral-700 rounded p-6 w-full max-w-lg" @submit.prevent="createQuest">
        <h3 class="text-lg font-semibold mb-3">New quest</h3>
        <div class="space-y-3">
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">quest_id (slug)</span>
            <input v-model="newQuest.quest_id" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono" placeholder="goblin_hunt" />
          </label>
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">name</span>
            <input v-model="newQuest.name" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
          </label>
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">description</span>
            <textarea v-model="newQuest.description" rows="3" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" />
          </label>
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">script_ref (optional)</span>
            <input v-model="newQuest.script_ref" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono" placeholder="quest/goblin_hunt.lua" />
          </label>
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="px-3 py-1.5 rounded hover:bg-neutral-800 text-sm" @click="showCreate = false">Cancel</button>
          <button type="submit" class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm">Create</button>
        </div>
      </form>
    </div>
  </div>
</template>