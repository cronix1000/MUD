import { connect as netConnect } from 'node:net'
import type { H3Event } from 'h3'

const REQUEST_TIMEOUT_MS = 10_000
const MAX_COMMAND_LENGTH = 2000

function consoleTarget(): { host: string; port: number } {
  return {
    host: process.env.MUD_CONSOLE_HOST || '127.0.0.1',
    port: Number(process.env.MUD_CONSOLE_PORT || 27016),
  }
}

export function isConsoleEnabled(): boolean {
  return Boolean(process.env.MUD_ADMIN_TOKEN)
}

export function requireConsoleToken(event: H3Event): void {
  const expected = process.env.MUD_ADMIN_TOKEN
  if (!expected) {
    throw createError({ statusCode: 503, statusMessage: 'Console disabled: set MUD_ADMIN_TOKEN (server and admin)' })
  }
  if (getHeader(event, 'x-admin-token') !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid admin token' })
  }
}

export function assertCommand(command: unknown): string {
  if (typeof command !== 'string' || !command.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Command is required' })
  }
  const trimmed = command.trim()
  if (trimmed.length > MAX_COMMAND_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: 'Command too long' })
  }
  return trimmed
}

let nextRequestId = 1

export function runConsoleCommand(command: string): Promise<string> {
  const { host, port } = consoleTarget()
  const requestId = nextRequestId++

  return new Promise<string>((resolvePromise, rejectPromise) => {
    const socket = netConnect({ host, port })
    let buffer = ''
    let authenticated = false
    let settled = false

    const timer = setTimeout(() => {
      finish(new Error(`Console timed out after 10s (is mud-server running?)`))
    }, REQUEST_TIMEOUT_MS)

    function finish(err: Error | null, output?: string) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.destroy()
      if (err) rejectPromise(err)
      else resolvePromise(output ?? '')
    }

    socket.on('connect', () => {
      socket.write(JSON.stringify({ auth: process.env.MUD_ADMIN_TOKEN }) + '\n')
    })

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line) continue

        let msg: { authenticated?: boolean; ok?: boolean; id?: number; output?: string; error?: string }
        try {
          msg = JSON.parse(line)
        } catch {
          continue
        }

        if (!authenticated) {
          if (msg.authenticated === true) {
            authenticated = true
            socket.write(JSON.stringify({ id: requestId, cmd: command }) + '\n')
          } else if (msg.authenticated === false) {
            finish(new Error(msg.error || 'Console auth failed'))
            return
          }
        } else if (msg.id === requestId) {
          if (msg.ok) finish(null, String(msg.output ?? ''))
          else finish(new Error(msg.output || 'Command failed'))
          return
        }
      }
    })

    socket.on('error', (err) => finish(err))
    socket.on('close', () => {
      finish(new Error('Console connection closed before a response arrived'))
    })
  })
}
