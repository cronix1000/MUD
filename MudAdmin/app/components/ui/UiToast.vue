<script setup lang="ts">
const { toasts, dismiss } = useToast()

const kindClass = computed(() => ({
  success: 'bg-emerald-900/80 border-emerald-600 text-emerald-100',
  error: 'bg-red-900/80 border-red-600 text-red-100',
  info: 'bg-neutral-800 border-neutral-600 text-neutral-100',
}))
</script>

<template>
  <div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="pointer-events-auto border rounded px-3 py-2 text-sm shadow-lg flex items-start justify-between gap-3"
        :class="kindClass[t.kind]"
        role="status"
      >
        <span>{{ t.message }}</span>
        <button class="text-xs opacity-70 hover:opacity-100" @click="dismiss(t.id)">✕</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.15s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
