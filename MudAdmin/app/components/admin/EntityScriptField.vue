<script setup lang="ts">
import type { ScriptKind } from '~/utils/entitySchemas'

const props = defineProps<{
  modelValue: string
  kind: ScriptKind
}>()

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const showBrowse = ref(false)
const scriptRoot = ref('')
const validateResults = ref<Array<{ path: string; ok: boolean; error?: string; missing?: boolean }> | null>(null)
const validating = ref(false)

onMounted(async () => {
  try {
    const res = await $fetch<{ root: string }>('/api/scripts/root')
    scriptRoot.value = res.root
  } catch {
    scriptRoot.value = ''
  }
})

function pick(path: string) {
  emit('update:modelValue', path)
  showBrowse.value = false
}

function vscodeUrl(path: string): string {
  const abs = scriptRoot.value ? `${scriptRoot.value.replace(/\\/g, '/')}/${path}` : path
  return `vscode://file/${encodeURI(abs).replace(/^\//, '')}`
}

async function validate() {
  if (!props.modelValue) return
  validating.value = true
  validateResults.value = null
  try {
    const res = await $fetch<{ results: typeof validateResults.value }>(`/api/scripts/validate`, {
      method: 'POST',
      body: { paths: [props.modelValue] },
    })
    validateResults.value = res.results
  } finally {
    validating.value = false
  }
}
</script>

<template>
  <div class="space-y-1.5">
    <div class="flex gap-1">
      <input
        :value="modelValue"
        placeholder="scripts/… path"
        class="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <button type="button" class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded" @click="showBrowse = true">…</button>
    </div>
    <div v-if="modelValue" class="flex items-center gap-3 text-xs">
      <a :href="vscodeUrl(modelValue)" target="_blank" class="text-sky-400 hover:underline">open in VSCode</a>
      <button type="button" class="text-emerald-400 hover:underline disabled:opacity-50" :disabled="validating" @click="validate">
        {{ validating ? 'Checking…' : 'Validate syntax' }}
      </button>
      <span v-if="validateResults?.[0]" :class="validateResults[0].ok ? 'text-emerald-400' : 'text-red-400'">
        {{ validateResults[0].ok ? 'OK' : validateResults[0].error ?? 'ERROR' }}
      </span>
    </div>
    <AdminScriptBrowseModal v-if="showBrowse" :kind="kind" @pick="pick" @close="showBrowse = false" />
  </div>
</template>
