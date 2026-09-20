<script setup lang="ts">
interface Applied { version: number; name: string; applied_at: number; note: string | null }
interface Pending { version: number; name: string; sql: string[] }
interface Backup { path: string; mtime: number; size: number }

definePageMeta({ layout: 'admin' })

const { data, refresh } = await useFetch<{ applied: Applied[]; pending: Pending[]; backups: Backup[] }>(
  '/api/migrate/status',
)

const running = ref(false)
const lastResult = ref<null | { backup: string | null; results: Array<{ version: number; name: string; ok: boolean; error?: string }> }>(null)
const error = ref<string | null>(null)

async function runPending() {
  running.value = true
  error.value = null
  try {
    lastResult.value = await $fetch('/api/migrate/run', { method: 'POST', body: { backup: true } })
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string }
    error.value = err?.data?.statusMessage ?? err?.statusMessage ?? 'Run failed'
  } finally {
    running.value = false
  }
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function fmtTs(ms: number) {
  return new Date(ms).toLocaleString()
}
</script>

<template>
  <div class="max-w-4xl space-y-6">
    <div>
      <h2 class="text-2xl font-semibold font-mono">Migrations</h2>
      <p class="text-neutral-400 text-sm mt-1">
        Manual database migrations. A <code>pg_dump</code> backup of <code>MUD_DATABASE_URL</code> is created automatically before any pending migration runs.
        Click <strong>Run pending</strong> to apply.
      </p>
    </div>

    <div v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">
      {{ error }}
    </div>

    <div v-if="lastResult" class="bg-neutral-900 border border-neutral-700 rounded p-4">
      <h3 class="font-semibold mb-2">Last run</h3>
      <div v-if="lastResult.backup" class="text-sm text-neutral-400 mb-2">
        Backup: <code>{{ lastResult.backup }}</code>
      </div>
      <ul class="space-y-1 text-sm">
        <li v-for="r in lastResult.results" :key="r.version" class="font-mono">
          <span :class="r.ok ? 'text-emerald-400' : 'text-red-400'">
            [{{ r.ok ? 'OK' : 'ERR' }}]
          </span>
          #{{ r.version }} {{ r.name }}
          <span v-if="r.error" class="text-red-300"> — {{ r.error }}</span>
        </li>
      </ul>
    </div>

    <section>
      <h3 class="text-sm uppercase tracking-wide text-neutral-500 mb-2">Pending ({{ data?.pending.length ?? 0 }})</h3>
      <div v-if="!data?.pending.length" class="text-neutral-500 text-sm">No pending migrations.</div>
      <ul v-else class="space-y-2">
        <li
          v-for="p in data?.pending"
          :key="p.version"
          class="bg-neutral-900 border border-neutral-800 rounded p-3"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="font-mono text-sm">
              <span class="text-neutral-500">#{{ p.version }}</span> {{ p.name }}
            </div>
          </div>
          <pre class="text-xs text-neutral-300 bg-neutral-950 p-2 rounded overflow-x-auto">{{ p.sql.join('\n') }}</pre>
        </li>
      </ul>
      <button
        v-if="data?.pending.length"
        class="mt-3 px-4 py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50"
        :disabled="running"
        @click="runPending"
      >
        {{ running ? 'Running…' : `Run ${data?.pending.length} pending (with backup)` }}
      </button>
    </section>

    <section>
      <h3 class="text-sm uppercase tracking-wide text-neutral-500 mb-2">Applied ({{ data?.applied.length ?? 0 }})</h3>
      <table class="w-full text-sm">
        <thead class="text-left text-neutral-500">
          <tr>
            <th class="px-2 py-1">Version</th>
            <th class="px-2 py-1">Name</th>
            <th class="px-2 py-1">Applied</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in data?.applied" :key="a.version" class="font-mono border-t border-neutral-800">
            <td class="px-2 py-1">{{ a.version }}</td>
            <td class="px-2 py-1">{{ a.name }}</td>
            <td class="px-2 py-1 text-neutral-400">{{ fmtTs(a.applied_at) }}</td>
          </tr>
          <tr v-if="!data?.applied.length">
            <td colspan="3" class="px-2 py-3 text-center text-neutral-500">None applied yet.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section>
      <h3 class="text-sm uppercase tracking-wide text-neutral-500 mb-2">Backups ({{ data?.backups.length ?? 0 }})</h3>
      <div v-if="!data?.backups.length" class="text-neutral-500 text-sm">No backups on disk.</div>
      <table v-else class="w-full text-sm">
        <thead class="text-left text-neutral-500">
          <tr>
            <th class="px-2 py-1">File</th>
            <th class="px-2 py-1">Modified</th>
            <th class="px-2 py-1">Size</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in data?.backups" :key="b.path" class="font-mono border-t border-neutral-800">
            <td class="px-2 py-1 truncate max-w-md" :title="b.path">{{ b.path }}</td>
            <td class="px-2 py-1 text-neutral-400">{{ fmtTs(b.mtime) }}</td>
            <td class="px-2 py-1 text-neutral-400">{{ fmtBytes(b.size) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
