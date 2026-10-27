<script setup lang="ts">
import { ENTITY_SCHEMAS, isEntityType } from '~/utils/entitySchemas'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const entityType = computed(() => String(route.params.type))
const entityId = computed(() => decodeURIComponent(String(route.params.id)))

if (!isEntityType(entityType.value)) {
  throw createError({ statusCode: 404, statusMessage: `Unknown entity type: ${entityType.value}` })
}
const schema = computed(() => ENTITY_SCHEMAS[entityType.value]!)

const { data, error } = await useFetch<{
  record: { entity_type: string; entity_id: string; doc: Record<string, unknown>; parent_id: string | null; updated_at: string }
}>(() => `/api/entities/${entityType.value}/${encodeURIComponent(entityId.value)}`)

if (error.value || !data.value?.record) {
  throw createError({ statusCode: 404, statusMessage: `${entityType.value}/${entityId.value} not found` })
}

const doc = reactive<Record<string, unknown>>(JSON.parse(JSON.stringify(data.value.record.doc)))
const parentId = ref<string>(data.value.record.parent_id ?? '')
const knownKeys = computed(() => schema.value.fields.map((f) => f.key))
const extraKeys = computed(() => Object.keys(doc).filter((k) => !knownKeys.value.includes(k)))

const showRaw = ref(false)
const rawText = ref('')
const rawError = ref<string | null>(null)

const saving = ref(false)
const saveError = ref<string | null>(null)
const success = ref<string | null>(null)

function textVal(key: string): string {
  const v = doc[key]
  return v === undefined || v === null ? '' : String(v)
}
function setVal(key: string, v: unknown) {
  doc[key] = v
}
function numberVal(key: string): number {
  const v = Number(doc[key])
  return Number.isFinite(v) ? v : 0
}
function boolVal(key: string): boolean {
  return doc[key] === true
}
function jsonVal(key: string): string {
  const v = doc[key]
  if (v === undefined || v === null) return ''
  return JSON.stringify(v, null, 2)
}
function setJson(key: string, raw: string) {
  const trimmed = raw.trim()
  if (trimmed === '') {
    delete doc[key]
    return
  }
  JSON.parse(trimmed)
  doc[key] = JSON.parse(trimmed)
}

function openRaw() {
  rawText.value = JSON.stringify(doc, null, 2)
  rawError.value = null
  showRaw.value = true
}
function applyRaw() {
  try {
    const parsed = JSON.parse(rawText.value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('doc must be a JSON object')
    }
    Object.keys(doc).forEach((k) => delete doc[k])
    Object.assign(doc, parsed)
    rawError.value = null
    showRaw.value = false
  } catch (e) {
    rawError.value = e instanceof Error ? e.message : 'Invalid JSON'
  }
}

async function save() {
  saving.value = true
  saveError.value = null
  success.value = null
  try {
    await $fetch(`/api/entities/${entityType.value}/${encodeURIComponent(entityId.value)}`, {
      method: 'PUT',
      body: { doc: JSON.parse(JSON.stringify(doc)), parent_id: parentId.value.trim() || null },
    })
    success.value = 'Saved.'
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    saveError.value = err.data?.statusMessage ?? 'Save failed'
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!confirm(`Delete ${entityType.value}/${entityId.value}?`)) return
  await $fetch(`/api/entities/${entityType.value}/${encodeURIComponent(entityId.value)}`, { method: 'DELETE' })
  await navigateTo(`/entities/${entityType.value}`)
}
</script>

<template>
  <div>
    <AdminMobEditor
      v-if="entityType === 'mob'"
      :entity-id="entityId"
      @close="navigateTo(`/entities/${entityType}`)"
    />
    <AdminItemEditor
      v-else-if="entityType === 'item'"
      :entity-id="entityId"
      @close="navigateTo(`/entities/${entityType}`)"
    />
    <AdminLootTableEditor
      v-else-if="entityType === 'loot_table'"
      :entity-id="entityId"
      @close="navigateTo(`/entities/${entityType}`)"
    />
    <AdminInteractableEditor
      v-else-if="entityType === 'interactable'"
      :entity-id="entityId"
      @close="navigateTo(`/entities/${entityType}`)"
    />
    <AdminZoneEditor
      v-else-if="entityType === 'zone'"
      :entity-id="entityId"
      @close="navigateTo(`/entities/${entityType}`)"
    />
    <AdminDialogueEditor
      v-else-if="entityType === 'dialogue'"
      :entity-id="entityId"
      @close="navigateTo(`/entities/${entityType}`)"
    />
    <AdminRoomEditor
      v-else-if="entityType === 'room'"
      :entity-id="entityId"
      @close="navigateTo(`/entities/${entityType}`)"
    />
    <div v-else class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <NuxtLink :to="`/entities/${entityType}`" class="text-sky-400 hover:underline text-sm">&larr; {{ schema.label.toLowerCase() }}</NuxtLink>
          <h2 class="text-xl font-semibold font-mono truncate">{{ entityId }}</h2>
        </div>
      <div class="flex items-center gap-2">
        <button class="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-sm" @click="openRaw">Raw JSON</button>
        <button class="px-3 py-1.5 rounded bg-red-900/70 hover:bg-red-800 text-sm" @click="remove">Delete</button>
        <button
          class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>

    <div v-if="saveError" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ saveError }}</div>
    <div v-if="success" class="bg-emerald-900/40 border border-emerald-700 rounded px-3 py-2 text-sm text-emerald-200">{{ success }}</div>

    <div v-if="showRaw" class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">Raw document</h3>
        <div class="flex gap-2">
          <button class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded" @click="applyRaw">Apply</button>
          <button class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded" @click="showRaw = false">Cancel</button>
        </div>
      </div>
      <textarea v-model="rawText" rows="18" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"></textarea>
      <p v-if="rawError" class="text-xs text-red-300">{{ rawError }}</p>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <label class="block text-sm mb-3">
        <span class="block text-neutral-400 mb-1">parent_id (prototype inheritance)</span>
        <input v-model="parentId" :placeholder="`${entityType} id to inherit from, e.g. goblin`" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
      </label>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label v-for="field in schema.fields" :key="field.key" class="block text-sm" :class="{ 'md:col-span-2': field.type === 'textarea' || field.type === 'json' }">
          <span class="block text-neutral-400 mb-1 font-mono text-xs">{{ field.key }}</span>

          <textarea
            v-if="field.type === 'textarea'"
            :value="textVal(field.key)"
            rows="3"
            class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm"
            @input="setVal(field.key, ($event.target as HTMLTextAreaElement).value)"
          ></textarea>

          <textarea
            v-else-if="field.type === 'json'"
            :value="jsonVal(field.key)"
            rows="6"
            class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"
            placeholder="[] or {} — empty removes the key"
            @change="setJson(field.key, ($event.target as HTMLTextAreaElement).value)"
          ></textarea>

          <select
            v-else-if="field.type === 'bool'"
            :value="boolVal(field.key) ? 'true' : 'false'"
            class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
            @change="setVal(field.key, ($event.target as HTMLSelectElement).value === 'true')"
          >
            <option value="false">false</option>
            <option value="true">true</option>
          </select>

          <input
            v-else-if="field.type === 'number'"
            type="number"
            step="any"
            :value="numberVal(field.key)"
            class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
            @input="setVal(field.key, Number(($event.target as HTMLInputElement).value))"
          />

          <input
            v-else
            :value="textVal(field.key)"
            class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
            @input="setVal(field.key, ($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>

      <div v-if="extraKeys.length" class="mt-4 border-t border-neutral-800 pt-3">
        <details>
          <summary class="text-xs text-neutral-400 cursor-pointer">Unregistered keys ({{ extraKeys.length }}) — edit via Raw JSON</summary>
          <ul class="mt-2 text-xs font-mono text-neutral-500">
            <li v-for="k in extraKeys" :key="k">{{ k }}</li>
          </ul>
        </details>
      </div>
    </div>
    </div>
  </div>
</template>
