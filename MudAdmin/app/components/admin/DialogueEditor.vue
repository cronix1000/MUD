<script setup lang="ts">
import { resolveWikiId } from '~/utils/wikiId'
import type { EntityArrayColumn } from './EntityArrayField.vue'

const props = defineProps<{
  entityId: string
}>()
const emit = defineEmits<{ close: [] }>()

const { data, refresh } = await useFetch<{
  record: { entity_type: string; entity_id: string; doc: Record<string, unknown>; parent_id: string | null; updated_at: string }
}>(() => `/api/entities/dialogue/${encodeURIComponent(props.entityId)}`)

const currentDoc = ref<Record<string, unknown>>({})
const parentId = ref('')

watchEffect(() => {
  if (!data.value?.record) return
  currentDoc.value = data.value.record.doc
  parentId.value = data.value.record.parent_id ?? ''
})

const isNode = computed(() => currentDoc.value.text !== undefined)

const text = ref('')
const options = ref<Array<{ text: string; targetNode: string; luaCallback: string }>>([])

const idleText = ref('')
const combatText = ref('')
const deathText = ref('')

watchEffect(() => {
  const d = currentDoc.value
  text.value = String(d.text ?? '')
  const raw = Array.isArray(d.options) ? d.options : []
  options.value = raw.map((o) => {
    const opt = (o ?? {}) as Record<string, unknown>
    return {
      text: String(opt.text ?? ''),
      targetNode: String(opt.targetNode ?? ''),
      luaCallback: String(opt.luaCallback ?? ''),
    }
  })
  idleText.value = Array.isArray(d.idle) ? d.idle.map(String).join('\n') : ''
  combatText.value = Array.isArray(d.combat) ? d.combat.map(String).join('\n') : ''
  deathText.value = Array.isArray(d.death) ? d.death.map(String).join('\n') : ''
})

const columns: EntityArrayColumn[] = [
  { key: 'text', label: 'option text', widget: 'text', placeholder: 'What the player says' },
  { key: 'targetNode', label: 'target node', widget: 'wiki', placeholder: 'node id or EXIT' },
  { key: 'luaCallback', label: 'lua callback', widget: 'text', placeholder: 'optional' },
]

const { data: dialoguesData } = await useFetch<{
  rows: Array<{ entity_id: string; doc: Record<string, unknown> }>
}>('/api/entities/dialogue', { query: { limit: 500 } })

const linkingNodes = computed(() =>
  (dialoguesData.value?.rows ?? []).filter((r) => {
    if (r.entity_id === props.entityId) return false
    const opts = r.doc.options
    if (!Array.isArray(opts)) return false
    return opts.some((o) => String(((o ?? {}) as Record<string, unknown>).targetNode ?? '') === props.entityId)
  }),
)

const { data: mobsData } = await useFetch<{
  rows: Array<{ entity_id: string; doc: { name?: string; dialogue_root?: string } }>
}>('/api/entities/mob', { query: { limit: 500 } })

const linkingMobs = computed(() =>
  (mobsData.value?.rows ?? []).filter((m) => String(m.doc?.dialogue_root ?? '') === props.entityId),
)

const saving = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

const showRaw = ref(false)
const rawText = ref('')
const rawError = ref<string | null>(null)

function openRaw() {
  rawText.value = JSON.stringify(currentDoc.value, null, 2)
  rawError.value = null
  showRaw.value = true
}
function applyRaw() {
  try {
    const parsed = JSON.parse(rawText.value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('doc must be a JSON object')
    }
    currentDoc.value = parsed
    rawError.value = null
    showRaw.value = false
  } catch (e) {
    rawError.value = e instanceof Error ? e.message : 'Invalid JSON'
  }
}

function splitLines(raw: string): string[] {
  return raw.split('\n').map((l) => l.trim()).filter(Boolean)
}

async function save() {
  saving.value = true
  error.value = null
  success.value = null
  try {
    const next: Record<string, unknown> = { ...currentDoc.value }
    if (isNode.value) {
      next.text = text.value
      next.options = options.value.map((o) => {
        const opt: Record<string, unknown> = {
          text: o.text.trim() || 'Continue...',
          targetNode: resolveWikiId(o.targetNode).trim() || 'EXIT',
        }
        const cb = o.luaCallback.trim()
        if (cb) opt.luaCallback = cb
        return opt
      })
      delete next.idle
      delete next.combat
      delete next.death
    } else {
      delete next.text
      delete next.options
      next.idle = splitLines(idleText.value)
      next.combat = splitLines(combatText.value)
      next.death = splitLines(deathText.value)
    }

    await $fetch(`/api/entities/dialogue/${encodeURIComponent(props.entityId)}`, {
      method: 'PUT',
      body: { doc: next, parent_id: parentId.value.trim() || null },
    })
    success.value = 'Saved.'
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    error.value = err.data?.statusMessage ?? err.message ?? 'Save failed'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <button class="text-sky-400 hover:underline text-sm" @click="emit('close')">← back</button>
        <h2 class="text-xl font-semibold font-mono truncate">{{ props.entityId }} <span class="text-neutral-500 text-sm">({{ isNode ? 'dialogue node' : 'voice set' }})</span></h2>
      </div>
      <div class="flex items-center gap-2">
        <button class="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-sm" @click="openRaw">Raw JSON</button>
        <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50" :disabled="saving" @click="save">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ error }}</div>
    <div v-if="success" class="bg-emerald-900/40 border border-emerald-700 rounded px-3 py-2 text-sm text-emerald-200">{{ success }}</div>

    <div v-if="showRaw" class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">Raw document</h3>
        <div class="flex gap-2">
          <button class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded" @click="applyRaw">Apply</button>
          <button class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded" @click="showRaw = false">Cancel</button>
        </div>
      </div>
      <textarea v-model="rawText" rows="14" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"></textarea>
      <p v-if="rawError" class="text-xs text-red-300">{{ rawError }}</p>
    </div>

    <template v-if="isNode">
      <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
        <h3 class="text-sm font-semibold mb-2">Node text</h3>
        <AdminWikiText v-model="text" :rows="4" />
        <p class="mt-2 text-xs text-neutral-500">What the NPC says when this node opens. Mobs reach it via <span class="font-mono">dialogue_root</span> or another node's option.</p>
      </div>

      <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
        <h3 class="text-sm font-semibold mb-2">Options</h3>
        <p class="text-xs text-neutral-500 mb-3">Each row is <span class="font-mono">{ text, targetNode, luaCallback }</span>. <span class="font-mono">targetNode</span> is another dialogue node id or the literal <span class="font-mono">EXIT</span>. An empty list behaves as a single "Close → EXIT".</p>
        <AdminEntityArrayField
          :model-value="options"
          :columns="columns"
          add-label="+ Add option"
          empty-label="No options — the C++ factory adds a Close/EXIT fallback at load."
          @update:model-value="(v) => options = v as Array<{ text: string; targetNode: string; luaCallback: string }>"
        />
      </div>
    </template>

    <template v-else>
      <div class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3">
        <h3 class="text-sm font-semibold">Voice barks</h3>
        <p class="text-xs text-neutral-500">Random one-liners for mobs. One line per entry; blank lines are dropped.</p>
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">idle</span>
          <textarea v-model="idleText" rows="4" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" placeholder="The goblin scratches its ear." />
        </label>
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">combat</span>
          <textarea v-model="combatText" rows="4" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" placeholder="The goblin snarls!" />
        </label>
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">death</span>
          <textarea v-model="deathText" rows="4" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" placeholder="The goblin collapses." />
        </label>
      </div>
    </template>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">Advanced</h3>
      <label class="block text-sm">
        <span class="block text-neutral-400 mb-1">parent_id (prototype inheritance)</span>
        <input v-model="parentId" placeholder="dialogue id to inherit from" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
      </label>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3">
      <h3 class="text-sm font-semibold">Linked from</h3>
      <div>
        <p class="text-xs text-neutral-500 mb-1">Nodes with an option pointing here</p>
        <p v-if="!linkingNodes.length" class="text-xs text-neutral-600">None.</p>
        <ul v-else class="space-y-1">
          <li v-for="n in linkingNodes" :key="n.entity_id">
            <NuxtLink :to="`/entities/dialogue/${encodeURIComponent(n.entity_id)}`" class="text-sky-400 hover:underline text-sm font-mono">{{ n.entity_id }}</NuxtLink>
          </li>
        </ul>
      </div>
      <div>
        <p class="text-xs text-neutral-500 mb-1">Mobs using this as their dialogue_root</p>
        <p v-if="!linkingMobs.length" class="text-xs text-neutral-600">None.</p>
        <ul v-else class="space-y-1">
          <li v-for="m in linkingMobs" :key="m.entity_id">
            <NuxtLink :to="`/entities/mob/${encodeURIComponent(m.entity_id)}`" class="text-sky-400 hover:underline text-sm font-mono">{{ m.entity_id }}</NuxtLink>
            <span v-if="m.doc?.name" class="text-neutral-500 text-sm"> — {{ m.doc.name }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
