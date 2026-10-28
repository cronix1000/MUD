<script setup lang="ts">
import { isEntityType } from '~/utils/entitySchemas'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const entityType = computed(() => String(route.params.type))
const entityId = computed(() => decodeURIComponent(String(route.params.id)))

if (!isEntityType(entityType.value)) {
  throw createError({ statusCode: 404, statusMessage: `Unknown entity type: ${entityType.value}` })
}

function backToList() {
  navigateTo(`/entities/${entityType.value}`)
}
</script>

<template>
  <AdminMobEditor v-if="entityType === 'mob'" :key="entityId" :entity-id="entityId" @close="backToList" />
  <AdminItemEditor v-else-if="entityType === 'item'" :key="entityId" :entity-id="entityId" @close="backToList" />
  <AdminLootTableEditor v-else-if="entityType === 'loot_table'" :key="entityId" :entity-id="entityId" @close="backToList" />
  <AdminInteractableEditor v-else-if="entityType === 'interactable'" :key="entityId" :entity-id="entityId" @close="backToList" />
  <AdminZoneEditor v-else-if="entityType === 'zone'" :key="entityId" :entity-id="entityId" @close="backToList" />
  <AdminDialogueEditor v-else-if="entityType === 'dialogue'" :key="entityId" :entity-id="entityId" @close="backToList" />
  <AdminRoomEditor v-else-if="entityType === 'room'" :key="entityId" :entity-id="entityId" @close="backToList" />
  <AdminRegionEditor v-else-if="entityType === 'region'" :key="entityId" :entity-id="entityId" @close="backToList" />
  <EntityDocEditor v-else :key="entityId" :entity-type="entityType" :entity-id="entityId" @close="backToList" />
</template>
