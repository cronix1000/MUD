<script setup lang="ts">
import { parseWiki, entityHref, ENTITY_COLORS, ENTITY_ICONS } from '~/utils/wikiParser'
import type { EntityType } from '~/utils/wikiParser'

const props = withDefaults(defineProps<{
  modelValue: string
  worldId?: string
  rows?: number
  placeholder?: string
  showPreview?: boolean
  showLabel?: boolean
}>(), {
  worldId: '',
  rows: 4,
  placeholder: 'Describe this. Use [[room:floor1::3]] to link to a room.',
  showPreview: true,
  showLabel: true,
})

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const text = ref(props.modelValue)
watch(() => props.modelValue, (v) => { text.value = v })

function onInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  text.value = target.value
  emit('update:modelValue', target.value)
}

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
  const target = e.target as HTMLTextAreaElement
  const pos = target.selectionStart ?? target.value.length
  const before = target.value.slice(0, pos)
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

  const matchedTypes = knownTypes.filter((t) => t.startsWith(partialType))
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
  if (!textareaRef.value) return
  const target = textareaRef.value
  const pos = target.selectionStart ?? target.value.length
  const before = text.value.slice(0, pos)
  const after = text.value.slice(pos)
  const newText = before + t + ':' + after
  text.value = newText
  emit('update:modelValue', newText)
  nextTick(() => {
    if (!textareaRef.value) return
    const newPos = pos + t.length + 1
    textareaRef.value.focus()
    textareaRef.value.setSelectionRange(newPos, newPos)
    detectTrigger({ target: textareaRef.value } as unknown as Event)
  })
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

function selectResult(r: SearchResult) {
  if (!textareaRef.value) return
  const target = textareaRef.value
  const before = text.value.slice(0, pickerStartPos.value)
  const after = text.value.slice(target.selectionStart)
  const insertText = `[[${r.type}:${r.id}]]`
  const newText = before + insertText + after
  text.value = newText
  emit('update:modelValue', newText)
  closePicker()
  nextTick(() => {
    if (!textareaRef.value) return
    const newPos = pickerStartPos.value + insertText.length
    textareaRef.value.focus()
    textareaRef.value.setSelectionRange(newPos, newPos)
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

const tokens = computed(() => parseWiki(text.value))

function entityDisplayName(type: EntityType, id: string): string {
  const map: Record<EntityType, string> = {
    room: id.split('::').pop() ? `#${id.split('::').pop()}` : id,
    npc: id.split('::').pop() ?? id,
    mob: id.split('::').pop() ?? id,
    item: id.split('::').pop() ?? id,
    quest: id.split('::').pop() ?? id,
    region: id.split('::').pop() ?? id,
    skill: id.split('::').pop() ?? id,
    recipe: id.split('::').pop() ?? id,
    interactable: id.split('::').pop() ?? id,
  }
  return map[type] ?? id
}

const knownTypes: EntityType[] = ['room', 'npc', 'mob', 'item', 'quest', 'region', 'skill', 'recipe', 'interactable']

function safeType(t: string): EntityType {
  return knownTypes.includes(t as EntityType) ? (t as EntityType) : 'item'
}
</script>

<template>
  <div>
    <div v-if="showLabel" class="text-xs text-neutral-400 mb-1">description</div>
    <div class="relative">
      <textarea
        ref="textareaRef"
        :value="text"
        :rows="rows"
        :placeholder="placeholder"
        class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
        @input="onInput"
        @keydown="onKey"
        @keyup="detectTrigger"
        @click="detectTrigger"
      />
      <div
        v-if="showPicker"
        class="absolute z-50 mt-1 w-full max-w-md bg-neutral-900 border border-emerald-700 rounded shadow-lg max-h-64 overflow-auto"
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
          <span
            class="text-xs font-mono px-1 rounded border"
            :class="ENTITY_COLORS[safeType(r.type)]"
          >{{ ENTITY_ICONS[safeType(r.type)] }} {{ r.type }}</span>
          <span class="font-mono text-neutral-200">{{ r.name }}</span>
        </button>
        <div v-if="!pickerType && !pickerResults.length && !fetching" class="px-2 py-3 text-sm text-neutral-500">
          <div class="mb-2">Pick one:</div>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="t in knownTypes"
              :key="t"
              class="px-2 py-0.5 text-xs font-mono rounded border hover:bg-neutral-800"
              :class="ENTITY_COLORS[t]"
              @mousedown.prevent="insertTypePrefix(t)"
            >{{ ENTITY_ICONS[t] }} {{ t }}</button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="showPreview && text" class="mt-2 text-sm leading-relaxed">
      <template v-for="(tok, i) in tokens" :key="i">
        <NuxtLink
          v-if="tok.type === 'link' && tok.entityType && tok.entityId"
          :to="entityHref(tok.entityType, tok.entityId)"
          class="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono rounded border mx-0.5"
          :class="ENTITY_COLORS[safeType(tok.entityType)]"
          :title="`${tok.entityType}: ${tok.entityId}`"
        >
          <span>{{ ENTITY_ICONS[safeType(tok.entityType)] }}</span>
          <span>{{ safeType(tok.entityType) }}: {{ entityDisplayName(tok.entityType, tok.entityId) }}</span>
        </NuxtLink>
        <span v-else>{{ tok.text }}</span>
      </template>
    </div>
    <div v-else-if="showPreview" class="mt-2 text-xs text-neutral-500 italic">
      Type [[ to link to another entity.
    </div>
  </div>
</template>
