<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface RegionCard {
  id: string
  name: string
  description: string
}

const { data: regionsData, refresh } = await useFetch<{ rows: Array<{ entity_id: string; doc: Record<string, unknown> }> }>(
  '/api/entities/region',
  { query: { limit: 500 } },
)

const regions = computed<RegionCard[]>(() =>
  (regionsData.value?.rows ?? []).map((r) => ({
    id: r.entity_id,
    name: String(r.doc.name ?? ''),
    description: String(r.doc.description ?? ''),
  })),
)

const showCreate = ref(false)
const newRegion = ref({ id: '', name: '', description: '' })
const creating = ref(false)
const error = ref<string | null>(null)

async function createRegion() {
  if (!newRegion.value.id.trim() || !newRegion.value.name.trim()) return
  creating.value = true
  error.value = null
  try {
    await $fetch('/api/entities/region', {
      method: 'POST',
      body: {
        id: newRegion.value.id.trim(),
        doc: {
          name: newRegion.value.name.trim(),
          description: newRegion.value.description || '',
        },
      },
    })
    showCreate.value = false
    newRegion.value = { id: '', name: '', description: '' }
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Create failed'
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-semibold font-mono">Regions</h2>
      </div>
      <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm" @click="showCreate = !showCreate">
        {{ showCreate ? 'Cancel' : '+ New region' }}
      </button>
    </div>

    <div v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ error }}</div>

    <div v-if="showCreate" class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3">
      <h3 class="text-sm font-semibold">New region</h3>
      <div class="grid grid-cols-3 gap-3">
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">id (slug, e.g. floor1)</span>
          <input v-model="newRegion.id" placeholder="floor1" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" @keydown.enter="createRegion" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">name</span>
          <input v-model="newRegion.name" placeholder="Floor 1 — Dungeon" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" @keydown.enter="createRegion" />
        </label>
        <div class="flex items-end">
          <button
            class="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50 w-full"
            :disabled="creating || !newRegion.id.trim() || !newRegion.name.trim()"
            @click="createRegion"
          >
            {{ creating ? 'Creating…' : 'Create region' }}
          </button>
        </div>
      </div>
      <label class="block text-sm">
        <span class="block text-neutral-400 mb-1">description</span>
        <textarea v-model="newRegion.description" rows="2" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" />
      </label>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <div
        v-for="r in regions"
        :key="r.id"
        class="block p-4 rounded border border-neutral-800 hover:border-neutral-600 bg-neutral-900"
      >
        <NuxtLink
          :to="`/world/regions/${encodeURIComponent(r.id)}`"
          class="font-mono text-sm hover:underline"
        >{{ r.id }}</NuxtLink>
        <div v-if="r.name" class="text-neutral-200 text-sm mt-1">{{ r.name }}</div>
        <div v-if="r.description" class="text-neutral-400 text-sm mt-2">{{ r.description }}</div>
        <div class="mt-3 flex gap-2 text-xs">
          <NuxtLink
            :to="`/world/regions/${encodeURIComponent(r.id)}/map`"
            class="text-sky-400 hover:underline"
          >map</NuxtLink>
          <span class="text-neutral-700">·</span>
          <NuxtLink
            :to="`/world/regions/${encodeURIComponent(r.id)}`"
            class="text-sky-400 hover:underline"
          >edit</NuxtLink>
        </div>
      </div>
      <div v-if="!regions.length" class="text-neutral-500 col-span-full">
        No regions yet.
      </div>
    </div>
  </div>
</template>
