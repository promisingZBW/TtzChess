import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { createBrowserFallbackBridge } from './study/browserFallbackBridge'
import './assets/main.css'

// 只有真正跑在Electron里，preload脚本才会注入window.chessoc；
// 用普通浏览器打开开发服务器地址做视觉验证时，装配一份浏览器端的降级实现，见该文件顶部注释。
if (!window.chessoc) {
  window.chessoc = createBrowserFallbackBridge()
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
