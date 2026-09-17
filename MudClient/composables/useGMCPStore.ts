import { reactive } from "vue";

const gmcpState = reactive<Record<string, unknown>>({})
const subscribers = new Map<string, Set<(data:unknown) => void>>();

export function useGMCPStore() {
  function update(module: string, data: unknown): void {
    gmcpState[module] = data
    const set = subscribers.get(module)
    if (set) for (const cb of set) cb(data)
  }
function subscribe<T>(module: string, cb: (data: T) => void): () => void {
  if (!subscribers.has(module)) subscribers.set(module, new Set())
  const set = subscribers.get(module)!
  set.add(cb as (data: unknown) => void)
  return () => { set.delete(cb as (data: unknown) => void) }
}
  function latest<T = unknown>(module: string): T | undefined {
    return gmcpState[module] as T | undefined
  }
  return { update, subscribe, latest }
}

