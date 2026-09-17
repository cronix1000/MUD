import { ref, type Ref } from 'vue'

export type MudSocketStatus = 'connecting' | 'open' | 'closed'

export type MudEnvelope =
  | { channel: 'text'; data: string }
  | { channel: 'gmcp'; module: string; data: unknown; text?: string }
  | { channel: 'negotiate'; option: string; state: string }
  | { channel: 'error'; message: string }

type EnvelopeCallback = (env: MudEnvelope) => void
type RawCallback = (raw: string) => void

export interface MudSocket {
  status: Ref<MudSocketStatus>
  send: (data: string) => void
  sendGMCP: (module: string, data: unknown) => void
  onEnvelope: (cb: EnvelopeCallback) => () => void
  onRaw: (cb: RawCallback) => () => void
  onMessage: (cb: RawCallback) => () => void
  close: () => void
}

const MAX_RECONNECT_DELAY = 30_000
const instances = new Map<string, MudSocket>()

function parseEnvelope(raw: string): MudEnvelope | null {
  try {
    const obj = JSON.parse(raw)
    if (!obj || typeof obj !== 'object') return null
    const channel = (obj as any).channel
    if (channel === 'text' && typeof (obj as any).data === 'string') {
      return { channel: 'text', data: (obj as any).data }
    }
    if (channel === 'gmcp' && typeof (obj as any).module === 'string') {
      return {
        channel: 'gmcp',
        module: (obj as any).module,
        data: (obj as any).data,
        text: typeof (obj as any).text === 'string' ? (obj as any).text : undefined,
      }
    }
    if (channel === 'negotiate' && typeof (obj as any).option === 'string') {
      return {
        channel: 'negotiate',
        option: (obj as any).option,
        state: typeof (obj as any).state === 'string' ? (obj as any).state : '',
      }
    }
    if (channel === 'error' && typeof (obj as any).message === 'string') {
      return { channel: 'error', message: (obj as any).message }
    }
    return null
  } catch {
    return null
  }
}

export function useMudSocket(): MudSocket {
  const config = useRuntimeConfig()
  const url = String(config.public.mudWsUrl)
  const existing = instances.get(url)
  if (existing) return existing

  const status = ref<MudSocketStatus>('connecting')
  const envelopeCallbacks = new Set<EnvelopeCallback>()
  const rawCallbacks = new Set<RawCallback>()
  let socket: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempt = 0
  let manuallyClosed = false

  const scheduleReconnect = (): void => {
    if (manuallyClosed || reconnectTimer) return
    const delay = Math.min(1000 * 2 ** reconnectAttempt, MAX_RECONNECT_DELAY)
    reconnectAttempt += 1
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  function connect(): void {
    if (!import.meta.client || manuallyClosed) return
    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) return

    status.value = 'connecting'
    try {
      socket = new WebSocket(url)
    } catch {
      socket = null
      scheduleReconnect()
      return
    }

    socket.addEventListener('open', () => {
      reconnectAttempt = 0
      status.value = 'open'
      console.debug('[mud-socket] open, sending subscriptions')
      const subscriptions = JSON.stringify({
        channel: 'gmcp',
        module: 'Client.Subscriptions.List',
        data: ['Char.Vitals', 'Char.Name', 'Room.Info', 'Room.Map', 'Inventory.Items', 'Comm.Channel.Text'],
      })
      socket?.send(subscriptions)
    })

    socket.addEventListener('message', (event: MessageEvent) => {
      const data = typeof event.data === 'string' ? event.data : ''
      if (!data) return
      rawCallbacks.forEach((cb) => cb(data))
      const env = parseEnvelope(data)
      if (env) {
        if (env.channel === 'gmcp') {
          console.debug(`[mud-socket] <- gmcp module=${env.module} data=`, env.data)
        } else if (env.channel === 'negotiate') {
          console.debug(`[mud-socket] <- negotiate option=${env.option} state=${env.state}`)
        } else if (env.channel === 'error') {
          console.warn(`[mud-socket] <- error: ${env.message}`)
        } else if (env.channel === 'text') {
          console.debug(`[mud-socket] <- text: ${JSON.stringify(env.data.slice(0, 80))}`)
        }
        envelopeCallbacks.forEach((cb) => cb(env))
      }
    })

    socket.addEventListener('close', (event: CloseEvent) => {
      socket = null
      status.value = 'closed'
      console.debug(`[mud-socket] closed code=${event.code} reason=${event.reason}`)
      scheduleReconnect()
    })

    socket.addEventListener('error', () => {
      console.debug('[mud-socket] error')
    })
  }

  const sendGMCP = (module: string, data: unknown) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    const env = JSON.stringify({ channel: 'gmcp', module, data })
    console.debug(`[mud-socket] -> gmcp module=${module}`)
    socket.send(env)
  }

  const mudSocket: MudSocket = {
    status,
    send: (line: string) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return
      const data = line.endsWith('\n') ? line : `${line}\n`
      const env = JSON.stringify({ channel: 'text', data })
      console.debug(`[mud-socket] -> text: ${JSON.stringify(data)}`)
      socket.send(env)
    },
    sendGMCP,
    onEnvelope: (callback: EnvelopeCallback) => {
      envelopeCallbacks.add(callback)
      return () => envelopeCallbacks.delete(callback)
    },
    onRaw: (callback: RawCallback) => {
      rawCallbacks.add(callback)
      return () => rawCallbacks.delete(callback)
    },
    onMessage: (callback: RawCallback) => {
      rawCallbacks.add(callback)
      return () => rawCallbacks.delete(callback)
    },
    close: () => {
      manuallyClosed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = null
      socket?.close()
      socket = null
      status.value = 'closed'
    },
  }

  instances.set(url, mudSocket)
  if (import.meta.client) connect()
  return mudSocket
}
