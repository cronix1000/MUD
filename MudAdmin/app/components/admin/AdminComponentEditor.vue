<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  COMPONENT_PRESETS,
  COMPONENT_REGISTRY,
  INTERACTABLE_OVERRIDE_ACTIONS,
  type ComponentArchetype,
  type ComponentPreset,
  type ComponentSpec,
  getDefaultForSpec,
  getComponentSpec,
} from '~/utils/componentRegistry'
import AdminMetaEditor from './MetaEditor.vue'

const props = defineProps<{
  archetype: ComponentArchetype
  row: Record<string, unknown>
  modelValue: Record<string, unknown> | null | undefined
}>()

const emit = defineEmits<{
  'update:modelValue': [Record<string, unknown>]
}>()

const state = reactive<Record<string, unknown>>({})

let hydrated = false

function hydrate(saved: Record<string, unknown> | null | undefined) {
  for (const k of Object.keys(state)) delete state[k]
  if (!saved) {
    hydrated = true
    return
  }
  for (const [k, v] of Object.entries(saved)) {
    state[k] = v
  }
  hydrated = true
}

watch(
  () => props.modelValue,
  (saved) => hydrate(saved),
  { immediate: true },
)

watch(
  () => props.archetype,
  () => hydrate(props.modelValue),
)

function emitChange() {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(state)) {
    if (v === null || v === undefined) continue
    if (Array.isArray(v) && v.length === 0) continue
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) continue
    out[k] = v
  }
  emit('update:modelValue', out)
}

function presentKeys(): Set<string> {
  return new Set(Object.keys(state))
}

const visibleComponents = computed<ComponentSpec[]>(() => {
  return COMPONENT_REGISTRY[props.archetype].filter((c) => {
    if (!presentKeys().has(c.key)) return false
    if (c.appliesWhen && !c.appliesWhen(props.row)) return false
    return true
  })
})

const addableComponents = computed<ComponentSpec[]>(() => {
  return COMPONENT_REGISTRY[props.archetype].filter((c) => {
    if (presentKeys().has(c.key)) return false
    if (c.appliesWhen && !c.appliesWhen(props.row)) return false
    return true
  })
})

const unknownKeys = computed<string[]>(() => {
  const known = new Set(COMPONENT_REGISTRY[props.archetype].map((c) => c.key))
  return Object.keys(state).filter((k) => !known.has(k))
})

function addComponent(spec: ComponentSpec) {
  state[spec.key] = getDefaultForSpec(spec)
  emitChange()
}

function removeComponent(key: string) {
  delete state[key]
  emitChange()
}

function setComponentValue(key: string, value: unknown) {
  state[key] = value
  emitChange()
}

function setFieldInComponent(componentKey: string, fieldKey: string, value: unknown) {
  const cur = state[componentKey]
  if (typeof cur !== 'object' || cur === null || Array.isArray(cur)) {
    return
  }
  state[componentKey] = { ...(cur as Record<string, unknown>), [fieldKey]: value }
  emitChange()
}

function readScalarObject(componentKey: string): Record<string, unknown> | null {
  const cur = state[componentKey]
  if (typeof cur !== 'object' || cur === null || Array.isArray(cur)) return null
  return cur as Record<string, unknown>
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

function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v.slice()
  if (v === null || v === undefined || v === '') return []
  return [v]
}

function presetsAvailable(componentKey: string): ComponentPreset[] {
  return COMPONENT_PRESETS[props.archetype]?.[componentKey] ?? []
}

function applyPreset(componentKey: string, preset: ComponentPreset) {
  const spec = getComponentSpec(props.archetype, componentKey)
  if (!spec) return
  if (componentKey === 'meta') {
    state[componentKey] = { ...preset.values }
    emitChange()
    return
  }
  if (spec.shape === 'array<string') {
    const arr = Array.isArray(preset.values.value) ? preset.values.value as unknown[] : []
    state[componentKey] = arr.slice()
    emitChange()
    return
  }
  const cur = state[componentKey]
  const base = typeof cur === 'object' && cur !== null && !Array.isArray(cur)
    ? { ...(cur as Record<string, unknown>) }
    : {}
  for (const [k, v] of Object.entries(preset.values)) {
    base[k] = v
  }
  state[componentKey] = base
  emitChange()
}

function readArray(componentKey: string): string[] {
  const cur = state[componentKey]
  if (!Array.isArray(cur)) return []
  return cur.map((x) => x === null || x === undefined ? '' : String(x))
}

function readArrayForRender(componentKey: string): string[] {
  const arr = readArray(componentKey)
  return arr.length > 0 ? arr : ['']
}

function setArrayValue(componentKey: string, next: string[]) {
  state[componentKey] = next
  emitChange()
}

function addArrayItem(componentKey: string) {
  setArrayValue(componentKey, [...readArray(componentKey), ''])
}

function removeArrayItem(componentKey: string, idx: number) {
  const arr = readArray(componentKey)
  arr.splice(idx, 1)
  setArrayValue(componentKey, arr)
}

function onRemoveArrayItem(componentKey: string, idx: number) {
  const arr = readArray(componentKey)
  if (arr.length <= 1) {
    setArrayValue(componentKey, [''])
    return
  }
  removeArrayItem(componentKey, idx)
}

function setArrayItem(componentKey: string, idx: number, value: string) {
  const arr = readArray(componentKey)
  arr[idx] = value
  setArrayValue(componentKey, arr)
}

function readOverrides(componentKey: string): Record<string, string[]> {
  const cur = state[componentKey]
  if (typeof cur !== 'object' || cur === null || Array.isArray(cur)) return {}
  const out: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(cur as Record<string, unknown>)) {
    if (!Array.isArray(v)) continue
    out[k] = v.map((x) => x === null || x === undefined ? '' : String(x))
  }
  return out
}

function overridesActions(componentKey: string): string[] {
  return Object.keys(readOverrides(componentKey)).sort()
}

function readOverridesAction(componentKey: string, action: string): string[] {
  const ov = readOverrides(componentKey)
  return ov[action] ?? []
}

function readOverridesForRender(componentKey: string, action: string): string[] {
  const arr = readOverridesAction(componentKey, action)
  return arr.length > 0 ? arr : ['']
}

function setOverridesMap(componentKey: string, next: Record<string, string[]>) {
  for (const k of Object.keys(state[componentKey] ?? {})) {
    delete (state[componentKey] as Record<string, unknown>)[k]
  }
  const out: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(next)) {
    const filtered = v.map((x) => String(x)).filter((s) => s.length > 0)
    if (filtered.length === 0) continue
    out[k] = filtered
  }
  state[componentKey] = out
  emitChange()
}

const newOverridesAction = ref('')
const newOverridesCustom = ref('')

function addOverridesAction(componentKey: string) {
  const custom = newOverridesCustom.value.trim()
  const picked = newOverridesAction.value
  const action = custom || picked
  if (!action) return
  const ov = readOverrides(componentKey)
  if (Object.prototype.hasOwnProperty.call(ov, action)) {
    newOverridesAction.value = ''
    newOverridesCustom.value = ''
    return
  }
  ov[action] = []
  setOverridesMap(componentKey, ov)
  newOverridesAction.value = ''
  newOverridesCustom.value = ''
}

function removeOverridesAction(componentKey: string, idx: number) {
  const ov = readOverrides(componentKey)
  const key = overridesActions(componentKey)[idx]
  if (!key) return
  delete ov[key]
  setOverridesMap(componentKey, ov)
}

function addOverridesMessage(componentKey: string, action: string) {
  const ov = readOverrides(componentKey)
  ov[action] = [...(ov[action] ?? []), '']
  setOverridesMap(componentKey, ov)
}

function setOverridesMessage(componentKey: string, action: string, idx: number, value: string) {
  const ov = readOverrides(componentKey)
  const arr = ov[action] ?? []
  arr[idx] = value
  ov[action] = arr
  setOverridesMap(componentKey, ov)
}

function removeOverridesMessage(componentKey: string, action: string, idx: number) {
  const ov = readOverrides(componentKey)
  const arr = ov[action] ?? []
  arr.splice(idx, 1)
  ov[action] = arr
  setOverridesMap(componentKey, ov)
}

function overridesPlaceholder(action: string): string {
  if (action === 'look') return 'e.g. A dragon blade etched with runes lies here.'
  if (action === 'inspect') return 'e.g. The blade gleams with ancient frost.'
  if (action === 'use') return 'e.g. The chalice hums softly under your touch.'
  if (action === 'equip') return 'e.g. The dragon blade clamps onto your arms — you feel the chill.'
  if (action === 'unequip') return 'e.g. The chill fades as you release the blade.'
  if (action === 'drop') return 'e.g. The blade clatters against the floor.'
  return 'Override message — tokens {name}, {slot}, {charges}, {wielder}, {level}'
}

const dirty = ref(false)
watch(state, () => { dirty.value = true }, { deep: true })
defineExpose({ markClean: () => { dirty.value = false } })
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="spec in visibleComponents"
      :key="spec.key"
      class="bg-neutral-900 border border-neutral-800 rounded p-3"
    >
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <h4 class="text-sm font-semibold">{{ spec.label }}</h4>
          <span class="text-xs text-neutral-500 font-mono">{{ spec.key }}</span>
        </div>
        <div class="flex items-center gap-2">
          <details v-if="presetsAvailable(spec.key).length" class="relative">
            <summary class="text-xs px-2 py-1 border border-neutral-700 rounded cursor-pointer list-none">
              Apply preset ▾
            </summary>
            <div class="absolute right-0 mt-1 z-50 bg-neutral-950 border border-emerald-700 rounded shadow-lg min-w-[180px]">
              <button
                v-for="p in presetsAvailable(spec.key)"
                :key="p.id"
                type="button"
                class="w-full text-left px-3 py-1.5 text-sm hover:bg-neutral-800"
                @click="applyPreset(spec.key, p)"
              >{{ p.label }}</button>
            </div>
          </details>
          <button
            type="button"
            class="text-xs text-red-400 hover:text-red-300 px-2 py-1"
            @click="removeComponent(spec.key)"
          >remove</button>
        </div>
      </div>

      <AdminMetaEditor
        v-if="spec.key === 'meta'"
        :entity-type="archetype"
        :model-value="(state['meta'] as Record<string, unknown>) ?? {}"
        @update:model-value="(v) => setComponentValue('meta', v)"
      />

      <div v-else-if="spec.shape === 'array<string'" class="space-y-1">
        <div
          v-for="(_, idx) in readArrayForRender(spec.key)"
          :key="`${spec.key}-${idx}`"
          class="flex items-center gap-1"
        >
          <select
            v-if="spec.itemValues && spec.itemValues.length"
            :value="asString(readArray(spec.key)[idx] ?? '')"
            class="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm flex-1"
            @change="(e) => setArrayItem(spec.key, idx, (e.target as HTMLSelectElement).value)"
          >
            <option value="">— pick —</option>
            <option v-for="v in spec.itemValues" :key="v" :value="v">{{ v }}</option>
          </select>
          <input
            v-else
            type="text"
            :maxlength="spec.itemMaxLen"
            :value="asString(readArray(spec.key)[idx] ?? '')"
            class="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm flex-1"
            @input="(e) => setArrayItem(spec.key, idx, (e.target as HTMLInputElement).value)"
          >
          <button
            type="button"
            class="px-2 py-1 text-xs text-red-400 hover:text-red-300"
            @click="onRemoveArrayItem(spec.key, idx)"
          >×</button>
        </div>
        <button
          type="button"
          class="px-2 py-1 text-xs border border-neutral-700 rounded hover:bg-neutral-800"
          @click="addArrayItem(spec.key)"
        >+ add element</button>
      </div>

      <div v-else-if="spec.key === 'overrides'" class="space-y-2">
        <p class="text-xs text-neutral-500">
          Per-action override messages. Multiple messages per action are pooled and picked deterministically per entity + tick (InteractionMessage.cpp:7). Tokens: <code>{name}</code>, <code>{slot}</code>, <code>{charges}</code>, <code>{wielder}</code>, <code>{level}</code>.
        </p>
        <div v-if="overridesActions(spec.key).length === 0" class="text-xs text-neutral-500 italic">
          No actions yet — add one below.
        </div>
        <div
          v-for="(action, aIdx) in overridesActions(spec.key)"
          :key="`${spec.key}-${action}`"
          class="bg-neutral-950 border border-neutral-800 rounded p-2 space-y-2"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="font-mono text-sm px-2 py-0.5 rounded bg-emerald-900/40 border border-emerald-700/50 text-emerald-300">{{ action }}</span>
              <span class="text-xs text-neutral-500">{{ readOverridesAction(spec.key, action).length }} message(s)</span>
            </div>
            <button type="button" class="text-xs text-red-400 hover:text-red-300" @click="removeOverridesAction(spec.key, aIdx)">× action</button>
          </div>
          <div class="space-y-1">
            <div
              v-for="(_, mIdx) in readOverridesForRender(spec.key, action)"
              :key="`${spec.key}-${action}-${mIdx}`"
              class="flex items-start gap-1"
            >
              <textarea
                :value="asString(readOverridesAction(spec.key, action)[mIdx] ?? '')"
                rows="2"
                class="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono"
                :placeholder="overridesPlaceholder(action)"
                @input="(e) => setOverridesMessage(spec.key, action, mIdx, (e.target as HTMLTextAreaElement).value)"
              />
              <button
                type="button"
                class="px-2 py-1 text-xs text-red-400 hover:text-red-300"
                @click="removeOverridesMessage(spec.key, action, mIdx)"
              >×</button>
            </div>
            <button
              type="button"
              class="px-2 py-1 text-xs border border-neutral-700 rounded hover:bg-neutral-800"
              @click="addOverridesMessage(spec.key, action)"
            >+ add message</button>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap pt-1">
          <span class="text-xs text-neutral-500">+ Add action:</span>
          <select
            :value="newOverridesAction"
            class="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs"
            @change="(e) => newOverridesAction = (e.target as HTMLSelectElement).value"
          >
            <option value="">— pick —</option>
            <option
              v-for="a in INTERACTABLE_OVERRIDE_ACTIONS"
              :key="a"
              :value="a"
              :disabled="overridesActions(spec.key).includes(a)"
            >{{ a }}</option>
          </select>
          <input
            v-model="newOverridesCustom"
            type="text"
            maxlength="40"
            placeholder="custom action (free-form)"
            class="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"
          />
          <button
            type="button"
            class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded"
            @click="addOverridesAction(spec.key)"
          >add</button>
        </div>
      </div>

      <div v-else-if="readScalarObject(spec.key)" class="grid grid-cols-2 gap-3">
        <template v-for="f in (spec.fields ?? [])" :key="f.key">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-neutral-400">
              {{ f.label ?? f.key }}
              <span class="text-neutral-600 font-mono">({{ f.key }})</span>
            </span>

            <input
              v-if="f.type === 'int' || f.type === 'float'"
              type="number"
              :min="f.min"
              :max="f.max"
              :step="f.type === 'float' ? '0.01' : '1'"
              :value="asNumber(readScalarObject(spec.key)![f.key], 0)"
              class="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm"
              @input="(e) => setFieldInComponent(spec.key, f.key, Number((e.target as HTMLInputElement).value))"
            >

            <select
              v-else-if="f.type === 'enum'"
              :value="asString(readScalarObject(spec.key)![f.key])"
              class="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm"
              @change="(e) => setFieldInComponent(spec.key, f.key, (e.target as HTMLSelectElement).value)"
            >
              <option v-for="v in f.values" :key="v" :value="v">{{ v }}</option>
            </select>

            <label v-else-if="f.type === 'bool'" class="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                :checked="asBool(readScalarObject(spec.key)![f.key])"
                @change="(e) => setFieldInComponent(spec.key, f.key, (e.target as HTMLInputElement).checked)"
              >
              <span>{{ asBool(readScalarObject(spec.key)![f.key]) ? 'true' : 'false' }}</span>
            </label>

            <input
              v-else-if="f.type === 'string'"
              type="text"
              :maxlength="f.maxLen"
              :value="asString(readScalarObject(spec.key)![f.key])"
              class="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm"
              @input="(e) => setFieldInComponent(spec.key, f.key, (e.target as HTMLInputElement).value)"
            >

            <p v-if="f.help" class="text-xs text-neutral-500">{{ f.help }}</p>
          </label>
        </template>
      </div>

      <p v-if="spec.help" class="mt-2 text-xs text-neutral-500">{{ spec.help }}</p>
    </div>

    <div v-if="addableComponents.length" class="flex items-center gap-2 flex-wrap">
      <span class="text-xs text-neutral-500">+ Add component:</span>
      <button
        v-for="c in addableComponents"
        :key="c.key"
        type="button"
        class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded font-mono"
        @click="addComponent(c)"
      >{{ c.label }}</button>
    </div>

    <details v-if="unknownKeys.length" class="bg-neutral-900 border border-neutral-800 rounded p-3">
      <summary class="text-xs text-neutral-400 cursor-pointer">
        Unrecognized components ({{ unknownKeys.length }}) — preserved as-is on save
      </summary>
      <div class="mt-2 space-y-2 text-xs font-mono">
        <div v-for="k in unknownKeys" :key="`unk-${k}`">
          <div class="text-neutral-500">{{ k }}:</div>
          <pre class="bg-neutral-950 p-2 rounded overflow-auto max-h-32"><code>{{ JSON.stringify(state[k], null, 2) }}</code></pre>
        </div>
      </div>
    </details>
  </div>
</template>