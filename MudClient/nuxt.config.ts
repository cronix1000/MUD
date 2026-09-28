export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  typescript: {
    strict: true,
    typeCheck: false,
  },
  modules: ['@nuxtjs/tailwindcss', 'shadcn-nuxt'],
  shadcn: {
    componentDir: './components/ui',
  },
  components: {
    dirs: [
      {
        path: '~/components',
        pathPrefix: false,
      },
    ],
  },
  css: ['~/assets/css/tailwind.css', '@xterm/xterm/css/xterm.css'],
  runtimeConfig: {
    public: {
      mudWsUrl: 'ws://localhost:8443/ws',
    },
  },
  ssr: false,
  app: {
    head: {
      title: 'MudClient',
    },
  },
  nitro: {
    routeRules: {
      '/': {
        headers: {
          'cache-control': 'no-cache, no-store, must-revalidate',
          'x-mud-client-spa': '1'
        }
      },
      '/_nuxt/**': {
        headers: {
          'cache-control': 'public, max-age=31536000, immutable'
        }
      }
    }
  }
})
