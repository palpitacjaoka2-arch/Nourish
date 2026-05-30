import { initApp } from './components/app.js'
import './style.css'

const root = document.getElementById('root')
// Use a fixed local user ID - no login needed
const FIXED_USER = { id: 'local-user-alswi' }
initApp(root, FIXED_USER)