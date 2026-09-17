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
})
