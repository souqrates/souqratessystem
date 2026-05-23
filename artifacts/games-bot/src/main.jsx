import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import './index.css'
import App from './App.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'
import { getDeviceTier } from './lib/deviceProfile.js'
import { setTelegramTheme } from './lib/telegram.js'

const tier = getDeviceTier();
document.documentElement.classList.add(`device-${tier}`);

// Apply Telegram header/background color immediately before first React paint
setTelegramTheme();

const motionReducedMotion = tier === 'low' ? 'always' : tier === 'mid' ? 'user' : 'never';
const isProduction = import.meta.env.PROD;
const defaultTransition = { type: 'tween', duration: 0.1 };

const app = (
  <MotionConfig reducedMotion={motionReducedMotion} transition={defaultTransition}>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </MotionConfig>
);

createRoot(document.getElementById('root')).render(
  isProduction ? app : <StrictMode>{app}</StrictMode>
)
