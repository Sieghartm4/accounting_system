import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './utils/api.js' // Initialize global fetch interceptor for auth handling
import App from './App.jsx'
import { CopilotKit } from '@copilotkit/react-core'
import '@copilotkit/react-ui/styles.css'
import 'driver.js/dist/driver.css'

const serverLink = (import.meta.env.VITE_SERVER_LINK || 'http://localhost:3004').replace(/\/$/, '')
const copilotRuntimeUrl = `${serverLink}/api/copilotkit`

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CopilotKit runtimeUrl={copilotRuntimeUrl} useSingleEndpoint>
      <App />
    </CopilotKit>
  </StrictMode>,
)
