<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface Entry { cmd: string; output: string; ok: boolean; at: number }

const { data: status } = await useFetch<{ enabled: boolean }>('/api/console/status')
const enabled = computed(() => status.value?.enabled ?? false)

const TOKEN_KEY = 'mud_admin_console_token'

const token = ref('')
const tokenInput = ref('')
const tokenError = ref('')
const showToken = ref(false)
const authed = ref(false)
const checking = ref(false)

const entries = ref<Entry[]>([])
const input = ref('')
const busy = ref(false)
const restarting = ref(false)
const history = ref<string[]>([])
const historyIndex = ref(-1)
const outputEl = ref<HTMLElement | null>(null)
const confirmRef = ref<{ ask: (opts: { title: string; body?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean> } | null>(null)
const toast = useToast()

onMounted(() => {
  const saved = localStorage.getItem(TOKEN_KEY)
  if (saved) {
    tokenInput.value = saved
    void connect(saved)
  }
})

watch(() => entries.value.length, async () => {
  await nextTick()
  if (outputEl.value) outputEl.value.scrollTop = outputEl.value.scrollHeight
})

function headersFor(t: string) {
  return { 'x-admin-token': t }
}

async function connect(t: string) {
  checking.value = true
  tokenError.value = ''
  try {
    const res = await $fetch<{ output: string }>('/api/console/run', {
      method: 'POST',
      body: { command: 'help' },
      headers: headersFor(t),
    })
    token.value = t
    localStorage.setItem(TOKEN_KEY, t)
    authed.value = true
    entries.value.push({ cmd: '', output: res.output, ok: true, at: Date.now() })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    tokenError.value = err.data?.statusMessage ?? 'Could not reach the server console'
    localStorage.removeItem(TOKEN_KEY)
    if (t === token.value) token.value = ''
  } finally {
    checking.value = false
  }
}

async function run(cmd: string): Promise<string | null> {
  busy.value = true
  entries.value.push({ cmd, output: '', ok: true, at: Date.now() })
  const entry = entries.value[entries.value.length - 1]
  try {
    const res = await $fetch<{ output: string }>('/api/console/run', {
      method: 'POST',
      body: { command: cmd },
      headers: headersFor(token.value),
    })
    entry.output = res.output
    return res.output
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    entry.output = err.data?.statusMessage ?? 'Command failed'
    entry.ok = false
    return null
  } finally {
    busy.value = false
  }
}

async function ping(): Promise<string | null> {
  try {
    const res = await $fetch<{ output: string }>('/api/console/run', {
      method: 'POST',
      body: { command: 'status' },
      headers: headersFor(token.value),
    })
    return res.output
  } catch {
    return null
  }
}

async function submit() {
  const cmd = input.value.trim()
  if (!cmd || busy.value) return
  input.value = ''
  history.value = [...history.value.filter((h) => h !== cmd), cmd]
  historyIndex.value = -1
  await run(cmd)
}

function historyPrev() {
  if (!history.value.length) return
  if (historyIndex.value === -1) historyIndex.value = history.value.length
  historyIndex.value = Math.max(0, historyIndex.value - 1)
  input.value = history.value[historyIndex.value] ?? ''
}

function historyNext() {
  if (historyIndex.value === -1) return
  historyIndex.value += 1
  if (historyIndex.value >= history.value.length) {
    historyIndex.value = -1
    input.value = ''
  } else {
    input.value = history.value[historyIndex.value] ?? ''
  }
}

async function restart() {
  const ok = await confirmRef.value?.ask({
    title: 'Restart the MUD server?',
    body: 'All players are saved, then the process exits and the container comes back up with fresh world data (~15-30s).\n\nConnected players will be disconnected.',
    confirmLabel: 'Restart',
    danger: true,
  })
  if (!ok) return
  restarting.value = true
  try {
    const res = await $fetch<{ output: string }>('/api/console/restart', {
      method: 'POST',
      headers: headersFor(token.value),
    })
    entries.value.push({ cmd: 'restart', output: res.output, ok: true, at: Date.now() })
    toast.info('Server restarting — waiting for it to come back…')
    await waitForServer(0)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    toast.error(err.data?.statusMessage ?? 'Restart failed')
    restarting.value = false
  }
}

async function waitForServer(attempt: number) {
  if (attempt >= 24) {
    toast.error('Server did not come back within 2 minutes — check the mud-server container logs.')
    restarting.value = false
    return
  }
  await new Promise((resolve) => setTimeout(resolve, 5000))
  const out = await ping()
  if (out === null) {
    await waitForServer(attempt + 1)
    return
  }
  entries.value.push({ cmd: 'status', output: out, ok: true, at: Date.now() })
  toast.success('Server is back up.')
  restarting.value = false
}

function fmtTime(at: number) {
  return new Date(at).toLocaleTimeString()
}
</script>

<template>
  <div class="space-y-4 max-w-4xl">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-2xl font-semibold">Server console</h2>
        <p class="text-neutral-400 text-sm mt-1">
          Run commands on the live MUD server with Admin permission. Type <code>help</code> for the built-in verbs;
          <code>as &lt;player&gt; &lt;command&gt;</code> runs a command as an online player.
        </p>
      </div>
      <UiButton variant="danger" :loading="restarting" :disabled="!authed" @click="restart">
        {{ restarting ? 'Restarting…' : 'Restart server' }}
      </UiButton>
    </div>

    <div v-if="!enabled" class="bg-amber-900/40 border border-amber-700 rounded px-3 py-2 text-sm text-amber-200">
      Console is disabled. Set <code>MUD_ADMIN_TOKEN</code> in <code>docker/.env</code> (it configures both mud-server and mud-admin),
      then recreate both containers. Locally, set it in the server's debugger environment and <code>MudAdmin/.env</code>.
    </div>

    <div v-else-if="!authed" class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3 max-w-md">
      <h3 class="text-sm font-semibold text-neutral-200">Admin token required</h3>
      <p class="text-xs text-neutral-400">Enter the value of <code>MUD_ADMIN_TOKEN</code> (see <code>docker/.env</code> / <code>docker exec mud-admin printenv MUD_ADMIN_TOKEN</code>). It is kept in this browser only.</p>
      <form class="flex gap-2" @submit.prevent="connect(tokenInput)">
        <input
          v-model="tokenInput"
          :type="showToken ? 'text' : 'password'"
          placeholder="MUD_ADMIN_TOKEN"
          spellcheck="false"
          autocomplete="off"
          class="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-emerald-600"
        >
        <UiButton size="sm" @click="showToken = !showToken">{{ showToken ? 'Hide' : 'Show' }}</UiButton>
        <UiButton variant="primary" type="submit" :loading="checking">Connect</UiButton>
      </form>
      <div v-if="tokenError" class="text-sm text-red-300">{{ tokenError }}</div>
    </div>

    <template v-else>
      <UiPanel title="Terminal" :collapsible="false">
        <template #actions>
          <span class="text-xs" :class="restarting ? 'text-amber-300 animate-pulse' : 'text-emerald-400'">
            {{ restarting ? 'server restarting' : 'connected' }}
          </span>
        </template>
        <div
          ref="outputEl"
          class="h-[60vh] overflow-y-auto bg-neutral-950 border border-neutral-800 rounded p-3 font-mono text-xs leading-5 whitespace-pre-wrap break-words"
        >
          <div v-for="(entry, i) in entries" :key="i" class="mb-2">
            <div v-if="entry.cmd" class="text-emerald-400"><span class="text-neutral-600">{{ fmtTime(entry.at) }} </span>&gt; {{ entry.cmd }}</div>
            <div v-else class="text-neutral-600">— console session started {{ fmtTime(entry.at) }} —</div>
            <div :class="entry.ok ? 'text-neutral-300' : 'text-red-300'">{{ entry.output }}</div>
          </div>
        </div>
        <div class="mt-3 flex items-center gap-2">
          <span class="font-mono text-sm text-emerald-400">&gt;</span>
          <input
            v-model="input"
            type="text"
            spellcheck="false"
            autocomplete="off"
            placeholder="type a command… (↑/↓ for history)"
            class="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 font-mono text-sm focus:outline-none focus:border-emerald-600"
            :disabled="busy || restarting"
            @keydown.up.prevent="historyPrev"
            @keydown.down.prevent="historyNext"
            @keydown.enter="submit"
          >
          <UiButton variant="primary" :loading="busy" :disabled="restarting" @click="submit">Run</UiButton>
        </div>
      </UiPanel>
    </template>

    <UiConfirmDialog ref="confirmRef" />
  </div>
</template>
