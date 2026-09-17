<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface Snapshot { path: string; mtime: number; size: number }

const { data, refresh } = await useFetch<{ snapshots: Snapshot[] }>('/api/snapshots/list')

const creating = ref(false)
const restoring = ref<string | null>(null)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

async function createSnapshot() {
  creating.value = true
  error.value = null
  success.value = null
  try {
    const res = await $fetch<{ path: string; created: boolean }>('/api/snapshots/create', { method: 'POST' })
    success.value = `Snapshot created: ${res.path}`
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Create failed'
  } finally {
    creating.value = false
  }
}

async function restore(s: Snapshot) {
  if (!confirm(`Restore ${s.path.split(/[\\/]/).pop()}?\n\nThis will overwrite the current mud.db. A safety backup is created first.`)) return
  restoring.value = s.path
  error.value = null
  success.value = null
  try {
    const res = await $fetch<{ restored: string; safety_backup: string }>('/api/snapshots/restore', {
      method: 'POST',
      body: { path: s.path },
    })
    success.value = `Restored. Safety backup: ${res.safety_backup.split(/[\\/]/).pop()}`
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Restore failed'
  } finally {
    restoring.value = null
  }
}

async function deleteSnap(s: Snapshot) {
  if (!confirm(`Delete snapshot ${s.path.split(/[\\/]/).pop()}?`)) return
  try {
    await $fetch('/api/snapshots/delete', { method: 'POST', body: { path: s.path } })
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Delete failed'
  }
}

function fmtTs(ms: number) { return new Date(ms).toLocaleString() }
function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}
</script>

<template>
  <div class="space-y-4 max-w-4xl">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-semibold">Snapshots</h2>
        <p class="text-neutral-400 text-sm mt-1">
          Point-in-time copies of <code>mud.db</code>. Restore replaces the live DB and creates a safety backup first.
        </p>
      </div>
      <button
        class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50"
        :disabled="creating"
        @click="createSnapshot"
      >
        {{ creating ? 'Creating…' : '+ Create snapshot' }}
      </button>
    </div>

    <div v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ error }}</div>
    <div v-if="success" class="bg-emerald-900/40 border border-emerald-700 rounded px-3 py-2 text-sm text-emerald-200">{{ success }}</div>

    <div class="bg-neutral-900 border border-neutral-800 rounded">
      <table class="w-full text-sm">
        <thead class="bg-neutral-900 text-left text-neutral-500">
          <tr>
            <th class="px-3 py-2 font-medium border-b border-neutral-800">File</th>
            <th class="px-3 py-2 font-medium border-b border-neutral-800 w-48">Modified</th>
            <th class="px-3 py-2 font-medium border-b border-neutral-800 w-24">Size</th>
            <th class="px-3 py-2 border-b border-neutral-800 w-48"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in data?.snapshots ?? []" :key="s.path" class="hover:bg-neutral-900/60">
            <td class="px-3 py-2 border-b border-neutral-900 font-mono text-xs">{{ s.path.split(/[\\/]/).pop() }}</td>
            <td class="px-3 py-2 border-b border-neutral-900 text-neutral-400">{{ fmtTs(s.mtime) }}</td>
            <td class="px-3 py-2 border-b border-neutral-900 text-neutral-400">{{ fmtBytes(s.size) }}</td>
            <td class="px-3 py-2 border-b border-neutral-900 text-right">
              <button
                class="px-2 py-0.5 text-xs bg-amber-700 hover:bg-amber-600 rounded mr-2 disabled:opacity-50"
                :disabled="restoring === s.path"
                @click="restore(s)"
              >{{ restoring === s.path ? 'restoring…' : 'restore' }}</button>
              <button class="text-red-400 hover:underline text-xs" @click="deleteSnap(s)">delete</button>
            </td>
          </tr>
          <tr v-if="!(data?.snapshots ?? []).length">
            <td colspan="4" class="px-3 py-6 text-center text-neutral-500">No snapshots yet. Click "Create snapshot" to make one.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
