<script setup lang="ts">
const emit = defineEmits<{ created: [id: string] }>()

const { data: itemsData } = await useFetch<{
  rows: Array<{ entity_id: string; doc: { name?: string } }>
}>('/api/entities/item', { query: { limit: 500 } })

const id = ref('')
const name = ref('')
const parentId = ref('')
const type = ref('')
const char = ref('?')
const value = ref(0)
const weight = ref(1)
const equippable = ref(false)

const creating = ref(false)
const error = ref<string | null>(null)

const usingParent = computed(() => parentId.value !== '')

const TYPE_SUGGESTIONS = ['weapon', 'armour', 'consumable', 'misc']

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
          char: char.value || '?',
          type: type.value || 'misc',
          value: Number(value.value) || 0,
          weight: Number(weight.value) || 1,
          equippable: equippable.value === true,
        }
    await $fetch('/api/entities/item', {
      method: 'POST',
      body: { id: trimmedId, doc, parent_id: parentId.value || null },
    })
    emit('created', trimmedId)
    await navigateTo(`/entities/item/${encodeURIComponent(trimmedId)}`)
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
    <h3 class="text-sm font-semibold">New item</h3>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">template_id</span>
        <input v-model="id" placeholder="iron_sword" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" @keydown.enter="create" />
      </label>
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">name</span>
        <input v-model="name" placeholder="Iron Sword" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" @keydown.enter="create" />
      </label>
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">inherits from</span>
        <select v-model="parentId" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm">
          <option value="">— none (full form) —</option>
          <option v-for="i in itemsData?.rows ?? []" :key="i.entity_id" :value="i.entity_id">{{ i.entity_id }}{{ i.doc.name ? ' — ' + i.doc.name : '' }}</option>
        </select>
      </label>
      <div class="flex items-end">
        <button
          class="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50 w-full"
          :disabled="creating || !id.trim() || !name.trim()"
          @click="create"
        >
          {{ creating ? 'Creating…' : 'Create item' }}
        </button>
      </div>
    </div>
    <p v-if="usingParent" class="text-xs text-neutral-500">Only the name is written; every other field is inherited from {{ parentId }} and can be overridden after creation.</p>
    <div v-else class="grid grid-cols-2 md:grid-cols-5 gap-3">
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">type</span>
        <input v-model="type" list="item-create-types" placeholder="misc" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
        <datalist id="item-create-types">
          <option v-for="t in TYPE_SUGGESTIONS" :key="t" :value="t" />
        </datalist>
      </label>
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">char</span>
        <input v-model="char" maxlength="1" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-center text-sm" />
      </label>
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">value</span>
        <input v-model.number="value" type="number" min="0" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" />
      </label>
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">weight</span>
        <input v-model.number="weight" type="number" min="0" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" />
      </label>
      <label class="text-sm flex items-end gap-2 pb-1">
        <input v-model="equippable" type="checkbox" />
        <span>equippable</span>
      </label>
    </div>
    <p v-if="error" class="text-xs text-red-300">{{ error }}</p>
  </div>
</template>
