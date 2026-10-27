<script setup lang="ts">
const emit = defineEmits<{ created: [id: string] }>()

const { data: rowsData } = await useFetch<{
  rows: Array<{ entity_id: string; doc: { name?: string } }>
}>('/api/entities/interactable', { query: { limit: 500 } })

const id = ref('')
const name = ref('')
const parentId = ref('')
const char = ref('O')
const stationType = ref('')

const creating = ref(false)
const error = ref<string | null>(null)

const usingParent = computed(() => parentId.value !== '')

const STATION_TYPE_VALUES = ['alchemy_circle', 'forge', 'anvil', 'enchanting_altar']

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
          char: char.value || 'O',
          description: '',
          color: '',
          station_type: stationType.value.trim(),
        }
    await $fetch('/api/entities/interactable', {
      method: 'POST',
      body: { id: trimmedId, doc, parent_id: parentId.value || null },
    })
    emit('created', trimmedId)
    await navigateTo(`/entities/interactable/${encodeURIComponent(trimmedId)}`)
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
    <h3 class="text-sm font-semibold">New interactable</h3>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">template_id</span>
        <input v-model="id" placeholder="alchemy_circle" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" @keydown.enter="create" />
      </label>
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">name</span>
        <input v-model="name" placeholder="Alchemy Circle" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" @keydown.enter="create" />
      </label>
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">inherits from</span>
        <select v-model="parentId" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm">
          <option value="">— none (full form) —</option>
          <option v-for="r in rowsData?.rows ?? []" :key="r.entity_id" :value="r.entity_id">{{ r.entity_id }}{{ r.doc.name ? ' — ' + r.doc.name : '' }}</option>
        </select>
      </label>
      <div class="flex items-end">
        <button
          class="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50 w-full"
          :disabled="creating || !id.trim() || !name.trim()"
          @click="create"
        >
          {{ creating ? 'Creating…' : 'Create interactable' }}
        </button>
      </div>
    </div>
    <p v-if="usingParent" class="text-xs text-neutral-500">Only the name is written; every other field is inherited from {{ parentId }} and can be overridden after creation.</p>
    <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">char</span>
        <input v-model="char" maxlength="1" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-center text-sm" />
      </label>
      <label class="text-sm col-span-2">
        <span class="block text-neutral-400 mb-1">station_type (optional crafting station tag)</span>
        <input v-model="stationType" list="interactable-create-stations" placeholder="forge" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
        <datalist id="interactable-create-stations">
          <option v-for="s in STATION_TYPE_VALUES" :key="s" :value="s" />
        </datalist>
      </label>
    </div>
    <p v-if="error" class="text-xs text-red-300">{{ error }}</p>
  </div>
</template>
