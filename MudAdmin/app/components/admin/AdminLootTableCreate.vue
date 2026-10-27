<script setup lang="ts">
const emit = defineEmits<{ created: [id: string] }>()

const id = ref('')
const name = ref('')

const creating = ref(false)
const error = ref<string | null>(null)

async function create() {
  const trimmedId = id.value.trim()
  if (!trimmedId || !name.value.trim()) {
    error.value = 'id and name are required'
    return
  }
  creating.value = true
  error.value = null
  try {
    await $fetch('/api/entities/loot_table', {
      method: 'POST',
      body: {
        id: trimmedId,
        doc: { name: name.value.trim(), entries: [] },
      },
    })
    emit('created', trimmedId)
    await navigateTo(`/entities/loot_table/${encodeURIComponent(trimmedId)}`)
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
    <h3 class="text-sm font-semibold">New loot table</h3>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">table_id</span>
        <input v-model="id" placeholder="goblin_common" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" @keydown.enter="create" />
      </label>
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">name</span>
        <input v-model="name" placeholder="Goblin common drops" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" @keydown.enter="create" />
      </label>
      <div class="flex items-end">
        <button
          class="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50 w-full"
          :disabled="creating || !id.trim() || !name.trim()"
          @click="create"
        >
          {{ creating ? 'Creating…' : 'Create table' }}
        </button>
      </div>
    </div>
    <p class="text-xs text-neutral-500">Starts with an empty entry list — add weighted item entries right after.</p>
    <p v-if="error" class="text-xs text-red-300">{{ error }}</p>
  </div>
</template>
