import { initApp } from './components/app.js'
import './style.css'

const root = document.getElementById('root')
const FIXED_USER = { id: 'local-user-alswi' }
initApp(root, FIXED_USER)