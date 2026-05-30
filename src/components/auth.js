import { signInWithEmail, signUpWithEmail } from '../lib/db.js'

export function renderAuth(container) {
  container.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <h1 class="auth-title">nourish</h1>
        <p class="auth-sub">your gentle health companion</p>

        <div class="auth-tabs">
          <button class="auth-tab active" id="tab-signin" onclick="authSwitchTab('signin')">sign in</button>
          <button class="auth-tab" id="tab-signup" onclick="authSwitchTab('signup')">sign up</button>
        </div>

        <div id="auth-error" class="auth-error" style="display:none"></div>

        <div class="auth-field">
          <label class="auth-label">email</label>
          <input type="email" id="auth-email" class="auth-input" placeholder="you@example.com" autocomplete="email">
        </div>
        <div class="auth-field">
          <label class="auth-label">password</label>
          <input type="password" id="auth-password" class="auth-input" placeholder="••••••••" autocomplete="current-password">
        </div>

        <button class="auth-btn" id="auth-submit" onclick="authSubmit()">sign in</button>
        <p class="auth-hint" id="auth-hint"></p>
      </div>
    </div>
  `

  window.authSwitchTab = (tab) => {
    document.getElementById('tab-signin').classList.toggle('active', tab === 'signin')
    document.getElementById('tab-signup').classList.toggle('active', tab === 'signup')
    document.getElementById('auth-submit').textContent = tab === 'signin' ? 'sign in' : 'create account'
    document.getElementById('auth-hint').textContent = ''
    document.getElementById('auth-error').style.display = 'none'
    window._authTab = tab
  }

  window._authTab = 'signin'

  window.authSubmit = async () => {
    const email    = document.getElementById('auth-email').value.trim()
    const password = document.getElementById('auth-password').value
    const errEl    = document.getElementById('auth-error')
    const btn      = document.getElementById('auth-submit')
    const hint     = document.getElementById('auth-hint')
    errEl.style.display = 'none'

    if (!email || !password) { showAuthError('please fill in both fields'); return }

    btn.disabled = true
    btn.textContent = '...'

    const fn = window._authTab === 'signup' ? signUpWithEmail : signInWithEmail
    const { error, data } = await fn(email, password)

    btn.disabled = false
    btn.textContent = window._authTab === 'signin' ? 'sign in' : 'create account'

    if (error) { showAuthError(error.message); return }
    if (window._authTab === 'signup' && !data.session) {
      hint.textContent = 'check your email to confirm your account, then sign in.'
      hint.style.color = 'var(--green)'
    }
  }

  function showAuthError(msg) {
    const el = document.getElementById('auth-error')
    el.textContent = msg
    el.style.display = 'block'
  }
}
