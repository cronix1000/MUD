<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const route = useRoute()
const composite = computed(() => String(route.params.composite))

await navigateTo(`/entities/region/${encodeURIComponent(composite.value)}`, { replace: true })
</script>

<template>
  <div class="text-neutral-400 text-sm">Redirecting to the region editor…</div>
</template>
