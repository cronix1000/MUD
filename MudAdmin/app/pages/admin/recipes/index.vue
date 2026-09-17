<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface RecipeRow {
  world_id: string
  recipe_id: string
  name: string
  description: string | null
  skill_id: string | null
  required_skill_level: number
  station_type: string | null
  craft_time_seconds: number
  experience_gain: number
  is_auto_learned: number
}

const { data, refresh } = await useFetch<{ rows: RecipeRow[] }>('/api/tables/world_recipes')
const { data: worldsData } = await useFetch<{ rows: Array<{ id: string; name: string }> }>('/api/tables/world_worlds')

const selectedWorld = ref<string>('')
watchEffect(() => {
  if (!selectedWorld.value && worldsData.value?.rows.length) {
    selectedWorld.value = worldsData.value.rows[0].id
  }
})

const filtered = computed(() => (data.value?.rows ?? []).filter((r) => r.world_id === selectedWorld.value))

const showCreate = ref(false)
const newRecipe = ref({ world_id: '', recipe_id: '', name: '', description: '', skill_id: '', required_skill_level: 0, station_type: '' })
watchEffect(() => { newRecipe.value.world_id = selectedWorld.value })

async function createRecipe() {
  if (!newRecipe.value.recipe_id || !newRecipe.value.name) return
  await $fetch('/api/tables/world_recipes', {
    method: 'POST',
    body: {
      world_id: selectedWorld.value,
      recipe_id: newRecipe.value.recipe_id,
      name: newRecipe.value.name,
      description: newRecipe.value.description || null,
      skill_id: newRecipe.value.skill_id || null,
      required_skill_level: Number(newRecipe.value.required_skill_level) || 0,
      station_type: newRecipe.value.station_type || null,
      craft_time_seconds: 3.0,
      experience_gain: 0,
      is_auto_learned: 1,
      outputs_json: '[]',
      inputs_json: '[]',
    },
  })
  showCreate.value = false
  newRecipe.value = { world_id: selectedWorld.value, recipe_id: '', name: '', description: '', skill_id: '', required_skill_level: 0, station_type: '' }
  await refresh()
}

async function deleteRecipe(r: RecipeRow) {
  if (!confirm(`Delete recipe '${r.recipe_id}'?`)) return
  const key = `${r.world_id}::${r.recipe_id}`
  await $fetch(`/api/tables/world_recipes/${encodeURIComponent(key)}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-semibold font-mono">Recipes</h2>
        <p class="text-neutral-400 text-sm mt-1">Crafting recipes. Players auto-learn at required skill level, or via quest/NPC grant.</p>
      </div>
      <div class="flex items-center gap-2">
        <select v-model="selectedWorld" class="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono">
          <option v-for="w in worldsData?.rows" :key="w.id" :value="w.id">{{ w.id }}</option>
        </select>
        <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm" @click="showCreate = true">+ New recipe</button>
      </div>
    </div>

    <div class="overflow-x-auto rounded border border-neutral-800">
      <table class="w-full text-sm">
        <thead class="bg-neutral-900 text-left">
          <tr>
            <th class="px-3 py-2">recipe_id</th>
            <th class="px-3 py-2">name</th>
            <th class="px-3 py-2">skill</th>
            <th class="px-3 py-2">station</th>
            <th class="px-3 py-2 w-20">lvl</th>
            <th class="px-3 py-2 w-20">time</th>
            <th class="px-3 py-2 w-20">xp</th>
            <th class="px-3 py-2 w-20">auto</th>
            <th class="px-3 py-2 w-32"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in filtered" :key="`${r.world_id}-${r.recipe_id}`" class="hover:bg-neutral-900/60">
            <td class="px-3 py-2 font-mono">{{ r.recipe_id }}</td>
            <td class="px-3 py-2">{{ r.name }}</td>
            <td class="px-3 py-2 font-mono text-xs text-neutral-400">{{ r.skill_id ?? '—' }}</td>
            <td class="px-3 py-2 font-mono text-xs text-neutral-400">{{ r.station_type ?? '—' }}</td>
            <td class="px-3 py-2">{{ r.required_skill_level }}</td>
            <td class="px-3 py-2">{{ r.craft_time_seconds }}s</td>
            <td class="px-3 py-2">{{ r.experience_gain }}</td>
            <td class="px-3 py-2">{{ r.is_auto_learned ? 'yes' : 'no' }}</td>
            <td class="px-3 py-2 text-right">
              <NuxtLink :to="`/admin/recipes/${encodeURIComponent(r.world_id + '::' + r.recipe_id)}`" class="text-sky-400 hover:underline mr-3 text-sm">edit</NuxtLink>
              <button class="text-red-400 hover:underline text-sm" @click="deleteRecipe(r)">delete</button>
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="9" class="px-3 py-6 text-center text-neutral-500">No recipes in this world.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showCreate" class="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" @click.self="showCreate = false">
      <div class="bg-neutral-900 border border-neutral-700 rounded p-6 w-full max-w-lg">
        <h3 class="text-lg font-semibold mb-3">New recipe</h3>
        <div class="space-y-3">
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">recipe_id (slug)</span>
            <input v-model="newRecipe.recipe_id" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono" placeholder="iron_sword" />
          </label>
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">name</span>
            <input v-model="newRecipe.name" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" placeholder="Iron Sword" />
          </label>
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">description</span>
            <textarea v-model="newRecipe.description" rows="2" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="text-sm">
              <span class="block text-neutral-400 mb-1">skill_id</span>
              <input v-model="newRecipe.skill_id" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
            </label>
            <label class="text-sm">
              <span class="block text-neutral-400 mb-1">required skill level</span>
              <input v-model.number="newRecipe.required_skill_level" type="number" min="0" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
            </label>
            <label class="text-sm col-span-2">
              <span class="block text-neutral-400 mb-1">station_type (forge / alchemy_lab / campfire / any)</span>
              <input v-model="newRecipe.station_type" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
            </label>
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <button class="px-3 py-1.5 rounded hover:bg-neutral-800 text-sm" @click="showCreate = false">Cancel</button>
          <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm" @click="createRecipe">Create</button>
        </div>
      </div>
    </div>
  </div>
</template>
