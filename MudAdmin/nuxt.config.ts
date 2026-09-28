// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  ssr: false,
  app: {
    buildAssetsDir: '/admin_nuxt/'
  },
  nitro: {
    routeRules: {
      '/admin': {
        headers: {
          'cache-control': 'no-cache, no-store, must-revalidate',
          'x-mud-admin-spa': '1'
        }
      },
      '/admin_nuxt/**': {
        headers: {
          'cache-control': 'public, max-age=31536000, immutable'
        }
      }
    }
  }
})