import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const defaultRepoName = 'AdminQuadroSmartLiving'

function resolveBasePath(mode) {
  if (mode !== 'production') {
    return '/'
  }

  const configuredBasePath = process.env.VITE_BASE_PATH
  if (configuredBasePath) {
    return configuredBasePath.endsWith('/') ? configuredBasePath : `${configuredBasePath}/`
  }

  const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
  const repoName = repositoryName || defaultRepoName
  return `/${repoName}/`
}

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: resolveBasePath(mode),
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('react') || id.includes('scheduler')) {
            return 'vendor-react'
          }

          if (id.includes('react-router')) {
            return 'vendor-router'
          }

          if (id.includes('@supabase')) {
            return 'vendor-supabase'
          }

          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('dompurify')) {
            return 'vendor-pdf'
          }

          if (id.includes('lucide-react')) {
            return 'vendor-icons'
          }

          return 'vendor-misc'
        },
      },
    },
  },
}))
