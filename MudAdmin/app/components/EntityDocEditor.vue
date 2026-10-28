<script setup lang="ts">
import { ENTITY_SCHEMAS, schemaFields } from '~/utils/entitySchemas'
import type { EntityFieldSpec } from '~/utils/entitySchemas'

const props = defineProps<{
  entityType: string
  entityId: string
}>()

const emit = defineEmits<{ close: [] }>()

const toast = useToast()
const confirmRef = ref<{ ask: (opts: { title: string; body?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean> } | null>(null)

const schema = computed(() => ENTITY_SCHEMAS[props.entityType]!)
const allFields = computed(() => schemaFields(schema.value))

const { data, error, pending } = await useFetch<{
  record: { entity_type: string; entity_id: string; doc: Record<string, unknown>; parent_id: string | null; updated_at: string }
}>(() => `/api/entities/${props.entityType}/${encodeURIComponent(props.entityId)}`, {
  key: `entity-${props.entityType}-${props.entityId}`,
})

if (error.value || !data.value?.record) {
  throw createError({ statusCode: 404, statusMessage: `${props.entityType}/${props.entityId} not found` })
}

const { data: listData } = await useFetch<{
  rows: Array<{ entity_id: string; doc: Record<string, unknown>; parent_id: string | null }>
}>(() => `/api/entities/${props.entityType}`, {
  query: { limit: 500 },
  key: `entity-list-${props.entityType}`,
})

const doc = reactive<Record<string, unknown>>(JSON.parse(JSON.stringify(data.value.record.doc)))
const parentId = ref<string>(data.value.record.parent_id ?? '')

const snapshot = ref(JSON.stringify(data.value.record.doc))
const snapshotParent = ref(data.value.record.parent_id ?? '')

const dirty = computed(() => JSON.stringify(doc) !== snapshot.value || parentId.value !== snapshotParent.value)

const knownKeys = computed(() => allFields.value.map((f) => f.key))
const extraKeys = computed(() => Object.keys(doc).filter((k) => !knownKeys.value.includes(k)))

const tab = ref<'fields' | 'raw'>('fields')
const rawText = ref('')
const rawError = ref<string | null>(null)

const jsonDrafts = reactive<Record<string, string>>({})
const jsonErrors = reactive<Record<string, string>>({})

const saving = ref(false)
const suppressGuard = ref(false)

const missingRequired = computed(() =>
  allFields.value
    .filter((f) => f.required && (doc[f.key] === undefined || doc[f.key] === null || doc[f.key] === ''))
    .map((f) => f.key),
)

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

function jsonDisplay(key: string): string {
  if (jsonDrafts[key] !== undefined) return jsonDrafts[key]
  const v = doc[key]
  if (v === undefined || v === null) return ''
  return JSON.stringify(v, null, 2)
}

function setJson(key: string, raw: string) {
  jsonDrafts[key] = raw
  const trimmed = raw.trim()
  if (trimmed === '') {
    delete jsonErrors[key]
    delete doc[key]
    return
  }
  try {
    doc[key] = JSON.parse(trimmed)
    delete jsonErrors[key]
  } catch (e) {
    jsonErrors[key] = e instanceof Error ? e.message : 'Invalid JSON'
  }
}

function openRaw() {
  rawText.value = JSON.stringify(doc, null, 2)
  rawError.value = null
  tab.value = 'raw'
}

function applyRaw() {
  try {
    const parsed = JSON.parse(rawText.value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('doc must be a JSON object')
    }
    Object.keys(doc).forEach((k) => delete doc[k])
    Object.assign(doc, parsed)
    Object.keys(jsonDrafts).forEach((k) => delete jsonDrafts[k])
    Object.keys(jsonErrors).forEach((k) => delete jsonErrors[k])
    rawError.value = null
    tab.value = 'fields'
  } catch (e) {
    rawError.value = e instanceof Error ? e.message : 'Invalid JSON'
  }
}

async function save() {
  if (missingRequired.value.length) {
    toast.error(`Missing required fields: ${missingRequired.value.join(', ')}`)
    return
  }
  if (Object.keys(jsonErrors).length) {
    toast.error(`Invalid JSON in: ${Object.keys(jsonErrors).join(', ')}`)
    return
  }
  saving.value = true
  try {
    await $fetch(`/api/entities/${props.entityType}/${encodeURIComponent(props.entityId)}`, {
      method: 'PUT',
      body: { doc: JSON.parse(JSON.stringify(doc)), parent_id: parentId.value.trim() || null },
    })
    snapshot.value = JSON.stringify(doc)
    snapshotParent.value = parentId.value
    toast.success(`Saved ${props.entityId}`)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    toast.error(err.data?.statusMessage ?? 'Save failed')
  } finally {
    saving.value = false
  }
}

function revert() {
  const parsed = JSON.parse(snapshot.value) as Record<string, unknown>
  Object.keys(doc).forEach((k) => delete doc[k])
  Object.assign(doc, parsed)
  parentId.value = snapshotParent.value
  Object.keys(jsonDrafts).forEach((k) => delete jsonDrafts[k])
  Object.keys(jsonErrors).forEach((k) => delete jsonErrors[k])
}

async function remove() {
  let refNote = ''
  try {
    const res = await $fetch<{ references: Array<{ entity_type: string; entity_id: string; field: string }> }>(
      `/api/entities/${props.entityType}/${encodeURIComponent(props.entityId)}/references`,
    )
    if (res.references.length) {
      const shown = res.references.slice(0, 8).map((r) => `${r.entity_type}/${r.entity_id} (${r.field})`)
      refNote = `\n\nReferenced by ${res.references.length} entity(ies):\n${shown.join('\n')}${res.references.length > shown.length ? '\n…' : ''}`
    }
  } catch {
    // references endpoint is advisory only — proceed with plain confirm
  }
  const ok = await confirmRef.value?.ask({
    title: `Delete ${props.entityType}/${props.entityId}?`,
    body: 'This cannot be undone.' + refNote,
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  try {
    await $fetch(`/api/entities/${props.entityType}/${encodeURIComponent(props.entityId)}`, { method: 'DELETE' })
    suppressGuard.value = true
    toast.success(`Deleted ${props.entityId}`)
    emit('close')
    await navigateTo(`/entities/${props.entityType}`)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    toast.error(err.data?.statusMessage ?? 'Delete failed')
  }
}

async function duplicate() {
  const ids = new Set((listData.value?.rows ?? []).map((r) => r.entity_id))
  let newId = `${props.entityId}_copy`
  let n = 2
  while (ids.has(newId)) newId = `${props.entityId}_copy${n++}`
  try {
    await $fetch(`/api/entities/${props.entityType}`, {
      method: 'POST',
      body: { id: newId, doc: JSON.parse(JSON.stringify(doc)), parent_id: parentId.value.trim() || null },
    })
    suppressGuard.value = true
    toast.success(`Created ${newId}`)
    await navigateTo(`/entities/${props.entityType}/${encodeURIComponent(newId)}`)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    toast.error(err.data?.statusMessage ?? 'Duplicate failed')
  }
}

onBeforeRouteLeave(async () => {
  if (!dirty.value || suppressGuard.value) return true
  const ok = await confirmRef.value?.ask({
    title: 'Discard unsaved changes?',
    body: 'You have edits that have not been saved.',
    confirmLabel: 'Discard',
    danger: true,
  })
  return ok !== false
})

function deepMerge(parent: Record<string, unknown>, child: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...parent }
  for (const [k, v] of Object.entries(child)) {
    const pv = out[k]
    if (v && typeof v === 'object' && !Array.isArray(v) && pv && typeof pv === 'object' && !Array.isArray(pv)) {
      out[k] = deepMerge(pv as Record<string, unknown>, v as Record<string, unknown>)
    } else {
      out[k] = v
    }
  }
  return out
}

const parentCandidates = computed(() => (listData.value?.rows ?? []).filter((r) => r.entity_id !== props.entityId))

interface InheritanceView {
  missing: string | null
  merged: Record<string, unknown> | null
  inheritedOnly: string[]
  chain: string[]
}

const inheritance = computed<InheritanceView>(() => {
  if (!parentId.value.trim()) return { missing: null, merged: null, inheritedOnly: [], chain: [] }
  const rows = listData.value?.rows ?? []
  const byId = new Map(rows.map((r) => [r.entity_id, r]))
  const chainDocs: Array<{ id: string; doc: Record<string, unknown> }> = []
  const chainIds: string[] = []
  const seen = new Set<string>([props.entityId])
  let cur = parentId.value.trim()
  while (cur && !seen.has(cur)) {
    const row = byId.get(cur)
    if (!row) return { missing: cur, merged: null, inheritedOnly: [], chain: chainIds }
    seen.add(cur)
    chainDocs.push({ id: cur, doc: row.doc })
    chainIds.push(cur)
    cur = row.parent_id ?? ''
  }
  const localKeys = new Set(Object.keys(doc))
  const inheritedKeys = new Set<string>()
  for (const ancestor of chainDocs) {
    for (const k of Object.keys(ancestor.doc)) inheritedKeys.add(k)
  }
  let merged: Record<string, unknown> = {}
  for (let i = chainDocs.length - 1; i >= 0; i--) {
    merged = deepMerge(merged, chainDocs[i]!.doc)
  }
  const inheritedOnly = [...inheritedKeys].filter((k) => !localKeys.has(k))
  return { missing: null, merged, inheritedOnly, chain: chainIds }
})

function fieldSpan(field: EntityFieldSpec): 1 | 2 {
  if (field.span) return field.span
  const wide = ['textarea', 'json', 'array', 'map', 'script', 'group']
  return wide.includes(field.widget) ? 2 : 1
}

function isRecordArray(v: unknown): boolean {
  return Array.isArray(v)
}

function isRecord(v: unknown): boolean {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function widgetFor(field: EntityFieldSpec): string {
  const v = doc[field.key]
  if (field.widget === 'array' && v !== undefined && v !== null && !isRecordArray(v)) return 'json'
  if ((field.widget === 'map' || field.widget === 'group') && v !== undefined && v !== null && !isRecord(v)) return 'json'
  return field.widget
}
</script>

<template>
  <div v-if="!pending" class="space-y-4">
    <div class="sticky top-0 z-40 -mx-6 px-6 py-3 bg-neutral-950/95 backdrop-blur border-b border-neutral-800 flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <NuxtLink :to="`/entities/${entityType}`" class="text-sky-400 hover:underline text-sm">&larr; {{ schema.label.toLowerCase() }}</NuxtLink>
        <h2 class="text-xl font-semibold font-mono truncate">{{ entityId }}</h2>
        <span v-if="dirty" class="text-xs px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700">unsaved</span>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="missingRequired.length" class="text-xs text-red-400 hidden md:inline">missing: {{ missingRequired.join(', ') }}</span>
        <UiButton size="sm" :disabled="!dirty" @click="revert">Revert</UiButton>
        <UiButton size="sm" @click="duplicate">Duplicate</UiButton>
        <UiButton size="sm" variant="danger" @click="remove">Delete</UiButton>
        <UiButton size="sm" variant="primary" :loading="saving" :disabled="!dirty" @click="save">{{ saving ? 'Saving…' : 'Save' }}</UiButton>
      </div>
    </div>

    <p v-if="schema.editorNote" class="text-sm text-neutral-400">{{ schema.editorNote }}</p>

    <UiTabs
      :tabs="[{ key: 'fields', label: 'Fields' }, { key: 'raw', label: 'Raw JSON' }]"
      :model-value="tab"
      @update:model-value="(v: string) => { if (v === 'raw') openRaw(); else tab = 'fields' }"
    />

    <div v-if="tab === 'fields'" class="pt-4 space-y-4">
      <UiPanel title="Prototype inheritance">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">parent_id (inherits from another {{ schema.singular.toLowerCase() }})</span>
            <input
              v-model="parentId"
              list="parent-candidates"
              :placeholder="`${entityType} id, e.g. ${schema.idPlaceholder}`"
              class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
            />
            <datalist id="parent-candidates">
              <option v-for="c in parentCandidates" :key="c.entity_id" :value="c.entity_id">{{ c.doc.name ?? c.entity_id }}</option>
            </datalist>
          </label>
          <div class="text-xs space-y-1">
            <div v-if="inheritance.missing" class="text-red-400">parent '{{ inheritance.missing }}' does not exist</div>
            <template v-else-if="inheritance.chain.length">
              <p class="text-neutral-400">Chain: {{ inheritance.chain.join(' → ') }} → <span class="text-neutral-200">{{ entityId }}</span></p>
              <p v-if="inheritance.inheritedOnly.length" class="text-neutral-400">
                Inherited keys: <span class="font-mono text-emerald-400">{{ inheritance.inheritedOnly.join(', ') }}</span>
              </p>
              <details>
                <summary class="cursor-pointer text-neutral-400">Resolved merge preview</summary>
                <pre class="mt-2 bg-neutral-950 border border-neutral-800 rounded p-2 text-xs overflow-auto max-h-64">{{ JSON.stringify(inheritance.merged, null, 2) }}</pre>
              </details>
            </template>
            <p v-else class="text-neutral-500">Objects deep-merge from the parent; arrays and scalars replace.</p>
          </div>
        </div>
      </UiPanel>

      <UiPanel v-for="section in schema.sections" :key="section.title" :title="section.title">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label
            v-for="field in section.fields"
            :key="field.key"
            class="block text-sm"
            :class="{ 'md:col-span-2': fieldSpan(field) === 2 }"
          >
            <span class="block text-neutral-400 mb-1 font-mono text-xs">
              {{ field.label ?? field.key }}
              <span v-if="field.required" class="text-red-400" title="Required">*</span>
              <span v-if="missingRequired.includes(field.key)" class="text-red-400"> — required</span>
            </span>

            <template v-if="widgetFor(field) === 'textarea'">
              <textarea
                :value="textVal(field.key)"
                rows="3"
                class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm"
                @input="setVal(field.key, ($event.target as HTMLTextAreaElement).value)"
              ></textarea>
            </template>

            <template v-else-if="widgetFor(field) === 'wikitext'">
              <AdminWikiText
                :model-value="textVal(field.key)"
                :show-label="false"
                @update:model-value="(v: string) => setVal(field.key, v)"
              />
            </template>

            <template v-else-if="widgetFor(field) === 'json'">
              <textarea
                :value="jsonDisplay(field.key)"
                rows="6"
                class="w-full bg-neutral-950 border rounded px-2 py-1 text-xs font-mono"
                :class="jsonErrors[field.key] ? 'border-red-700' : 'border-neutral-700'"
                placeholder="[] or {} — empty removes the key"
                @change="setJson(field.key, ($event.target as HTMLTextAreaElement).value)"
              ></textarea>
              <p v-if="jsonErrors[field.key]" class="text-xs text-red-400 mt-1">{{ jsonErrors[field.key] }}</p>
            </template>

            <AdminEntityArrayField
              v-else-if="widgetFor(field) === 'array'"
              :model-value="(doc[field.key] as Record<string, unknown>[] | string[] | undefined) ?? []"
              :columns="field.columns"
              :add-label="field.addLabel"
              @update:model-value="(v) => setVal(field.key, v)"
            />

            <AdminEntityMapField
              v-else-if="widgetFor(field) === 'map'"
              :model-value="(doc[field.key] as Record<string, unknown> | undefined) ?? {}"
              :key-label="field.mapKeyLabel"
              :key-ref-type="field.mapKeyRefType"
              :value="field.mapValue"
              :value-fields="field.mapValueFields"
              @update:model-value="(v) => setVal(field.key, v)"
            />

            <AdminEntityGroupField
              v-else-if="widgetFor(field) === 'group'"
              :model-value="(doc[field.key] as Record<string, unknown> | undefined) ?? {}"
              :fields="field.fields ?? []"
              @update:model-value="(v) => setVal(field.key, v)"
            />

            <AdminEntityScriptField
              v-else-if="widgetFor(field) === 'script'"
              :model-value="textVal(field.key)"
              :kind="field.scriptKind ?? 'system'"
              @update:model-value="(v: string) => setVal(field.key, v)"
            />

            <AdminAnsiColorSelect
              v-else-if="widgetFor(field) === 'color' || widgetFor(field) === 'bgcolor'"
              :model-value="textVal(field.key)"
              :background="field.widget === 'bgcolor'"
              @update:model-value="(v: string) => setVal(field.key, v)"
            />

            <AdminEntityRefField
              v-else-if="widgetFor(field) === 'ref'"
              :model-value="textVal(field.key)"
              :ref-type="field.refType ?? 'item'"
              :placeholder="field.placeholder"
              @update:model-value="(v: string) => setVal(field.key, v)"
            />

            <select
              v-else-if="widgetFor(field) === 'bool'"
              :value="boolVal(field.key) ? 'true' : 'false'"
              class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
              @change="setVal(field.key, ($event.target as HTMLSelectElement).value === 'true')"
            >
              <option value="false">false</option>
              <option value="true">true</option>
            </select>

            <select
              v-else-if="widgetFor(field) === 'select'"
              :value="textVal(field.key)"
              class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
              @change="setVal(field.key, ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="o in field.options ?? []" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>

            <input
              v-else-if="widgetFor(field) === 'number'"
              type="number"
              step="any"
              :min="field.min"
              :max="field.max"
              :value="numberVal(field.key)"
              class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
              @input="setVal(field.key, Number(($event.target as HTMLInputElement).value))"
            />

            <input
              v-else
              :value="textVal(field.key)"
              :placeholder="field.placeholder"
              class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
              @input="setVal(field.key, ($event.target as HTMLInputElement).value)"
            />

            <span v-if="field.help" class="block text-xs text-neutral-500 mt-1">{{ field.help }}</span>
          </label>
        </div>
      </UiPanel>

      <UiPanel v-if="extraKeys.length" title="Extra keys (not in schema)">
        <ul class="text-xs font-mono text-neutral-400 space-y-1">
          <li v-for="k in extraKeys" :key="k">
            {{ k }} = <span class="text-neutral-500">{{ JSON.stringify(doc[k]) }}</span>
          </li>
        </ul>
        <p class="text-xs text-neutral-500 mt-2">Editable via the Raw JSON tab.</p>
      </UiPanel>
    </div>

    <div v-else class="pt-4">
      <div class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">Raw document</h3>
          <div class="flex gap-2">
            <UiButton size="sm" variant="primary" @click="applyRaw">Apply</UiButton>
            <UiButton size="sm" @click="tab = 'fields'">Cancel</UiButton>
          </div>
        </div>
        <textarea v-model="rawText" rows="24" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"></textarea>
        <p v-if="rawError" class="text-xs text-red-400">{{ rawError }}</p>
      </div>
    </div>

    <UiConfirmDialog ref="confirmRef" />
  </div>
</template>
