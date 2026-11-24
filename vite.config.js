import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    // 여러 HTML 페이지를 빌드에 포함 (멀티 페이지 앱)
    rolldownOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        student: resolve(import.meta.dirname, 'student.html'),
        teacherMonitor: resolve(import.meta.dirname, 'teacherMonitor.html'),
      },
    },
    // Firebase 라이브러리 크기 때문에 생기는 경고 기준 조정 (kB)
    chunkSizeWarningLimit: 1000,
  },
})
