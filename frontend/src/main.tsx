import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

const pass = window.prompt("【開発関係者専用】アクセスパスワードを入力してください");

if (pass === "0329") {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} else {
  document.body.innerHTML = "<div style='padding: 40px; font-family: sans-serif; text-align: center; color: #666;'><h1>403 Forbidden</h1><p>作成中のためアクセスできません。</p></div>";
}
