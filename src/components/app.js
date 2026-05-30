import {
  loadFastingState, saveFastingState,
  loadAllFastingLogs, pushFastingLog, replaceFastingLogsForDate,
  loadWeightEntries, saveWeightEntry,
  loadPeriodEntries, savePeriodStart, savePeriodEnd,
  signOut
} from '../lib/db.js'

let userId     = null
let fastState  = { status: 'fasting', startTime: null, stopTime: null }
let weightData = {}
let periodData = {}
let fastLog    = {}
let timerInterval  = null
let calYear, calMonth
let weightChart    = null
let activePeriodStart = null

const today      = () => new Date().toISOString().slice(0, 10)
const fmt        = ms  => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const fmtDur     = ms  => {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`
}
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

function calcFastingGap(stopTime) {
  if (!stopTime) return null
  const next7 = new Date(stopTime)
  next7.setDate(next7.getDate() + 1)
  next7.setHours(7, 0, 0, 0)
  const diff = next7 - stopTime
  return diff > 0 ? diff : null
}

export async function initApp(container, user) {
  userId = user.id
  container.innerHTML = appHTML()
  bindGlobals()

  // load all data
  const [state, logs, weights, periods] = await Promise.all([
    loadFastingState(userId),
    loadAllFastingLogs(userId),
    loadWeightEntries(userId),
    loadPeriodEntries(userId)
  ])

  if (state) {
    fastState = {
      status:    state.status,
      startTime: state.start_time ? new Date(state.start_time).getTime() : null,
      stopTime:  state.stop_time  ? new Date(state.stop_time).getTime()  : null
    }
  }

  fastLog    = logs
  weightData = weights
  periodData = periods

  updateStatus()
  renderFastButtons()
  renderLog()

  if (fastState.status === 'eating') startTimer()
  else { updateTimerDisplay(); setInterval(updateTimerDisplay, 60000) }

  const now = new Date()
  calYear = now.getFullYear(); calMonth = now.getMonth()
}

// ── HTML skeleton ─────────────────────────────────────────────────────────────

function appHTML() {
  return `
  <div class="app">
    <div class="header">
      <h1>nourish</h1>
      <button class="signout-btn" onclick="appSignOut()" title="sign out"><i class="ti ti-logout"></i></button>
    </div>

    <nav class="nav">
      <button class="active" onclick="showTab('fast',this)"><i class="ti ti-clock"></i> Fast</button>
      <button onclick="showTab('weight',this)"><i class="ti ti-trending-up"></i> Weight</button>
      <button onclick="showTab('calendar',this)"><i class="ti ti-calendar"></i> Calendar</button>
    </nav>

    <div id="tab-fast" class="tab active">
      <div class="fasting-card">
        <div id="status-pill" class="status-pill status-fasting">
          <span class="status-dot" id="status-dot"></span>
          <span id="status-text">fasting</span>
        </div>
        <div class="timer-display">
          <div class="timer-big" id="timer-display">00h 00m</div>
          <div class="timer-label" id="timer-label">fasted today</div>
        </div>
        <div class="stats-row">
          <div class="stat-box">
            <div class="stat-label">eating window</div>
            <div class="stat-value" id="stat-window">—</div>
            <div class="stat-sub" id="stat-window-sub">not started</div>
          </div>
          <div class="stat-box highlight">
            <div class="stat-label">fasting gap</div>
            <div class="stat-value" id="stat-gap">—</div>
            <div class="stat-sub" id="stat-gap-sub">until next 7am</div>
          </div>
        </div>
        <div class="window-bar" id="window-bar" style="display:none">
          <span id="window-range">—</span>
        </div>
      </div>

      <div class="btn-row" id="main-btn-row"></div>

      <div class="manual-toggle">
        <button onclick="toggleManual()"><i class="ti ti-edit"></i> forgot to tap? enter times manually</button>
      </div>

      <div class="manual-panel" id="manual-panel">
        <div class="section-title">manual entry</div>
        <div class="manual-row">
          <span class="manual-label">date</span>
          <input type="date" class="date-input" id="manual-date">
        </div>
        <div class="manual-row">
          <span class="manual-label">start</span>
          <input type="time" class="time-input" id="manual-start">
        </div>
        <div class="manual-row">
          <span class="manual-label">stop</span>
          <input type="time" class="time-input" id="manual-stop">
        </div>
        <div class="manual-error" id="manual-error"></div>
        <button class="btn-apply" onclick="applyManual()">apply</button>
        <div class="manual-hint">leave stop empty if you're still eating</div>
      </div>

      <div class="fasting-card" id="log-card" style="display:none">
        <div class="section-title">today's log</div>
        <div id="log-entries"></div>
      </div>
    </div>

    <div id="tab-weight" class="tab">
      <div class="weight-input-card">
        <div class="section-title">log today's weight</div>
        <div class="weight-row">
          <input type="number" class="weight-input" id="weight-val" placeholder="—" step="0.1" min="30" max="250">
          <span class="unit-label">kg</span>
          <button class="btn-save" onclick="saveWeightEntry()">save</button>
        </div>
      </div>
      <div class="chart-area">
        <div class="section-title">last 30 days</div>
        <div class="legend">
          <div class="legend-item"><div class="legend-dot" style="background:var(--rose-deep)"></div>weight</div>
          <div class="legend-item"><div class="legend-dot" style="background:var(--period-red)"></div>period</div>
        </div>
        <div class="chart-wrap"><canvas id="weight-chart"></canvas></div>
      </div>
      <div class="fasting-card">
        <div class="section-title">recent entries</div>
        <div id="weight-list"></div>
      </div>
    </div>

    <div id="tab-calendar" class="tab">
      <div class="calendar-card">
        <div class="cal-header">
          <button class="cal-nav" onclick="calNav(-1)">‹</button>
          <div class="cal-title" id="cal-title"></div>
          <button class="cal-nav" onclick="calNav(1)">›</button>
        </div>
        <div class="cal-grid" id="cal-grid"></div>
      </div>
      <div class="period-controls">
        <div class="section-title" style="margin-bottom:8px">period tracking</div>
        <div class="period-row">
          <button class="period-btn" id="btn-period-start" onclick="markPeriodStart()"><i class="ti ti-droplet"></i> start</button>
          <button class="period-btn" id="btn-period-end" onclick="markPeriodEnd()"><i class="ti ti-droplet-off"></i> end</button>
        </div>
        <div id="period-status" style="font-size:12px;color:var(--muted);margin-top:8px"></div>
      </div>
    </div>
  </div>

  <div class="overlay" id="overlay" onclick="closeDetail()"></div>
  <div class="day-detail" id="day-detail">
    <div class="detail-handle"></div>
    <button class="detail-close" onclick="closeDetail()"><i class="ti ti-x"></i></button>
    <div class="detail-title" id="detail-title"></div>
    <div id="detail-body"></div>
  </div>`
}

// ── globals bound to window for inline onclick handlers ───────────────────────

function bindGlobals() {
  window.showTab = (name, btn) => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
    document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'))
    document.getElementById('tab-' + name).classList.add('active')
    btn.classList.add('active')
    if (name === 'weight')   renderWeightTab()
    if (name === 'calendar') renderCalendar()
  }

  window.appSignOut = async () => {
    await signOut()
  }

  window.toggleManual = () => {
    const panel = document.getElementById('manual-panel')
    const isOpen = panel.classList.toggle('open')
    if (isOpen) {
      document.getElementById('manual-date').value  = today()
      document.getElementById('manual-start').value = ''
      document.getElementById('manual-stop').value  = ''
      document.getElementById('manual-error').style.display = 'none'
    }
  }

  window.applyManual = async () => {
    const dateVal  = document.getElementById('manual-date').value
    const startVal = document.getElementById('manual-start').value
    const stopVal  = document.getElementById('manual-stop').value
    const errEl    = document.getElementById('manual-error')
    errEl.style.display = 'none'

    if (!dateVal || !startVal) {
      errEl.textContent = 'date and start time are required'
      errEl.style.display = 'block'; return
    }

    const startTs = new Date(`${dateVal}T${startVal}:00`).getTime()
    let stopTs = null
    if (stopVal) {
      stopTs = new Date(`${dateVal}T${stopVal}:00`).getTime()
      if (stopTs <= startTs) {
        errEl.textContent = 'stop must be after start'
        errEl.style.display = 'block'; return
      }
    }

    const entries = [{ type: 'start', time: startTs }]
    if (stopTs) entries.push({ type: 'stop', time: stopTs })

    fastLog[dateVal] = entries
    await replaceFastingLogsForDate(userId, dateVal, entries)

    if (dateVal === today()) {
      fastState = { status: stopTs ? 'done' : 'eating', startTime: startTs, stopTime: stopTs }
      await saveFastingState(userId, fastState)
      clearInterval(timerInterval)
      if (!stopTs) startTimer(); else updateTimerDisplay()
      updateStatus(); renderFastButtons()
    }

    renderLog()
    document.getElementById('manual-panel').classList.remove('open')
  }

  window.saveWeightEntry = async () => {
    const val = parseFloat(document.getElementById('weight-val').value)
    if (!val || val < 20 || val > 300) return
    const d = today()
    weightData[d] = val
    await saveWeightEntry(userId, d, val)
    document.getElementById('weight-val').value = ''
    renderWeightTab()
  }

  window.calNav = (dir) => {
    calMonth += dir
    if (calMonth < 0) { calMonth = 11; calYear-- }
    if (calMonth > 11) { calMonth = 0; calYear++ }
    renderCalendar()
  }

  window.markPeriodStart = async () => {
    activePeriodStart = today()
    periodData[activePeriodStart] = null
    await savePeriodStart(userId, activePeriodStart)
    updatePeriodStatus(); renderCalendar()
  }

  window.markPeriodEnd = async () => {
    if (!activePeriodStart) {
      const opens = Object.keys(periodData).filter(k => periodData[k] === null).sort()
      activePeriodStart = opens[opens.length - 1] || today()
    }
    const endDate = today()
    periodData[activePeriodStart] = endDate
    await savePeriodEnd(userId, activePeriodStart, endDate)
    activePeriodStart = null
    updatePeriodStatus(); renderCalendar()
  }

  window.showDayDetail = (ds) => {
    document.getElementById('detail-title').textContent = fmtDate(ds)
    const w   = weightData[ds]
    const inP = isDuringPeriod(ds)
    const log = fastLog[ds] || []
    const labels = { start: 'started eating', stop: 'stopped eating', recall: 'recalled stop' }
    let body = ''
    if (w)   body += `<div class="log-entry"><span class="log-action">⚖️ weight</span><span class="log-time">${w} kg</span></div>`
    if (inP) body += `<div class="log-entry"><span class="log-action">🌸 period day</span><span class="log-time"></span></div>`
    body += log.map(e => `<div class="log-entry"><span class="log-action">${labels[e.type]||e.type}</span><span class="log-time">${fmt(e.time)}</span></div>`).join('')
    if (!body) body = '<div class="empty-state">nothing logged this day</div>'
    document.getElementById('detail-body').innerHTML = body
    document.getElementById('day-detail').classList.add('open')
    document.getElementById('overlay').classList.add('open')
  }

  window.closeDetail = () => {
    document.getElementById('day-detail').classList.remove('open')
    document.getElementById('overlay').classList.remove('open')
  }
}

// ── fasting actions ───────────────────────────────────────────────────────────

async function startEating() {
  const now = Date.now()
  fastState = { status: 'eating', startTime: now, stopTime: null }
  await saveFastingState(userId, fastState)
  await pushFastingLog(userId, today(), 'start', now)
  if (!fastLog[today()]) fastLog[today()] = []
  fastLog[today()].push({ type: 'start', time: now })
  startTimer(); updateStatus(); renderFastButtons(); renderLog()
}

async function stopEating() {
  const now = Date.now()
  fastState.status   = 'done'
  fastState.stopTime = now
  await saveFastingState(userId, fastState)
  await pushFastingLog(userId, today(), 'stop', now)
  fastLog[today()].push({ type: 'stop', time: now })
  clearInterval(timerInterval)
  updateTimerDisplay(); updateStatus(); renderFastButtons(); renderLog()
}

async function recallStop() {
  const now = Date.now()
  fastState.status   = 'eating'
  fastState.stopTime = null
  await saveFastingState(userId, fastState)
  await pushFastingLog(userId, today(), 'recall', now)
  fastLog[today()].push({ type: 'recall', time: now })
  startTimer(); updateStatus(); renderFastButtons(); renderLog()
}

function renderFastButtons() {
  const row = document.getElementById('main-btn-row')
  const s = fastState.status
  if (s === 'fasting') {
    row.innerHTML = `<button class="btn btn-start" onclick="startEatingBtn()"><i class="ti ti-utensils"></i> start eating</button>`
    window.startEatingBtn = startEating
  } else if (s === 'eating') {
    row.innerHTML = `<button class="btn btn-stop" onclick="stopEatingBtn()"><i class="ti ti-hand-stop"></i> stop eating</button>`
    window.stopEatingBtn = stopEating
  } else {
    row.innerHTML = `
      <button class="btn btn-recall" onclick="recallStopBtn()"><i class="ti ti-rotate-clockwise"></i> recall stop</button>
      <button class="btn btn-start" style="opacity:0.5;pointer-events:none"><i class="ti ti-check"></i> done</button>`
    window.recallStopBtn = recallStop
  }
}

function updateStatus() {
  const pill = document.getElementById('status-pill')
  const dot  = document.getElementById('status-dot')
  const txt  = document.getElementById('status-text')
  const s = fastState.status
  pill.className = 'status-pill ' + (s === 'eating' ? 'status-eating' : 'status-fasting')
  dot.className  = 'status-dot' + (s === 'eating' ? ' pulse' : '')
  txt.textContent = s === 'eating' ? 'eating window open' : s === 'done' ? 'eating done' : 'fasting'
}

function startTimer() {
  clearInterval(timerInterval)
  timerInterval = setInterval(updateTimerDisplay, 1000)
  updateTimerDisplay()
}

function updateTimerDisplay() {
  const el = (id) => document.getElementById(id)
  const s = fastState
  if (s.status === 'fasting') {
    const midnight = new Date(); midnight.setHours(0,0,0,0)
    el('timer-display').textContent = fmtDur(Date.now() - midnight.getTime())
    el('timer-label').textContent   = 'fasted today'
    el('window-bar').style.display  = 'none'
    el('stat-window').textContent   = '—'; el('stat-window-sub').textContent = 'not started'
    el('stat-gap').textContent      = '—'; el('stat-gap-sub').textContent    = 'until next 7am'
  } else if (s.status === 'eating') {
    const winMs = Date.now() - s.startTime
    el('timer-display').textContent    = fmtDur(winMs)
    el('timer-label').textContent      = 'eating'
    el('stat-window').textContent      = fmtDur(winMs)
    el('stat-window-sub').textContent  = `started ${fmt(s.startTime)}`
    const gapMs = calcFastingGap(Date.now())
    el('stat-gap').textContent         = gapMs ? fmtDur(gapMs) : '—'
    el('stat-gap-sub').textContent     = 'until 7am tomorrow'
    el('window-bar').style.display     = 'flex'
    el('window-range').textContent     = `${fmt(s.startTime)} – now`
  } else {
    const winMs = s.stopTime - s.startTime
    el('timer-display').textContent    = fmtDur(winMs)
    el('timer-label').textContent      = 'eating window'
    el('stat-window').textContent      = fmtDur(winMs)
    el('stat-window-sub').textContent  = `${fmt(s.startTime)} – ${fmt(s.stopTime)}`
    const gapMs = calcFastingGap(s.stopTime)
    el('stat-gap').textContent         = gapMs ? fmtDur(gapMs) : '—'
    el('stat-gap-sub').textContent     = `${fmt(s.stopTime)} → 7am`
    el('window-bar').style.display     = 'flex'
    el('window-range').textContent     = `${fmt(s.startTime)} – ${fmt(s.stopTime)}`
  }
}

function renderLog() {
  const tk      = today()
  const entries = fastLog[tk] || []
  const card    = document.getElementById('log-card')
  const cont    = document.getElementById('log-entries')
  if (!entries.length) { card.style.display = 'none'; return }
  card.style.display = ''
  const labels = { start: 'started eating', stop: 'stopped eating', recall: 'recalled stop' }
  cont.innerHTML = entries.slice().reverse().map(e =>
    `<div class="log-entry"><span class="log-action">${labels[e.type]||e.type}</span><span class="log-time">${fmt(e.time)}</span></div>`
  ).join('')
}

// ── weight ────────────────────────────────────────────────────────────────────

function isDuringPeriod(ds) {
  for (const [s, e] of Object.entries(periodData)) if (ds >= s && ds <= (e || s)) return true
  return false
}

function renderWeightTab() {
  renderWeightList()
  renderWeightChart()
}

function renderWeightList() {
  const cont    = document.getElementById('weight-list')
  const entries = Object.entries(weightData).sort((a,b) => b[0].localeCompare(a[0])).slice(0,14)
  if (!entries.length) { cont.innerHTML = '<div class="empty-state">no entries yet</div>'; return }
  cont.innerHTML = entries.map(([d, w], i) => {
    const prev = entries[i + 1]
    let dh = ''
    if (prev) {
      const diff = (w - prev[1]).toFixed(1)
      if (diff > 0)      dh = `<span class="weight-diff diff-up">▲ ${diff}</span>`
      else if (diff < 0) dh = `<span class="weight-diff diff-down">▼ ${Math.abs(diff)}</span>`
    }
    const ip = isDuringPeriod(d)
    return `<div class="weight-item">
      <span class="weight-date">${fmtDate(d)}${ip ? ' <span style="color:var(--period-red);font-size:11px">●</span>' : ''}</span>
      <span><span class="weight-val">${w} kg</span>${dh}</span>
    </div>`
  }).join('')
}

function renderWeightChart() {
  const canvas  = document.getElementById('weight-chart')
  if (!canvas) return
  const ctx     = canvas.getContext('2d')
  const entries = Object.entries(weightData).sort((a,b) => a[0].localeCompare(b[0])).slice(-30)
  if (weightChart) { weightChart.destroy(); weightChart = null }
  if (!entries.length) return
  import('chart.js').then(({ Chart, registerables }) => {
    Chart.register(...registerables)
    weightChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: entries.map(([d]) => fmtDateShort(d)),
        datasets: [{
          data: entries.map(([, w]) => w),
          borderColor: '#c96b6b', borderWidth: 2,
          pointBackgroundColor: entries.map(([d]) => isDuringPeriod(d) ? '#e05050' : '#c96b6b'),
          pointRadius: 4, tension: 0.3,
          fill: { target: 'origin', above: 'rgba(249,232,232,0.4)' }
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { font: { size: 11 }, color: '#8a6a6a' }, grid: { color: 'rgba(180,110,110,0.1)' } },
          x: { ticks: { font: { size: 10 }, color: '#8a6a6a', maxTicksLimit: 8 }, grid: { display: false } }
        }
      }
    })
  })
}

// ── calendar ──────────────────────────────────────────────────────────────────

function renderCalendar() {
  document.getElementById('cal-title').textContent = `${MONTHS[calMonth]} ${calYear}`
  const grid = document.getElementById('cal-grid')
  const ts   = today()
  grid.innerHTML = DAYS.map(d => `<div class="cal-day-name">${d}</div>`).join('')
  const first = new Date(calYear, calMonth, 1)
  const dim   = new Date(calYear, calMonth + 1, 0).getDate()
  for (let i = 0; i < first.getDay(); i++) grid.innerHTML += '<div class="cal-day empty"></div>'
  const pdays = getPeriodDays()
  for (let d = 1; d <= dim; d++) {
    const ds    = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const isT   = ds === ts
    const hasW  = !!weightData[ds]
    const pc    = getPeriodClass(ds, pdays)
    let dots = ''
    if (hasW) dots       += '<div class="cal-dot dot-weight"></div>'
    if (pdays.has(ds)) dots += '<div class="cal-dot dot-period"></div>'
    grid.innerHTML += `<div class="cal-day${isT?' today':''}${pc?' '+pc:''}" onclick="showDayDetail('${ds}')">
      <span>${d}</span><div style="display:flex;gap:2px">${dots}</div></div>`
  }
  updatePeriodStatus()
}

function getPeriodDays() {
  const s = new Set()
  for (const [start, end] of Object.entries(periodData)) {
    if (!end) { s.add(start); continue }
    let cur = new Date(start); const ed = new Date(end)
    while (cur <= ed) { s.add(cur.toISOString().slice(0,10)); cur.setDate(cur.getDate()+1) }
  }
  return s
}

function getPeriodClass(ds, pdays) {
  if (!pdays.has(ds)) return ''
  const prev = new Date(ds); prev.setDate(prev.getDate()-1)
  const next = new Date(ds); next.setDate(next.getDate()+1)
  const hp = pdays.has(prev.toISOString().slice(0,10))
  const hn = pdays.has(next.toISOString().slice(0,10))
  if (!hp && !hn) return 'period-day period-single'
  if (!hp) return 'period-day period-start'
  if (!hn) return 'period-day period-end'
  return 'period-day'
}

function updatePeriodStatus() {
  const opens = Object.entries(periodData).filter(([,v]) => v === null)
  const st    = document.getElementById('period-status')
  const sb    = document.getElementById('btn-period-start')
  const eb    = document.getElementById('btn-period-end')
  if (opens.length) {
    const [start] = opens[opens.length-1]
    st.textContent = `period started ${fmtDate(start)}, tap "end" when it's over`
    sb.classList.remove('active'); eb.classList.add('active')
  } else {
    const last = Object.keys(periodData).sort().pop()
    st.textContent = last ? `last period ended ${fmtDate(periodData[last])}` : 'tap "start" when your period begins'
    sb.classList.remove('active'); eb.classList.remove('active')
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(ds) {
  const [y, m, d] = ds.split('-')
  return `${parseInt(d)} ${MONTHS[parseInt(m)-1].slice(0,3)} ${y}`
}
function fmtDateShort(ds) {
  const [, m, d] = ds.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}
