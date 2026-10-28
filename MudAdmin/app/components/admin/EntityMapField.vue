<script setup lang="ts">
import type { EntityMapValueFieldSpec } from '~/utils/entitySchemas'

const props = defineProps<{
  modelValue: Record<string, unknown>
  keyLabel?: string
  keyRefType?: string
  value?: 'number' | 'text' | 'json' | 'fields'
  valueFields?: EntityMapValueFieldSpec[]
}>()

const emit = defineEmits<{ 'update:modelValue': [Record<string, unknown>] }>()

const draftKey = ref('')
const jsonErrors = ref<Record<string, string>>({})

interface EntityListResponse {
  rows: Array<{ entity_id: string; doc: Record<string, unknown> }>
}

const { data: refOptions } = useFetch<EntityListResponse>(
  () => `/api/entities/${props.keyRefType}`,
  { query: { limit: 500 }, immediate: !!props.keyRefType, watch: [() => props.keyRefType] },
)

const datalistId = computed(() => `map-key-datalist-${props.keyRefType ?? 'plain'}`)

const entries = computed(() => Object.entries(props.modelValue ?? {}))

function setEntry(key: string, newKey: string, value: unknown) {
  const next: Record<string, unknown> = {}
  for (const [k, v] of entries.value) next[k === key ? newKey : k] = k === key ? value : v
  emit('update:modelValue', next)
}

function removeEntry(key: string) {
  const next = { ...props.modelValue }
  delete next[key]
  emit('update:modelValue', next)
}

function addEntry() {
  const key = draftKey.value.trim()
  if (!key || key in props.modelValue) return
  const value = props.value === 'number' ? 0 : props.value === 'json' ? {} : props.value === 'fields' ? {} : ''
  emit('update:modelValue', { ...props.modelValue, [key]: value })
  draftKey.value = ''
}

function setJsonValue(key: string, raw: string) {
  const trimmed = raw.trim()
  if (trimmed === '') {
    const errors = { ...jsonErrors.value }
    delete errors[key]
    jsonErrors.value = errors
    const next = { ...props.modelValue }
    delete next[key]
    emit('update:modelValue', next)
    return
  }
  try {
    emit('update:modelValue', { ...props.modelValue, [key]: JSON.parse(trimmed) })
    const errors = { ...jsonErrors.value }
    delete errors[key]
    jsonErrors.value = errors
  } catch (e) {
    const errors = { ...jsonErrors.value }
    errors[key] = e instanceof Error ? e.message : 'Invalid JSON'
    jsonErrors.value = errors
  }
}

function setField(key: string, field: string, value: unknown) {
  const row = (props.modelValue[key] ?? {}) as Record<string, unknown>
  emit('update:modelValue', { ...props.modelValue, [key]: { ...row, [field]: value } })
}

const gridTemplate = computed(() => {
  const valueCols = props.value === 'fields' ? (props.valueFields ?? []).length : 1
  return `minmax(0, 1fr) repeat(${valueCols}, minmax(0, 1.2fr)) 32px`
})
</script>

<template>
  <div class="space-y-2">
    <div class="grid gap-2 items-center text-xs text-neutral-500 font-mono" :style="{ gridTemplateColumns: gridTemplate }">
      <span>{{ keyLabel ?? 'key' }}</span>
      <template v-if="value === 'fields'">
        <span v-for="vf in valueFields" :key="vf.key">{{ vf.label ?? vf.key }}</span>
      </template>
      <span v-else>value</span>
      <span />
    </div>

    <p v-if="!entries.length" class="text-xs text-neutral-500">No entries yet.</p>

    <div v-for="[key, val] in entries" :key="key" class="grid gap-2 items-center" :style="{ gridTemplateColumns: gridTemplate }">
      <input
        :value="key"
        :list="datalistId"
        class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
        @change="setEntry(key, ($event.target as HTMLInputElement).value.trim(), val)"
      />
      <datalist :id="datalistId">
        <option v-for="r in refOptions?.rows ?? []" :key="r.entity_id" :value="r.entity_id">{{ r.doc.name ?? r.entity_id }}</option>
      </datalist>

      <template v-if="value === 'fields'">
        <template v-for="vf in valueFields ?? []" :key="vf.key">
          <input
            v-if="vf.widget === 'number'"
            type="number"
            :step="vf.step ?? 1"
            :min="vf.min"
            :value="Number((val as Record<string, unknown>)[vf.key] ?? 0)"
            class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm"
            @input="setField(key, vf.key, Number(($event.target as HTMLInputElement).value))"
          />
          <input
            v-else-if="vf.widget === 'text'"
            :value="String((val as Record<string, unknown>)[vf.key] ?? '')"
            class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm"
            @input="setField(key, vf.key, ($event.target as HTMLInputElement).value)"
          />
          <input
            v-else
            type="checkbox"
            :checked="(val as Record<string, unknown>)[vf.key] === true"
            @change="setField(key, vf.key, ($event.target as HTMLInputElement).checked)"
          />
        </template>
      </template>
      <input
        v-else-if="value === 'number'"
        type="number"
        step="any"
        :value="Number(val)"
        class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm"
        @input="setEntry(key, key, Number(($event.target as HTMLInputElement).value))"
      />
      <div v-else-if="value === 'json'" class="col-span-1">
        <textarea
          :value="JSON.stringify(val, null, 0) ?? ''"
          rows="1"
          class="w-full bg-neutral-950 border rounded px-2 py-1 text-xs font-mono"
          :class="jsonErrors[key] ? 'border-red-700' : 'border-neutral-700'"
          @change="setJsonValue(key, ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
        <p v-if="jsonErrors[key]" class="text-xs text-red-400">{{ jsonErrors[key] }}</p>
      </div>
      <input
        v-else
        :value="String(val ?? '')"
        class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm"
        @input="setEntry(key, key, ($event.target as HTMLInputElement).value)"
      />

      <button type="button" class="px-1.5 py-0.5 text-xs bg-red-900/60 hover:bg-red-800 rounded" @click="removeEntry(key)">✕</button>
    </div>

    <div class="flex gap-2">
      <input
        v-model="draftKey"
        :placeholder="`${keyLabel ?? 'key'}…`"
        class="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
        @keydown.enter.prevent="addEntry"
      />
      <button type="button" class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded" @click="addEntry">+ Add</button>
    </div>
  </div>
</template>
