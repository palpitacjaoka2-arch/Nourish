import { onAuthChange } from './lib/db.js'
import { renderAuth }   from './components/auth.js'
import { initApp }      from './components/app.js'
import './style.css'

const root = document.getElementById('root')

onAuthChange(async (session) => {
  root.innerHTML = ''
  if (session) {
    await initApp(root, session.user)
  } else {
    renderAuth(root)
  }
})
