import { supabase, hasSupa } from './supabase'

const LS_KEY = 'adraba-v2'

export const DEFAULT_DATA = {
  members: [
    { id: 'm1', name: 'Menny', accounts: ['CST','IB','GS','FIBI','Discount','Leumi','UBS','MS','Citibank','Chase'] },
    { id: 'm2', name: 'Itamar', accounts: ['CST','Discount','Poalim','IB','MS'] },
    { id: 'm3', name: 'Amir', accounts: ['CST','Discount'] },
    { id: 'm4', name: 'Dorit', accounts: ['CST','Discount'] },
    { id: 'm5', name: 'Rachel', accounts: ['CST','Discount'] },
    { id: 'm6', name: 'Yechezkel', accounts: ['CST','Discount'] },
  ],
  institutions: ['CST','IB','GS','FIBI','Discount','Leumi','UBS','MS','Citibank','Chase','Poalim'],
  assets: [
    { id: 'a1', name: 'DFNS', ticker: 'DFNS', desc: 'Defense Stock', type: 'Stock', liquid: true },
    { id: 'a2', name: 'POLA', ticker: 'POLA', desc: 'Pola Stock', type: 'Stock', liquid: true },
    { id: 'a3', name: 'PHGE', ticker: 'PHGE', desc: 'Phge Stock', type: 'Stock', liquid: true },
    { id: 'a4', name: 'Apple', ticker: 'AAPL', desc: 'Apple Inc.', type: 'Stock', liquid: true },
    { id: 'a5', name: 'Citigroup', ticker: 'C', desc: 'Citigroup Inc.', type: 'Stock', liquid: true },
  ],
  transactions: [],
  assetValues: {},
}

const lsLoad = () => { try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null } catch { return null } }
const lsSave = (d) => localStorage.setItem(LS_KEY, JSON.stringify(d))

async function sbLoad() {
  if (!hasSupa()) return null
  const { data } = await supabase.from('app_state').select('state').eq('id', 'main').single()
  return data?.state && Object.keys(data.state).length > 0 ? data.state : null
}

async function sbSave(state) {
  if (!hasSupa()) return
  await supabase.from('app_state').upsert({ id: 'main', state, updated_at: new Date().toISOString() })
}

export async function loadData() {
  if (hasSupa()) {
    const d = await sbLoad()
    if (d) { lsSave(d); return d }
  }
  const ls = lsLoad()
  if (ls) return ls
  const fresh = { ...DEFAULT_DATA }
  await sbSave(fresh)
  lsSave(fresh)
  return fresh
}

export async function saveData(data) {
  lsSave(data)
  await sbSave(data)
}

export async function resetData() {
  const f = { ...DEFAULT_DATA }
  lsSave(f)
  await sbSave(f)
  return f
}
