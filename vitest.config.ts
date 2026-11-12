import { defineConfig } from 'vitest/config'

// Config dédiée aux tests : pas besoin des plugins React / Tailwind
// pour tester la logique pure de src/lib.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
