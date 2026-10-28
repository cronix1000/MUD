<script setup lang="ts">
import { ANSI_COLORS, ANSI_BG_COLORS } from '~/utils/ansi'

const props = withDefaults(defineProps<{
  modelValue: string
  background?: boolean
}>(), {
  background: false,
})

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const colors = computed(() => (props.background ? ANSI_BG_COLORS : ANSI_COLORS))

const swatchText = computed(() => (props.background ? '  ' : 'A'))
</script>

<template>
  <div class="flex items-center gap-2">
    <select
      :value="modelValue ?? ''"
      class="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="background" value="">— none —</option>
      <option v-for="c in colors" :key="c.code" :value="c.code">{{ c.code }} {{ c.label }}</option>
    </select>
    <span
      class="w-7 h-7 inline-flex items-center justify-center font-mono text-sm rounded border border-neutral-700 flex-shrink-0"
      :style="background
        ? { backgroundColor: modelValue ? (colors.find((c) => c.code === modelValue)?.css ?? '#1a1a1a') : '#1a1a1a' }
        : { color: colors.find((c) => c.code === modelValue)?.css ?? '#d4d4d4', backgroundColor: '#1a1a1a' }"
    >{{ swatchText }}</span>
  </div>
</template>
