<script setup lang="ts">
import { entityHref, ENTITY_COLORS, ENTITY_ICONS, knownTypes } from '~/utils/wikiParser'
import type { EntityType } from '~/utils/wikiParser'

const props = defineProps<{
  modelValue: string
  worldId?: string
  placeholder?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const text = ref(props.modelValue)
watch(() => props.modelValue, (v) => { text.value = v })

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  text.value = target.value
  emit('update:modelValue', target.value)
}

const knownEntityTypes: EntityType[] = ['room', 'npc', 'mob', 'item', 'quest', 'region', 'skill', 'recipe', 'interactable']

interface SearchResult { type: string; id: string; name: string; href: string }
const showPicker = ref(false)
const pickerQuery = ref('')
const pickerType = ref<EntityType | null>(null)
const pickerResults = ref<SearchResult[]>([])
const pickerIndex = ref(0)
const pickerStartPos = ref(0)
const fetching = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let lastFetchKey = ''

async function fetchResults(types: EntityType[], q: string) {
  if (!types.length) {
    pickerResults.value = []
    return
  }
  const fetchKey = `${types.join(',')}|${q}|${props.worldId}`
  if (fetchKey === lastFetchKey) return
  lastFetchKey = fetchKey
  fetching.value = true
  try {
    const url = new URL('/api/search/entities', window.location.origin)
    url.searchParams.set('type', types[0]!)
    if (q) url.searchParams.set('q', q)
    if (props.worldId) url.searchParams.set('world_id', props.worldId)
    const res = await $fetch<{ results: SearchResult[] }>(url.pathname + url.search)
    pickerResults.value = res.results
    pickerIndex.value = 0
  } finally {
    fetching.value = false
  }
}

function scheduleFetch(types: EntityType[], q: string) {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => fetchResults(types, q), 80)
}

function detectTrigger(e: Event) {
  const target = e.target as HTMLInputElement
  const pos = target.selectionStart ?? target.value.length
  const before = text.value.slice(0, pos)
  const match = /\[\[([a-z]+)?(:([^\]\n]*))?$/.exec(before)
  if (!match) {
    showPicker.value = false
    return
  }
  const partialType = match[1] ?? ''
  const query = match[3] ?? ''
  pickerStartPos.value = pos - match[0].length
  pickerQuery.value = query
  showPicker.value = true

  if (!partialType) {
    pickerType.value = null
    pickerResults.value = []
    return
  }

  const matchedTypes = knownEntityTypes.filter((t) => t.startsWith(partialType))
  if (!matchedTypes.length) {
    pickerType.value = null
    pickerResults.value = []
    return
  }
  pickerType.value = matchedTypes[0] ?? null
  scheduleFetch(matchedTypes, query)
}

function closePicker() {
  showPicker.value = false
  pickerResults.value = []
  pickerType.value = null
  pickerQuery.value = ''
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  lastFetchKey = ''
}

function insertTypePrefix(t: EntityType) {
  const target = inputRef.value
  if (!target) return
  const pos = target.selectionStart ?? target.value.length
  const before = text.value.slice(0, pos)
  const after = text.value.slice(pos)
  const newText = before + t + ':' + after
  text.value = newText
  emit('update:modelValue', newText)
  nextTick(() => {
    if (!inputRef.value) return
    const newPos = pos + t.length + 1
    inputRef.value.focus()
    inputRef.value.setSelectionRange(newPos, newPos)
    detectTrigger({ target: inputRef.value } as unknown as Event)
  })
}

function selectResult(r: SearchResult) {
  const target = inputRef.value
  if (!target) return
  const before = text.value.slice(0, pickerStartPos.value)
  const after = text.value.slice(target.selectionStart ?? text.value.length)
  const insertText = `[[${r.type}:${r.id}]]`
  const newText = before + insertText + after
  text.value = newText
  emit('update:modelValue', newText)
  closePicker()
  nextTick(() => {
    if (!inputRef.value) return
    const newPos = pickerStartPos.value + insertText.length
    inputRef.value.focus()
    inputRef.value.setSelectionRange(newPos, newPos)
  })
}

function moveSelection(delta: number) {
  if (!pickerResults.value.length) return
  pickerIndex.value = (pickerIndex.value + delta + pickerResults.value.length) % pickerResults.value.length
}

function onKey(e: KeyboardEvent) {
  if (!showPicker.value) return
  if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(-1) }
  else if (e.key === 'Enter') {
    e.preventDefault()
    const r = pickerResults.value[pickerIndex.value]
    if (r) selectResult(r)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    closePicker()
  }
}

function safeType(t: string): EntityType {
  return knownTypes.includes(t as EntityType) ? (t as EntityType) : 'item'
}

const inputRef = ref<HTMLInputElement | null>(null)

function badgeFor(value: string): { type: EntityType; id: string } | null {
  const m = /^\[\[([a-z]+):([^\]]+)\]\]$/.exec(value.trim())
  if (!m || !m[1] || !m[2]) return null
  return { type: m[1] as EntityType, id: m[2] }
}

const badge = computed(() => badgeFor(text.value))

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<template>
  <div class="relative">
    <input
      ref="inputRef"
      :value="text"
      :placeholder="placeholder"
      class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
      @input="onInput"
      @keydown="onKey"
      @keyup="detectTrigger"
      @click="detectTrigger"
    />
    <NuxtLink
      v-if="badge"
      :to="entityHref(badge.type, badge.id)"
      target="_blank"
      class="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono rounded border"
      :class="ENTITY_COLORS[safeType(badge.type)]"
      :title="`${badge.type}: ${badge.id} (click to open)`"
    >
      <span>{{ ENTITY_ICONS[safeType(badge.type)] }}</span>
      <span>{{ badge.id.split('::').pop() }}</span>
    </NuxtLink>
    <div
      v-if="showPicker"
      class="absolute z-50 mt-1 w-full max-w-md bg-neutral-900 border border-emerald-700 rounded shadow-lg max-h-72 overflow-auto"
    >
      <div class="px-2 py-1 text-xs text-neutral-500 border-b border-neutral-800 flex items-center gap-2">
        <template v-if="pickerResults.length">{{ pickerResults.length }} result(s) for [[{{ pickerType }}:{{ pickerQuery || '…' }}]]</template>
        <template v-else-if="fetching">searching…</template>
        <template v-else-if="pickerType">no {{ pickerType }}s match '{{ pickerQuery }}' — try a shorter query</template>
        <template v-else>pick a type to browse:</template>
      </div>
      <button
        v-for="(r, i) in pickerResults"
        :key="`${r.type}-${r.id}`"
        class="w-full text-left px-2 py-1 text-sm hover:bg-neutral-800 flex items-center gap-2"
        :class="i === pickerIndex ? 'bg-neutral-800' : ''"
        @mousedown.prevent="selectResult(r)"
        @mouseenter="pickerIndex = i"
      >
        <span class="text-xs font-mono px-1 rounded border" :class="ENTITY_COLORS[safeType(r.type)]">{{ ENTITY_ICONS[safeType(r.type)] }} {{ r.type }}</span>
        <span class="font-mono text-neutral-200">{{ r.name }}</span>
      </button>
      <div v-if="!pickerType && !pickerResults.length && !fetching" class="px-2 py-3 text-sm text-neutral-500">
        <div class="mb-2">Pick one:</div>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="t in knownEntityTypes"
            :key="t"
            class="px-2 py-0.5 text-xs font-mono rounded border hover:bg-neutral-800"
            :class="ENTITY_COLORS[t]"
            @mousedown.prevent="insertTypePrefix(t)"
          >{{ ENTITY_ICONS[t] }} {{ t }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
