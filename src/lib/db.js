import { supabase } from './supabase.js'

// ── auth ──────────────────────────────────────────────────────────────────────

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function signInWithEmail(email, password) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signUpWithEmail(email, password) {
  return supabase.auth.signUp({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export function onAuthChange(cb) {
  return supabase.auth.onAuthStateChange((_event, session) => cb(session))
}

// ── fasting state ─────────────────────────────────────────────────────────────

export async function loadFastingState(userId) {
  const { data } = await supabase
    .from('fasting_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export async function saveFastingState(userId, { status, startTime, stopTime }) {
  return supabase.from('fasting_state').upsert({
    user_id: userId,
    status,
    start_time: startTime ? new Date(startTime).toISOString() : null,
    stop_time:  stopTime  ? new Date(stopTime).toISOString()  : null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' })
}

// ── fasting log ───────────────────────────────────────────────────────────────

export async function loadFastingLogs(userId, dateStr) {
  const { data } = await supabase
    .from('fasting_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', dateStr)
    .order('time', { ascending: true })
  return data || []
}

export async function loadAllFastingLogs(userId) {
  const { data } = await supabase
    .from('fasting_logs')
    .select('*')
    .eq('user_id', userId)
    .order('time', { ascending: true })
  // group by date
  const grouped = {}
  for (const row of data || []) {
    if (!grouped[row.date]) grouped[row.date] = []
    grouped[row.date].push({ type: row.type, time: new Date(row.time).getTime() })
  }
  return grouped
}

export async function pushFastingLog(userId, dateStr, type, timeMs) {
  return supabase.from('fasting_logs').insert({
    user_id: userId,
    date: dateStr,
    type,
    time: new Date(timeMs).toISOString()
  })
}

export async function replaceFastingLogsForDate(userId, dateStr, entries) {
  await supabase.from('fasting_logs').delete().eq('user_id', userId).eq('date', dateStr)
  if (!entries.length) return
  return supabase.from('fasting_logs').insert(
    entries.map(e => ({
      user_id: userId,
      date: dateStr,
      type: e.type,
      time: new Date(e.time).toISOString()
    }))
  )
}

// ── weight ────────────────────────────────────────────────────────────────────

export async function loadWeightEntries(userId) {
  const { data } = await supabase
    .from('weight_entries')
    .select('date, weight_kg')
    .eq('user_id', userId)
    .order('date', { ascending: true })
  const result = {}
  for (const row of data || []) result[row.date] = parseFloat(row.weight_kg)
  return result
}

export async function saveWeightEntry(userId, dateStr, weightKg) {
  return supabase.from('weight_entries').upsert({
    user_id: userId,
    date: dateStr,
    weight_kg: weightKg
  }, { onConflict: 'user_id,date' })
}

// ── period ────────────────────────────────────────────────────────────────────

export async function loadPeriodEntries(userId) {
  const { data } = await supabase
    .from('period_entries')
    .select('start_date, end_date')
    .eq('user_id', userId)
    .order('start_date', { ascending: true })
  const result = {}
  for (const row of data || []) result[row.start_date] = row.end_date
  return result
}

export async function savePeriodStart(userId, startDate) {
  return supabase.from('period_entries').upsert({
    user_id: userId,
    start_date: startDate,
    end_date: null
  }, { onConflict: 'user_id,start_date' })
}

export async function savePeriodEnd(userId, startDate, endDate) {
  return supabase.from('period_entries')
    .update({ end_date: endDate })
    .eq('user_id', userId)
    .eq('start_date', startDate)
}
