<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface Region {
  id: string
  name: string
  description: string | null
  region_kind: string | null
}

const { data: regionsData, refresh } = await useFetch<{ rows: Region[] }>('/api/tables/world_regions')

function kindColor(kind: string | null): string {
  switch (kind) {
    case 'instanced': return 'text-purple-300 bg-purple-900/30'
    case 'tutorial': return 'text-amber-300 bg-amber-900/30'
    case 'static':
    default: return 'text-neutral-400 bg-neutral-800'
  }
}

const showCreate = ref(false)
const newRegion = ref({ id: '', name: '', description: '' })
const creating = ref(false)
const error = ref<string | null>(null)

async function createRegion() {
  if (!newRegion.value.id || !newRegion.value.name) return
  creating.value = true
  error.value = null
  try {
    await $fetch('/api/tables/world_regions', {
      method: 'POST',
      body: {
        id: newRegion.value.id,
        name: newRegion.value.name,
        description: newRegion.value.description || null,
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
        <p class="text-neutral-400 text-sm mt-1">
          Pick a region to open its map or edit its kind (static / instanced / tutorial).
        </p>
      </div>
      <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm" @click="showCreate = true">+ New region</button>
    </div>

    <div v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ error }}</div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

      <div
      v-for="r in regionsData?.rows"
      :key="r.id"
      class="block p-4 rounded border border-neutral-800 hover:border-neutral-600 bg-neutral-900"
      >
      <NuxtLink
      :to="`/admin/world/regions/${encodeURIComponent(r.id)}`"
      class="font-mono text-sm hover:underline"
      >{{ r.id }}</NuxtLink>
      <div class="flex items-start justify-between">
        <span :class="['text-xs px-1.5 py-0.5 rounded font-mono', kindColor(r.region_kind)]">
          {{ r.region_kind ?? 'static' }}
        </span>
      </div>
      <NuxtLink
          :to="`/admin/world/regions/${encodeURIComponent(r.id)}/map`"
          class="text-sky-400 hover:underline"
        >
        <div class="text-neutral-400 text-xs mt-1">&nbsp;</div>
      </NuxtLink>
        <div v-if="r.description" class="text-neutral-300 text-sm mt-2">{{ r.description }}</div>
        <div class="mt-3 flex gap-2 text-xs">
          <NuxtLink
            :to="`/admin/world/regions/${encodeURIComponent(r.id)}/map`"
            class="text-sky-400 hover:underline"
          >map</NuxtLink>
          <span class="text-neutral-700">·</span>
          <NuxtLink
            :to="`/admin/world/regions/${encodeURIComponent(r.id)}`"
            class="text-sky-400 hover:underline"
          >edit kind</NuxtLink>
        </div>
      </div>
      <div v-if="!regionsData?.rows.length" class="text-neutral-500 col-span-full">
        No regions yet.
      </div>
    </div>

    <div v-if="showCreate" class="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" @click.self="showCreate = false">
      <form class="bg-neutral-900 border border-neutral-700 rounded p-6 w-full max-w-lg" @submit.prevent="createRegion">
        <h3 class="text-lg font-semibold mb-3">New region</h3>
        <div class="space-y-3">
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">id (slug, e.g. floor1)</span>
            <input v-model="newRegion.id" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono" placeholder="floor1" />
          </label>
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">name</span>
            <input v-model="newRegion.name" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" placeholder="Floor 1 — Dungeon" />
          </label>
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">description</span>
            <textarea v-model="newRegion.description" rows="2" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" />
          </label>
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="px-3 py-1.5 rounded hover:bg-neutral-800 text-sm" @click="showCreate = false">Cancel</button>
          <button type="submit" class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50" :disabled="creating">
            {{ creating ? 'Creating…' : 'Create' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>