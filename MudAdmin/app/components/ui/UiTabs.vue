<script setup lang="ts">
export interface UiTabItem {
  key: string
  label: string
}

defineProps<{
  tabs: UiTabItem[]
  modelValue: string
}>()

const emit = defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <div class="flex items-center gap-1 border-b border-neutral-800 -mb-px flex-wrap">
    <button
      v-for="t in tabs"
      :key="t.key"
      type="button"
      class="px-3 py-1.5 text-sm rounded-t border border-b-0 -mb-px font-medium"
      :class="modelValue === t.key
        ? 'bg-neutral-900 border-neutral-800 text-emerald-400'
        : 'bg-transparent border-transparent text-neutral-400 hover:text-neutral-200'"
      @click="emit('update:modelValue', t.key)"
    >
      {{ t.label }}
    </button>
  </div>
</template>
