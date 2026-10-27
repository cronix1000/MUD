<script setup lang="ts">
const emit = defineEmits<{ created: [id: string] }>()

const mode = ref<'node' | 'voice'>('node')
const id = ref('')
const text = ref('')

const creating = ref(false)
const error = ref<string | null>(null)

async function create() {
  const trimmedId = id.value.trim()
  if (!trimmedId) {
    error.value = 'id is required'
    return
  }
  creating.value = true
  error.value = null
  try {
    const doc = mode.value === 'node'
      ? { text: text.value.trim(), options: [] }
      : { idle: [], combat: [], death: [] }
    await $fetch('/api/entities/dialogue', {
      method: 'POST',
      body: { id: trimmedId, doc },
    })
    emit('created', trimmedId)
    await navigateTo(`/entities/dialogue/${encodeURIComponent(trimmedId)}`)
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
    <h3 class="text-sm font-semibold">New dialogue</h3>
    <div class="flex gap-2 text-sm">
      <button
        class="px-3 py-1 rounded border text-sm"
        :class="mode === 'node' ? 'border-emerald-600 bg-emerald-900/40 text-emerald-200' : 'border-neutral-700 hover:bg-neutral-800'"
        @click="mode = 'node'"
      >Dialogue node</button>
      <button
        class="px-3 py-1 rounded border text-sm"
        :class="mode === 'voice' ? 'border-emerald-600 bg-emerald-900/40 text-emerald-200' : 'border-neutral-700 hover:bg-neutral-800'"
        @click="mode = 'voice'"
      >Voice set</button>
    </div>
    <p class="text-xs text-neutral-500">
      <template v-if="mode === 'node'">A node is one NPC speech with player options linking to other nodes (or EXIT). Trees are built node by node.</template>
      <template v-else>A voice set is a bag of random idle/combat/death barks for mobs.</template>
    </p>
    <div class="grid grid-cols-2 gap-3">
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">node_id / voice_set_id</span>
        <input v-model="id" :placeholder="mode === 'node' ? 'blacksmith_root' : 'goblin_barks'" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" @keydown.enter="create" />
      </label>
      <label v-if="mode === 'node'" class="text-sm">
        <span class="block text-neutral-400 mb-1">opening text</span>
        <input v-model="text" placeholder="Welcome to my forge, traveler." class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" @keydown.enter="create" />
      </label>
      <div class="flex items-end">
        <button
          class="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50 w-full"
          :disabled="creating || !id.trim()"
          @click="create"
        >
          {{ creating ? 'Creating…' : 'Create dialogue' }}
        </button>
      </div>
    </div>
    <p v-if="error" class="text-xs text-red-300">{{ error }}</p>
  </div>
</template>
