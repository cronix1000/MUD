<template>
    <div class="relative w-full" @mousemove="onDrag" @mouseup="endDrag" @mousedown="startDrag(item)">
        <div ref="target"
            class="absolute border border-dashed border-gray-400 p-4 bg-white shadow-sm cursor-move select-none"
            :style="{ width: '200px', height: '150px' }">
            <slot> Drag and resize me</slot>
        </div>
        <ClientOnly>
            <Moveable v-if="target" :target="target" :draggable="true" :resizable="true" :snappable="true"
                :elementGuidelines="guidelines" :snapThreshold="5" :isDisplaySnapElements="true" :snapDigit="0"
                :grid="[20, 20]" @drag="onDrag" @resize="onResize" />
        </ClientOnly>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import Moveable from 'vue3-moveable';

const target = ref(null)
const guidelines = ref([])

onMounted(() => {
    if (target.value?.parentElements) {
        guidelines.value = [target.value.parentElements];
    }
})

const onDrag = ({ transform }) => {
    target.value.style.transform = transform
}

const onResize = ({ width, height, dist, delta, transform }) => {
  target.value.style.width = `${width}px`
  target.value.style.height = `${height}px`
  target.value.style.transform = transform
}
</script>
