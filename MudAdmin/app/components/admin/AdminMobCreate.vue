<script setup lang="ts">
const emit = defineEmits<{ created: [id: string] }>()

const { data: mobsData } = await useFetch<{
  rows: Array<{ entity_id: string; doc: { name?: string } }>
}>('/api/entities/mob', { query: { limit: 500 } })

const id = ref('')
const name = ref('')
const parentId = ref('')
const char = ref('M')
const hp = ref(100)
const level = ref(1)
const ai = ref('none')

const creating = ref(false)
const error = ref<string | null>(null)

const usingParent = computed(() => parentId.value !== '')

async function create() {
  const trimmedId = id.value.trim()
  if (!trimmedId || !name.value.trim()) {
    error.value = 'id and name are required'
    return
  }
  creating.value = true
  error.value = null
  try {
    const doc = usingParent.value
      ? { name: name.value.trim() }
      : {
          name: name.value.trim(),
          char: char.value || 'M',
          hp: Number(hp.value) || 100,
          level: Number(level.value) || 1,
          ai: ai.value || 'none',
          attack_damage: 0,
          attack_speed: 0,
          critical_chance: 0,
          critical_multiplier: 1.5,
          stat: { strength: 0, dexterity: 0, intelligence: 0 },
        }
    await $fetch('/api/entities/mob', {
      method: 'POST',
      body: { id: trimmedId, doc, parent_id: parentId.value || null },
    })
    emit('created', trimmedId)
    await navigateTo(`/entities/mob/${encodeURIComponent(trimmedId)}`)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Create failed'
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3">
    <h3 class="text-sm font-semibold">New mob</h3>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">template_id</span>
        <input v-model="id" placeholder="goblin" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" @keydown.enter="create" />
      </label>
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">name</span>
        <input v-model="name" placeholder="Goblin" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" @keydown.enter="create" />
      </label>
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">inherits from</span>
        <select v-model="parentId" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm">
          <option value="">— none (full form) —</option>
          <option v-for="m in mobsData?.rows ?? []" :key="m.entity_id" :value="m.entity_id">{{ m.entity_id }}{{ m.doc.name ? ' — ' + m.doc.name : '' }}</option>
        </select>
      </label>
      <div class="flex items-end">
        <button
          class="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50 w-full"
          :disabled="creating || !id.trim() || !name.trim()"
          @click="create"
        >
          {{ creating ? 'Creating…' : 'Create mob' }}
        </button>
      </div>
    </div>
    <p v-if="usingParent" class="text-xs text-neutral-500">Only the name is written; every other field is inherited from {{ parentId }} and can be overridden after creation.</p>
    <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">char</span>
        <input v-model="char" maxlength="1" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-center text-sm" />
      </label>
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">hp</span>
        <input v-model.number="hp" type="number" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" />
      </label>
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">level</span>
        <input v-model.number="level" type="number" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" />
      </label>
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">ai</span>
        <input v-model="ai" placeholder="none" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
      </label>
    </div>
    <p v-if="error" class="text-xs text-red-300">{{ error }}</p>
  </div>
</template>
