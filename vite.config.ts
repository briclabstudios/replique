/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Chemins relatifs : l'app fonctionne quel que soit le nom du dépôt GitHub Pages
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Réplique — répétition de théâtre',
        short_name: 'Réplique',
        description: 'Apprenez votre texte : les voix IA jouent vos partenaires, vous dites vos répliques.',
        lang: 'fr',
        // Identité fixe de l'appli installée ; différente de l'ancienne (dérivée de start_url) pour que Chrome
        // Android oublie une installation fantôme (« déjà installée » mais « impossible d'ouvrir »)
        id: 'replique',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#1a0f14',
        theme_color: '#7a1f2b',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Les données Supabase ne sont jamais servies depuis le cache : tout le monde répète la même version
        navigateFallbackDenylist: [/^\/functions\//, /^\/rest\//],
      },
    }),
  ],
  server: {
    // En développement, proxy vers Google Docs pour contourner le CORS sans déployer la fonction edge
    proxy: {
      '/gdoc-proxy': {
        target: 'https://docs.google.com',
        changeOrigin: true,
        followRedirects: true,
        rewrite: (path) => path.replace(/^\/gdoc-proxy/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
})
