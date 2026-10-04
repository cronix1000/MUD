<script setup lang="ts">
const props = defineProps<{
  regionId: string
  regionName?: string
  existingZoneIds: number[]
}>()

const emit = defineEmits<{
  (e: 'created', zone: { region_id: string; zone_id: number; name: string }): void
  (e: 'close'): void
}>()

const open = ref(true)

const name = ref('')
const description = ref('')
const rulesJson = ref<string>('{"pvp":"safe","magic":"open","recall":"allow","summon":"block","respawn":{"rate":1800,"capacity":5},"instance_scope":"shared"}')
const zoneScriptRef = ref('')
const zoneIdInput = ref<number | null>(null)
const creating = ref(false)
const error = ref<string | null>(null)

watch(() => props.regionId, () => { suggestNextId() }, { immediate: true })

function suggestNextId() {
  if (props.existingZoneIds.length === 0) {
    zoneIdInput.value = 1
    return
  }
  const used = new Set(props.existingZoneIds)
  let n = 1
  while (used.has(n)) n++
  zoneIdInput.value = n
}

function close() {
  open.value = false
  emit('close')
}

async function submit() {
  if (!name.value.trim()) {
    error.value = 'Name is required'
    return
  }
  if (zoneIdInput.value === null || Number.isNaN(zoneIdInput.value) || zoneIdInput.value <= 0) {
    error.value = 'zone_id is required and must be a positive integer'
    return
  }
  if (props.existingZoneIds.includes(zoneIdInput.value)) {
    error.value = `Zone #${zoneIdInput.value} already exists in ${props.regionId}. Pick a different id.`
    return
  }
  let parsedRules: unknown = null
  try {
    parsedRules = JSON.parse(rulesJson.value)
  } catch {
    error.value = 'rules_json is not valid JSON'
    return
  }
  creating.value = true
  error.value = null
  try {
    await $fetch('/api/tables/world_zones', {
      method: 'POST',
      body: {
        region_id: props.regionId,
        zone_id: zoneIdInput.value,
        name: name.value.trim(),
        description: description.value || null,
        rules_json: JSON.stringify(parsedRules),
        zone_script_ref: zoneScriptRef.value.trim() || null,
        is_active: true,
      },
    })
    emit('created', { region_id: props.regionId, zone_id: zoneIdInput.value, name: name.value.trim() })
    open.value = false
  } catch (e: unknown) {
    const err = e as {
      statusCode?: number
      statusMessage?: string
      data?: { statusMessage?: string; data?: { hint?: string } }
    }
    error.value = err.data?.statusMessage ?? err.statusMessage ?? 'Create failed'
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-40 bg-black/60 flex items-start justify-center p-6 overflow-auto" @click.self="close">
    <div class="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-2xl shadow-xl">
      <div class="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <h3 class="text-base font-semibold">
          Add zone to <span class="font-mono text-sky-300">{{ regionId }}</span>
          <span v-if="regionName" class="text-neutral-400 font-normal">— {{ regionName }}</span>
        </h3>
        <button class="text-neutral-400 hover:text-white" aria-label="Close" @click="close">×</button>
      </div>

      <div class="p-4 space-y-3">
        <div v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ error }}</div>

        <div class="grid grid-cols-3 gap-3">
          <label class="block text-sm col-span-2">
            <span class="block text-neutral-400 mb-1">name</span>
            <input v-model="name" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
          </label>

          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">zone_id</span>
            <input
              v-model.number="zoneIdInput"
              type="number"
              min="1"
              class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono"
            />
          </label>
        </div>

        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">description</span>
          <textarea v-model="description" rows="2" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" />
        </label>

        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">zone_script_ref (optional — sets path = procedural)</span>
          <input
            v-model="zoneScriptRef"
            placeholder="e.g. regions/zones/dungeon_1"
            class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-xs"
          />
          <p class="text-xs text-neutral-500 mt-1">
            Path under <code>ModularMudServer/scripts/</code>. When set, rooms are generated on first player entry (per <code>instance_scope</code> in rules) instead of loaded from <code>world_rooms</code>.
          </p>
        </label>

        <div>
          <span class="block text-neutral-400 mb-1 text-sm">rules_json</span>
          <textarea
            v-model="rulesJson"
            rows="8"
            class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-xs"
            spellcheck="false"
          />
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-neutral-800">
        <button class="px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600 text-sm" @click="close">Cancel</button>
        <button
          class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50"
          :disabled="creating"
          @click="submit"
        >
          {{ creating ? 'Creating…' : 'Create zone' }}
        </button>
      </div>
    </div>
  </div>
</template>