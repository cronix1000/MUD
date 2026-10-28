<script setup lang="ts">
export interface ConfirmOptions {
  title: string
  body?: string
  confirmLabel?: string
  danger?: boolean
}

const visible = ref(false)
const options = ref<ConfirmOptions>({ title: '' })
let resolver: ((ok: boolean) => void) | null = null

function ask(opts: ConfirmOptions): Promise<boolean> {
  options.value = opts
  visible.value = true
  return new Promise((resolve) => {
    resolver = resolve
  })
}

function settle(ok: boolean) {
  visible.value = false
  resolver?.(ok)
  resolver = null
}

defineExpose({ ask })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4"
      @keydown.escape="settle(false)"
    >
      <div class="bg-neutral-900 border border-neutral-700 rounded-lg max-w-md w-full p-4 space-y-4" role="dialog" aria-modal="true">
        <h3 class="text-base font-semibold text-neutral-100">{{ options.title }}</h3>
        <p v-if="options.body" class="text-sm text-neutral-300 whitespace-pre-line">{{ options.body }}</p>
        <div class="flex justify-end gap-2">
          <UiButton size="sm" @click="settle(false)">Cancel</UiButton>
          <UiButton
            size="sm"
            :variant="options.danger ? 'danger' : 'primary'"
            @click="settle(true)"
          >
            {{ options.confirmLabel ?? 'Confirm' }}
          </UiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
