<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Terminal } from '@xterm/xterm'
import { useMudSocket } from '~/composables/useMudSocket'
import { useGMCPStore } from '~/composables/useGMCPStore'

const container = ref<HTMLDivElement | null>(null)
const socket = useMudSocket()

let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let inputBuffer = ''
let inputDisposable: { dispose: () => void } | null = null
let unsubscribe: (() => void) | null = null

const fit = (): void => {
  try {
    fitAddon?.fit()
  } catch {
    return
  }
}

const focusTerminal = (): void => {
  terminal?.focus()
}

const debugDumpBytes = (label: string, data: string): void => {
  if (!import.meta.client) return
  const codes: string[] = []
  for (let i = 0; i < Math.min(data.length, 40); i++) {
    const c = data.charCodeAt(i)
    codes.push(c.toString(16).padStart(2, '0'))
  }
  const tail = data.length > 40 ? `...(${data.length})` : ''
  console.debug(`[terminal] ${label} bytes=[${codes.join(' ')}${tail}] text=${JSON.stringify(data.slice(0, 80))}`)
}

onMounted(() => {
  if (!container.value) return

  terminal = new Terminal({
    fontFamily: 'monospace',
    fontSize: 14,
    theme: { background: '#0d1117' },
    convertEol: true,
    scrollback: 5000,
  })
  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(new WebLinksAddon())
  terminal.open(container.value)
  fit()

  unsubscribe = socket.onEnvelope((env) => {
    if (env.channel === 'text') {
      debugDumpBytes('text', env.data)
      terminal?.write(env.data)
      return
    }
    if (env.channel === 'gmcp') {
      useGMCPStore().update(env.module, env.data)
      if (env.text) terminal?.write(env.text)
      return
    }
    if (env.channel === 'negotiate') {
      terminal?.write(`\r\n\x1b[2m[gmcp ${env.option}=${env.state}]\x1b[0m\r\n`)
      return
    }
    if (env.channel === 'error') {
      terminal?.write(`\r\n\x1b[31m[gateway error] ${env.message}\x1b[0m\r\n`)
      return
    }
  })

  inputDisposable = terminal.onData((data) => {
    for (const character of data) {
      if (character === '\r' || character === '\n') {
        terminal?.write('\r\n')
        if (inputBuffer.length > 0) {
          socket.send(inputBuffer)
        }
        inputBuffer = ''
      } else if (character === '\u007f') {
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1)
          terminal?.write('\b \b')
        }
      } else {
        inputBuffer += character
        terminal?.write(character)
      }
    }
  })

  container.value.addEventListener('mousedown', focusTerminal)
  window.addEventListener('resize', fit)
  focusTerminal()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', fit)
  container.value?.removeEventListener('mousedown', focusTerminal)
  unsubscribe?.()
  inputDisposable?.dispose()
  terminal?.dispose()
  terminal = null
  fitAddon = null
})
</script>

<template>
  <div ref="container" class="h-full w-full" @mousedown="focusTerminal" />
  <Character>
        <div class="text-center font-semibold text-blue-600">
          Editable Card 1
          <p class="text-xs text-gray-500 font-normal">Snaps to a 20px grid</p>
        </div>
  </Character>
</template>
