import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { LangProvider } from './lib/i18n.jsx'
import './index.css'
import './worship-theme.css'
import './pwa-theme.css'
import { PwaProvider } from './components/pwa/PwaProvider.jsx'
import { observePhoneViewport } from './lib/phoneViewport.js'

observePhoneViewport(window)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LangProvider>
      <PwaProvider><App /></PwaProvider>
    </LangProvider>
  </React.StrictMode>,
)
