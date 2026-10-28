<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  refType: string
  placeholder?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [string] }>()

interface EntityListResponse {
  rows: Array<{ entity_id: string; doc: Record<string, unknown> }>
}

const { data } = useFetch<EntityListResponse>(
  () => `/api/entities/${props.refType}`,
  { query: { limit: 500 } },
)

const options = computed(() =>
  (data.value?.rows ?? []).map((r) => ({
    id: r.entity_id,
    name: typeof r.doc.name === 'string' ? r.doc.name : r.entity_id,
  })),
)

const exists = computed(() => options.value.some((o) => o.id === props.modelValue))
const matched = computed(() => options.value.find((o) => o.id === props.modelValue))
const datalistId = computed(() => `ref-datalist-${props.refType}`)
</script>

<template>
  <div class="flex items-center gap-2">
    <input
      :value="modelValue"
      :list="datalistId"
      :placeholder="placeholder ?? refType"
      class="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
      :class="{ 'border-red-700': modelValue && !exists }"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <datalist :id="datalistId">
      <option v-for="o in options" :key="o.id" :value="o.id">{{ o.name }}</option>
    </datalist>
    <NuxtLink
      v-if="modelValue && exists"
      :to="`/entities/${refType}/${encodeURIComponent(modelValue)}`"
      class="text-xs text-sky-400 hover:underline flex-shrink-0"
      title="Open referenced entity"
    >{{ matched?.name ?? 'open' }} →</NuxtLink>
    <span v-else-if="modelValue" class="text-xs text-red-400 flex-shrink-0">missing</span>
  </div>
</template>
