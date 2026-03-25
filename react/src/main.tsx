import { SocketProvider } from '@/contexts/socket'
import { TooltipProvider } from '@/components/ui/tooltip'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { PostHogProvider } from 'posthog-js/react'
import '@/assets/style/index.css'

const options = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
}

const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <PostHogProvider apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY} options={options}>
        <SocketProvider>
          <TooltipProvider>
            <App />
          </TooltipProvider>
        </SocketProvider>
      </PostHogProvider>
    </StrictMode>
  )
}
