<script setup lang="ts">
import { encodeCompositeKey, decodeCompositeKey } from '~/utils/composite-key'

definePageMeta({ layout: 'admin' })

interface ZoneRow {
  region_id: string
  zone_id: number
  name: string
  description: string | null
  rules_json: string | null
  zone_script_ref: string | null
  is_active: boolean | null
  created_at: string | null
}

const route = useRoute()
const compositeRaw = computed(() => decodeURIComponent(String(route.params.id)))

const keys = computed(() => decodeCompositeKey('world_zones', compositeRaw.value))
const regionId = computed(() => String(keys.value.region_id ?? ''))
const zoneId = computed(() => Number(keys.value.zone_id ?? 0))

const { data, refresh } = await useFetch<{ rows: ZoneRow[] }>('/api/tables/world_zones')
const row = computed<ZoneRow | undefined>(() =>
  (data.value?.rows ?? []).find(
    (r) => r.region_id === regionId.value && r.zone_id === zoneId.value,
  ),
)

const draft = reactive({
  name: '',
  description: '',
  rules_json: '{}',
  zone_script_ref: '',
  is_active: true,
})

const rulesError = ref<string | null>(null)
const rulesParsed = computed<Record<string, unknown> | null>(() => {
  if (!draft.rules_json.trim()) return null
  try {
    const parsed = JSON.parse(draft.rules_json)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
})

const scope = computed(() => String(rulesParsed.value?.instance_scope ?? 'shared'))
const isProcedural = computed(() => draft.zone_script_ref.trim().length > 0)

watchEffect(() => {
  if (!row.value) return
  draft.name = row.value.name ?? ''
  draft.description = row.value.description ?? ''
  draft.rules_json = row.value.rules_json ?? '{}'
  draft.zone_script_ref = row.value.zone_script_ref ?? ''
  draft.is_active = row.value.is_active ?? true
})

const saving = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

async function save() {
  if (!row.value) return
  try {
    JSON.parse(draft.rules_json)
  } catch {
    error.value = 'rules_json is not valid JSON'
    return
  }
  saving.value = true
  error.value = null
  success.value = null
  try {
    const key = encodeCompositeKey('world_zones', row.value)
    await $fetch(`/api/tables/world_zones/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: {
        name: draft.name,
        description: draft.description || null,
        rules_json: draft.rules_json,
        zone_script_ref: draft.zone_script_ref.trim() || null,
        is_active: draft.is_active,
      },
    })
    success.value = 'Saved.'
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Save failed'
  } finally {
    saving.value = false
  }
}

const tab = ref<'identity' | 'rules' | 'procedural'>('identity')

function setRule(key: string, value: unknown) {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(draft.rules_json) as Record<string, unknown>
  } catch {
    parsed = {}
  }
  parsed[key] = value
  draft.rules_json = JSON.stringify(parsed, null, 2)
}

function toggleRespawnField(key: string, value: unknown) {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(draft.rules_json) as Record<string, unknown>
  } catch {
    parsed = {}
  }
  const respawn = (parsed.respawn && typeof parsed.respawn === 'object' && !Array.isArray(parsed.respawn))
    ? (parsed.respawn as Record<string, unknown>)
    : {}
  respawn[key] = value
  parsed.respawn = respawn
  draft.rules_json = JSON.stringify(parsed, null, 2)
}

function setScope(value: string) {
  setRule('instance_scope', value)
}
</script>

<template>
  <div v-if="!row" class="text-neutral-400">Zone not found.</div>
  <div v-else class="space-y-4 max-w-3xl">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <NuxtLink :to="`/world/regions/${encodeURIComponent(regionId)}`" class="text-sky-400 hover:underline text-sm">
          ← region {{ regionId }}
        </NuxtLink>
        <h2 class="text-xl font-semibold font-mono">
          <span class="text-indigo-300">#{{ zoneId }}</span> {{ row.name }}
        </h2>
        <span v-if="isProcedural" class="text-xs text-amber-400 font-mono px-2 py-0.5 border border-amber-700 rounded">
          procedural
        </span>
        <span v-else class="text-xs text-neutral-400 font-mono px-2 py-0.5 border border-neutral-700 rounded">
          static
        </span>
      </div>
      <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50" :disabled="saving" @click="save">
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </div>

    <div v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ error }}</div>
    <div v-if="success" class="bg-emerald-900/40 border border-emerald-700 rounded px-3 py-2 text-sm text-emerald-200">{{ success }}</div>

    <div class="border-b border-neutral-800 flex gap-1">
      <button v-for="t in ['identity','rules','procedural'] as const" :key="t" class="px-3 py-1.5 text-sm rounded-t" :class="tab===t ? 'bg-neutral-900 text-neutral-100 border border-neutral-800 border-b-0' : 'text-neutral-400 hover:text-neutral-200'" @click="tab=t">
        {{ t }}
      </button>
    </div>

    <div v-if="tab==='identity'" class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3">
      <div>
        <label class="block text-sm text-neutral-400 mb-1">name</label>
        <input v-model="draft.name" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
      </div>
      <div>
        <AdminWikiText v-model="draft.description" :rows="4" />
      </div>
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" v-model="draft.is_active" />
        <span>active</span>
      </label>
    </div>

    <div v-if="tab==='rules'" class="space-y-4">
      <div class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3">
        <div>
          <h3 class="text-sm font-semibold">Quick toggles</h3>
          <p class="text-xs text-neutral-500">Common keys. Anything below writes to <code>rules_json</code>.</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">pvp</span>
            <select
              :value="(rulesParsed?.pvp as string) ?? 'safe'"
              class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1"
              @change="(e) => setRule('pvp', (e.target as HTMLSelectElement).value)"
            >
              <option value="safe">safe</option>
              <option value="open">open</option>
              <option value="arena">arena</option>
              <option value="clan">clan</option>
            </select>
          </label>
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">magic</span>
            <select
              :value="(rulesParsed?.magic as string) ?? 'open'"
              class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1"
              @change="(e) => setRule('magic', (e.target as HTMLSelectElement).value)"
            >
              <option value="open">open</option>
              <option value="safe">safe</option>
              <option value="block">block</option>
            </select>
          </label>
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">recall</span>
            <select
              :value="(rulesParsed?.recall as string) ?? 'allow'"
              class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1"
              @change="(e) => setRule('recall', (e.target as HTMLSelectElement).value)"
            >
              <option value="allow">allow</option>
              <option value="block">block</option>
              <option value="cost">cost</option>
            </select>
          </label>
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">summon</span>
            <select
              :value="(rulesParsed?.summon as string) ?? 'block'"
              class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1"
              @change="(e) => setRule('summon', (e.target as HTMLSelectElement).value)"
            >
              <option value="allow">allow</option>
              <option value="block">block</option>
            </select>
          </label>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">respawn.rate (seconds)</span>
            <input
              :value="(rulesParsed?.respawn as Record<string, unknown> | undefined)?.rate ?? 1800"
              type="number"
              min="0"
              class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1"
              @input="(e) => toggleRespawnField('rate', Number((e.target as HTMLInputElement).value))"
            />
          </label>
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">respawn.capacity</span>
            <input
              :value="(rulesParsed?.respawn as Record<string, unknown> | undefined)?.capacity ?? 5"
              type="number"
              min="0"
              class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1"
              @input="(e) => toggleRespawnField('capacity', Number((e.target as HTMLInputElement).value))"
            />
          </label>
        </div>
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">instance_scope (procedural zones only)</span>
          <select
            :value="scope"
            class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1"
            @change="(e) => setScope((e.target as HTMLSelectElement).value)"
          >
            <option value="shared">shared — first player creates, all see the same rooms</option>
            <option value="per_player">per_player — each player gets their own instance</option>
            <option value="per_party">per_party — party-shared (falls back to shared until party system exists)</option>
          </select>
        </label>
      </div>
      <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
        <div class="flex items-center justify-between mb-1">
          <span class="text-neutral-400 text-sm">rules_json</span>
          <span class="text-xs text-neutral-500">Free-form. Add anything your Lua scripts need.</span>
        </div>
        <textarea
          v-model="draft.rules_json"
          rows="14"
          class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-xs"
          spellcheck="false"
        />
        <div v-if="rulesError" class="text-xs text-red-400 mt-1">{{ rulesError }}</div>
      </div>
    </div>

    <div v-if="tab==='procedural'" class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3">
      <div>
          <h3 class="text-sm font-semibold">Procedural generation</h3>
          <p class="text-xs text-neutral-500 mt-1">
            When <code>zone_script_ref</code> is set, the C++ server skips this zone's rooms in
            <code>world_rooms</code> and instead runs the referenced Lua generator on first player entry.
            <code>instance_scope</code> in <strong>Rules</strong> controls whether the generated rooms are
            shared, per-player, or per-party (per-party currently falls back to shared).
          </p>
        </div>
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">zone_script_ref</span>
          <input
            v-model="draft.zone_script_ref"
            placeholder="e.g. regions/zones/dungeon_1"
            class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-xs"
          />
        </label>
        <div class="text-xs text-neutral-500">
          Path is relative to <code>ModularMudServer/scripts/</code>. The generator must
          return <code>{ entry_room_id, rooms, exits, spawns }</code>.
        </div>
      </div>
  </div>
</template>