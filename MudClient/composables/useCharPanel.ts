import { onUnmounted, ref } from 'vue'
import { useGMCPStore } from '~/composables/useGMCPStore'

export function useCharPanel() {
    const store = useGMCPStore();
    const vitals = ref(store.latest('Char.Vitals'))
    const name = ref(store.latest('Char.Name'))

    const unsubV = store.subscribe<{ hp: number; max_hp: number; mp: number; max_mp: number }>(
    'Char.Vitals',
    (d) => { vitals.value = d }
  )
  const unsubN = store.subscribe<{ name: string }>('Char.Name', (d) => { name.value = d })
  onUnmounted(() => { unsubV(); unsubN() })
  return { vitals, name }
}