<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const route = useRoute()
const id = computed(() => Array.isArray(route.params.id) ? route.params.id.join('/') : String(route.params.id))
await navigateTo(`/entities/mob/${id.value}`, { replace: true })
</script>

<template>
  <div class="text-neutral-400">Mob editor moved to <NuxtLink :to="`/entities/mob/${id}`" class="text-sky-400 hover:underline">/entities/mob/{{ id }}</NuxtLink></div>
</template>
