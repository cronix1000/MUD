<script setup lang="ts">
import type { EntityFieldSpec } from '~/utils/entitySchemas'

const props = defineProps<{
  modelValue: Record<string, unknown>
  fields: EntityFieldSpec[]
}>()

const emit = defineEmits<{ 'update:modelValue': [Record<string, unknown>] }>()

function set(key: string, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
    <label v-for="sf in fields" :key="sf.key" class="block text-sm">
      <span class="block text-neutral-400 mb-1 font-mono text-xs">{{ sf.label ?? sf.key }}</span>
      <input
        v-if="sf.widget === 'number'"
        type="number"
        :step="sf.step ?? 1"
        :min="sf.min"
        :max="sf.max"
        :value="Number(modelValue[sf.key] ?? 0)"
        class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
        @input="set(sf.key, Number(($event.target as HTMLInputElement).value))"
      />
      <input
        v-else-if="sf.widget === 'text'"
        :value="String(modelValue[sf.key] ?? '')"
        :placeholder="sf.placeholder"
        class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
        @input="set(sf.key, ($event.target as HTMLInputElement).value)"
      />
      <select
        v-else-if="sf.widget === 'bool'"
        :value="modelValue[sf.key] === true ? 'true' : 'false'"
        class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
        @change="set(sf.key, ($event.target as HTMLSelectElement).value === 'true')"
      >
        <option value="false">false</option>
        <option value="true">true</option>
      </select>
    </label>
  </div>
</template>
