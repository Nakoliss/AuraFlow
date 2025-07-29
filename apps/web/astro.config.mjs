import { defineConfig } from 'astro/config'
import react from '@astrojs/react'

export default defineConfig({
  integrations: [react()],
  output: 'static',
  vite: {
    resolve: {
      alias: {
        '@': './src'
      }
    },
    optimizeDeps: {
      exclude: ['@mapbox/node-pre-gyp']
    },
    ssr: {
      external: ['mock-aws-s3', 'aws-sdk', 'nock', '@mapbox/node-pre-gyp']
    }
  }
})