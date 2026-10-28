<script setup lang="ts">
const props = defineProps<{
  title?: string
  collapsible?: boolean
}>()

const open = ref(true)
</script>

<template>
  <section class="bg-neutral-900 border border-neutral-800 rounded">
    <header
      v-if="title || $slots.actions"
      class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-neutral-800"
      :class="collapsible ? 'cursor-pointer select-none' : ''"
      @click="collapsible && (open = !open)"
    >
      <h3 class="text-xs uppercase tracking-wide text-neutral-400 font-semibold">{{ title }}</h3>
      <div class="flex items-center gap-2" @click.stop>
        <slot name="actions" />
        <span v-if="collapsible" class="text-neutral-500 text-xs">{{ open ? '▾' : '▸' }}</span>
      </div>
    </header>
    <div v-show="open" class="p-4">
      <slot />
    </div>
  </section>
</template>
