import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// Sense StrictMode: el doble muntatge en desenvolupament fa desaparèixer alguna etiqueta <Html> de drei
createRoot(document.getElementById('root')!).render(<App />)
