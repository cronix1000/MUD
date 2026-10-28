<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
}>(), {
  variant: 'ghost',
  size: 'md',
  loading: false,
  disabled: false,
  type: 'button',
})

const variantClass = computed(() => ({
  primary: 'bg-emerald-700 hover:bg-emerald-600 text-white',
  ghost: 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200',
  danger: 'bg-red-900/70 hover:bg-red-800 text-red-100',
}[props.variant]))

const sizeClass = computed(() => (props.size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'))
</script>

<template>
  <button
    :type="type"
    class="rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
    :class="[variantClass, sizeClass]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
    <slot />
  </button>
</template>
