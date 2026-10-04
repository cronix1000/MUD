<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { META_KEYS, type MetaEntityType, type MetaKeySpec } from '~/utils/metaKeys'

const props = defineProps<{
  entityType: MetaEntityType
  modelValue: Record<string, unknown> | null | undefined
}>()

const emit = defineEmits<{
  'update:modelValue': [Record<string, unknown>]
}>()

const specs = computed<Record<string, MetaKeySpec>>(() => META_KEYS[props.entityType])

const state = reactive<Record<string, unknown>>({})

watch(
  () => [props.modelValue, props.entityType] as const,
  ([saved]) => {
    const next: Record<string, unknown> = {}
    for (const [key, spec] of Object.entries(specs.value)) {
      const incoming = saved?.[key]
      next[key] = incoming === undefined || incoming === null ? spec.default : incoming
    }
    for (const [key, val] of Object.entries(saved ?? {})) {
      if (!(key in next)) {
        next[key] = val
      }
    }
    Object.keys(state).forEach(k => delete state[k])
    Object.assign(state, next)
  },
  { immediate: true, deep: true },
)

function emitChange() {
  emit('update:modelValue', { ...state })
}

function inputType(spec: MetaKeySpec): string {
  switch (spec.type) {
    case 'int':
    case 'float':
      return 'number'
    case 'string':
      return 'text'
    default:
      return 'text'
  }
}

function asNumber(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function asBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1'
}

function asString(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

function coerceForSave(key: string): unknown {
  const spec = specs.value[key]
  const raw = state[key]
  if (!spec) return raw
  switch (spec.type) {
    case 'int':
      return Math.trunc(asNumber(raw))
    case 'float':
      return asNumber(raw)
    case 'bool':
      return !!raw
    case 'string':
      return asString(raw)
    case 'enum':
      return asString(raw)
    default:
      return raw
  }
}

function setField(key: string, value: unknown) {
  state[key] = value
  emitChange()
}
</script>

<template>
  <div class="space-y-3">
    <div v-for="(spec, key) in specs" :key="key" class="flex flex-col gap-1">
      <label class="text-sm font-medium text-gray-700">
        {{ spec.label ?? key }}
        <span class="text-xs text-gray-400">({{ key }})</span>
      </label>

      <input
        v-if="spec.type === 'int' || spec.type === 'float'"
        :type="inputType(spec)"
        :min="spec.min"
        :max="spec.max"
        :step="spec.type === 'float' ? '0.01' : '1'"
        :value="state[key]"
        class="border rounded px-2 py-1 text-sm"
        @input="(e) => setField(key, Number((e.target as HTMLInputElement).value))"
      >

      <select
        v-else-if="spec.type === 'enum'"
        :value="state[key]"
        class="border rounded px-2 py-1 text-sm bg-white"
        @change="(e) => setField(key, (e.target as HTMLSelectElement).value)"
      >
        <option v-for="v in spec.values" :key="v" :value="v">{{ v }}</option>
      </select>

      <label v-else-if="spec.type === 'bool'" class="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          :checked="asBool(state[key])"
          @change="(e) => setField(key, (e.target as HTMLInputElement).checked)"
        >
        <span>{{ asBool(state[key]) ? 'true' : 'false' }}</span>
      </label>

      <input
        v-else-if="spec.type === 'string'"
        type="text"
        :maxlength="spec.maxLen"
        :value="state[key]"
        class="border rounded px-2 py-1 text-sm"
        @input="(e) => setField(key, (e.target as HTMLInputElement).value)"
      >

      <p v-if="spec.help" class="text-xs text-gray-500">{{ spec.help }}</p>
    </div>

    <details v-if="Object.keys(state).length > Object.keys(specs).length" class="text-xs">
      <summary class="cursor-pointer text-gray-500">Custom (unregistered) keys</summary>
      <div class="mt-2 space-y-1 pl-3">
        <div
          v-for="(_, key) in Object.fromEntries(Object.entries(state).filter(([k]) => !(k in specs)))"
          :key="`extra-${key}`"
          class="flex items-center gap-2"
        >
          <span class="font-mono">{{ key }}:</span>
          <span>{{ String(state[key]) }}</span>
        </div>
      </div>
    </details>
  </div>
</template>