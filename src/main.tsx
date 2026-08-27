import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { initDB } from './db'
import { registerSW } from './utils/sw'
import { getTheme, applyTheme } from './utils/theme'

async function bootstrap() {
  // 先应用主题（避免 FOUC）
  applyTheme(getTheme())
  await initDB()
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>,
  )
  // 注册 PWA Service Worker（失败不阻塞主流程）
  registerSW()
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed', err)
  document.body.innerHTML = `<div style="padding:24px;font-family:sans-serif">初始化失败：${String(err)}</div>`
})
