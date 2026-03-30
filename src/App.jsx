import { useState, useEffect, useCallback, useMemo } from 'react'
import { loadData, saveData, resetData } from './lib/db'
import { hasSupa, signIn, signUp, signOut, getSession, getProfile, onAuthChange } from './lib/supabase'
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

// ── Constants ──
const ASSET_TYPES = ['Stock','Warrant','Option','Art','Real Estate','Crypto','Private Equity','Other']
const TX_TYPES = ['Issuance','Transfer','Sale','Buy']
const uid = () => Math.random().toString(36).slice(2,10)
const fmt$ = n => n===0?'-':n.toLocaleString('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2})
const fmtN = n => n===0?'-':n.toLocaleString()
const typeColors = {Issuance:'#0D9488',Transfer:'#5B21B6',Sale:'#F97316',Buy:'#2563EB'}
const mColors = ['#5B21B6','#0D9488','#F97316','#2563EB','#DC2626','#7C3AED','#0369A1','#B45309']
const chartColors = ['#5B21B6','#0D9488','#F97316','#FBBF24','#2563EB','#DC2626','#7C3AED','#0369A1']

// ── Shared UI ──
const Card = ({children,title,subtitle,style}) => (
  <div style={{background:'#fff',border:'1px solid #E2E8F0',borderRadius:12,padding:'20px 24px',marginBottom:16,...style}}>
    {title&&<h2 style={{fontSize:18,fontWeight:700,color:'#1E1B4B',marginBottom:subtitle?4:16}}>{title}</h2>}
    {subtitle&&<p style={{fontSize:13,color:'#94A3B8',marginBottom:16}}>{subtitle}</p>}
    {children}
  </div>
)
const Field = ({label,children,span}) => (
  <div style={{gridColumn:span?`span ${span}`:undefined}}>
    <label style={{display:'block',fontSize:12,fontWeight:600,color:'#475569',marginBottom:4,textTransform:'uppercase',letterSpacing:0.5}}>{label}</label>
    {children}
  </div>
)
const inp = {width:'100%',padding:'9px 12px',border:'1.5px solid #E2E8F0',borderRadius:8,fontSize:14,color:'#1E293B',background:'#FAFBFC',outline:'none',fontFamily:'inherit'}
const btn1 = {padding:'10px 24px',background:'#5B21B6',color:'#fff',border:'none',borderRadius:8,fontWeight:600,fontSize:14,cursor:'pointer',fontFamily:'inherit'}
const btn2 = {padding:'8px 16px',background:'#F1F5F9',color:'#475569',border:'1px solid #E2E8F0',borderRadius:8,fontWeight:500,fontSize:13,cursor:'pointer',fontFamily:'inherit'}
const tag = c => ({display:'inline-block',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,background:c+'18',color:c})
const thL = {padding:'8px 12px',textAlign:'left',fontWeight:600,color:'#64748B',fontSize:11,textTransform:'uppercase',letterSpacing:0.5}
const thC = {...thL,textAlign:'center'}
const tdC = {padding:'8px 10px',textAlign:'center'}

// ── Computations ──
function useHoldings(data) {
  return useMemo(() => {
    const h = {}
    data.transactions.forEach(tx => {
      const k = (m,a,ac) => `${m}|${a}|${ac}`
      if(tx.toAccount) { const key=k(tx.memberId,tx.assetId,tx.toAccount); h[key]=(h[key]||0)+tx.units }
      if(tx.fromAccount) { const key=k(tx.memberId,tx.assetId,tx.fromAccount); h[key]=(h[key]||0)-tx.units }
    })
    return h
  }, [data.transactions])
}
function useCash(data) {
  return useMemo(() => {
    const c = {}
    data.transactions.filter(tx=>tx.type==='Sale'&&tx.total>0).forEach(tx => {
      const k=`${tx.memberId}|${tx.assetId}|${tx.fromAccount}`; c[k]=(c[k]||0)+tx.total
    })
    return c
  }, [data.transactions])
}

// ── Filter data for member role ──
function filterForMember(data, memberId) {
  if (!memberId) return data
  return {
    ...data,
    members: data.members.filter(m => m.id === memberId),
    transactions: data.transactions.filter(tx => tx.memberId === memberId),
  }
}

// ── Export utilities ──
function exportCSV(rows, headers, filename) {
  const esc = v => `"${String(v??'').replace(/"/g,'""')}"`
  const csv = [headers.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

async function exportPDF(rows, headers, title, filename) {
  const { default: jsPDF } = await import('jspdf')
  await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(30, 27, 75)
  doc.text(title, 14, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(148, 163, 184)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 25)
  doc.autoTable({
    head: [headers],
    body: rows,
    startY: 30,
    styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
    headStyles: { fillColor: [30, 27, 75], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  })
  doc.save(filename)
}

function buildLedgerExport(txs) {
  const h = ['Date','Type','Person','Asset','From','To','Units','Price','Total','Notes']
  const r = txs.map(tx => [tx.date,tx.type,tx.memberName,tx.assetTicker,tx.fromAccount||'',tx.toAccount||'',tx.units,tx.price||'',tx.total||'',tx.notes||''])
  return { headers: h, rows: r }
}

function buildHoldingsExport(data, holdings, cash) {
  const h = ['Person','Account',...data.assets.map(a=>a.ticker),'Total Units','Cash ($)']
  const r = []
  data.members.forEach(m => {
    m.accounts.forEach(ac => {
      let rt=0, rc=0
      const cells = data.assets.map(a => { const v=holdings[`${m.id}|${a.id}|${ac}`]||0; rt+=v; return v })
      data.assets.forEach(a => { rc+=cash[`${m.id}|${a.id}|${ac}`]||0 })
      if(rt!==0||rc!==0) r.push([m.name,ac,...cells,rt,rc?fmt$(rc):''])
    })
  })
  return { headers: h, rows: r }
}

// ── Login Screen ──
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login')

  const handle = async () => {
    setError(''); setLoading(true)
    const fn = mode === 'login' ? signIn : signUp
    const { error: err } = await fn(email, pw, email.split('@')[0])
    if (err) setError(err.message)
    else if (mode === 'signup') setError('Account created! You can now log in.')
    setLoading(false)
  }

  // Skip auth if Supabase not configured
  if (!hasSupa()) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#1E1B4B,#312E81)', fontFamily: "'DM Sans',system-ui" }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 40, maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
            <span style={{ color: '#A78BFA' }}>ad</span><span style={{ color: '#F97316' }}>ra</span><span style={{ color: '#2DD4BF' }}>ba</span>
          </div>
          <p style={{ color: '#94A3B8', fontSize: 14, marginBottom: 24 }}>Supabase not configured — running in local mode</p>
          <button onClick={() => onLogin(null)} style={{ ...btn1, width: '100%' }}>Enter as Admin (Local Mode)</button>
          <p style={{ color: '#CBD5E1', fontSize: 12, marginTop: 16 }}>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable cloud auth</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#1E1B4B 0%,#312E81 50%,#1E1B4B 100%)', fontFamily: "'DM Sans',system-ui" }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40', maxWidth: 420, width: '100%', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', animation: 'fadeIn 0.4s ease' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, fontWeight: 700, marginBottom: 4 }}>
            <span style={{ color: '#A78BFA' }}>ad</span><span style={{ color: '#F97316' }}>ra</span><span style={{ color: '#2DD4BF' }}>ba</span>
          </div>
          <p style={{ color: '#94A3B8', fontSize: 14 }}>Family Holdings Tracker</p>
        </div>

        <div style={{ display: 'flex', marginBottom: 24, background: '#F1F5F9', borderRadius: 10, padding: 3 }}>
          {['login','signup'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError('') }} style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              background: mode === m ? '#fff' : 'transparent', color: mode === m ? '#5B21B6' : '#94A3B8',
              boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>{m === 'login' ? 'Sign In' : 'Create Account'}</button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} placeholder="you@example.com" onKeyDown={e => e.key === 'Enter' && handle()} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }}>Password</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} style={inp} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handle()} />
          </div>
          {error && <p style={{ color: error.includes('created') ? '#0D9488' : '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>}
          <button onClick={handle} disabled={loading} style={{ ...btn1, width: '100%', opacity: loading ? 0.6 : 1, marginTop: 4 }}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════
export default function App() {
  const [authState, setAuthState] = useState('loading') // loading | login | ready
  const [profile, setProfile] = useState(null) // { role, member_id, display_name }
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('dashboard')
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)

  const isSuperAdmin = !hasSupa() || profile?.role === 'superadmin'
  const viewData = useMemo(() => {
    if (!data) return null
    if (isSuperAdmin) return data
    return filterForMember(data, profile?.member_id)
  }, [data, profile, isSuperAdmin])

  // Auth flow
  useEffect(() => {
    if (!hasSupa()) { setAuthState('login'); return }
    getSession().then(session => {
      if (session) loadProfile(session.user.id)
      else setAuthState('login')
    })
    const { data: sub } = onAuthChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) loadProfile(session.user.id)
      else if (event === 'SIGNED_OUT') { setAuthState('login'); setProfile(null); setData(null) }
    })
    return () => sub?.subscription?.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const p = await getProfile(userId)
    setProfile(p || { role: 'member', member_id: null, display_name: 'User' })
    const d = await loadData()
    setData(d)
    setAuthState('ready')
  }

  function handleLocalLogin() {
    setProfile({ role: 'superadmin', member_id: 'm1', display_name: 'Menny (Local)' })
    loadData().then(d => { setData(d); setAuthState('ready') })
  }

  const save = useCallback(async (newData) => {
    setData(newData); setSaving(true)
    await saveData(newData)
    setSaving(false)
  }, [])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  if (authState === 'loading') return <Spinner />
  if (authState === 'login') return <LoginScreen onLogin={handleLocalLogin} />
  if (!data || !viewData) return <Spinner />

  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'ledger', label: 'Ledger', icon: '📒' },
    { key: 'record', label: 'Record', icon: '➕' },
    { key: 'holdings', label: 'By Person', icon: '👥' },
    { key: 'byAsset', label: 'By Asset', icon: '📋' },
    { key: 'cash', label: 'Cash', icon: '💰' },
    ...(isSuperAdmin ? [
      { key: 'members', label: 'Members', icon: '🏠' },
      { key: 'assets', label: 'Assets', icon: '🏷️' },
      { key: 'accounts', label: 'Accounts', icon: '🏦' },
    ] : []),
  ]

  return (
    <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", background: '#F8FAFC', minHeight: '100vh', color: '#1E293B' }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}input,select,textarea,button{font-family:inherit}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#1E1B4B,#312E81)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>
            <span style={{ color: '#A78BFA' }}>ad</span><span style={{ color: '#F97316' }}>ra</span><span style={{ color: '#2DD4BF' }}>ba</span>
          </span>
          <span style={{ color: '#64748B', fontSize: 12, borderLeft: '1px solid #4B5563', paddingLeft: 12 }}>Family Holdings Tracker</span>
          {saving && <span style={{ color: '#FBBF24', fontSize: 11, marginLeft: 6 }}>● saving…</span>}
          {hasSupa() && <span style={{ color: '#2DD4BF', fontSize: 10, background: 'rgba(45,212,191,0.12)', padding: '2px 8px', borderRadius: 10, marginLeft: 4 }}>cloud</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#94A3B8', fontSize: 12 }}>
            {profile?.display_name}
            {isSuperAdmin && <span style={{ ...tag('#FBBF24'), marginLeft: 6 }}>admin</span>}
          </span>
          {isSuperAdmin && <button onClick={async () => { if(confirm('Reset all data?')){ const f=await resetData(); setData(f); showToast('Reset') }}} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748B', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>Reset</button>}
          <button onClick={async () => { await signOut(); setAuthState('login'); setProfile(null); setData(null) }} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>Sign Out</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 1, padding: '0 12px', background: '#fff', borderBottom: '1px solid #E2E8F0', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '12px 14px', fontSize: 13, fontWeight: tab===t.key?600:400, border: 'none', background: 'none',
            color: tab===t.key?'#5B21B6':'#64748B', borderBottom: tab===t.key?'2px solid #5B21B6':'2px solid transparent',
            cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit',
          }}><span style={{fontSize:14}}>{t.icon}</span>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 16px', animation: 'fadeIn 0.25s ease' }} key={tab}>
        {tab === 'dashboard' && <Dashboard data={viewData} fullData={data} isSuperAdmin={isSuperAdmin} />}
        {tab === 'record' && <RecordTx data={data} viewData={viewData} isSuperAdmin={isSuperAdmin} profile={profile} save={save} toast={showToast} />}
        {tab === 'ledger' && <Ledger data={viewData} fullData={data} save={save} toast={showToast} isSuperAdmin={isSuperAdmin} />}
        {tab === 'holdings' && <HoldingsByPerson data={viewData} fullData={data} />}
        {tab === 'byAsset' && <HoldingsByAsset data={viewData} />}
        {tab === 'cash' && <CashSummary data={viewData} />}
        {tab === 'members' && isSuperAdmin && <MemberForm data={data} save={save} toast={showToast} />}
        {tab === 'assets' && isSuperAdmin && <AssetForm data={data} save={save} toast={showToast} />}
        {tab === 'accounts' && isSuperAdmin && <AccountForm data={data} save={save} toast={showToast} />}
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1E1B4B', color: '#fff', padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 500, boxShadow: '0 8px 30px rgba(0,0,0,0.25)', zIndex: 999, animation: 'fadeIn 0.2s' }}>{toast}</div>}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'DM Sans',system-ui", color: '#94A3B8', flexDirection: 'column', gap: 12 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 32, height: 32, border: '3px solid #E2E8F0', borderTopColor: '#5B21B6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span>Loading…</span>
    </div>
  )
}

// ══════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════
function Dashboard({ data, fullData, isSuperAdmin }) {
  const h = useHoldings(data)
  const cash = useCash(data)

  // Total shares per asset
  const assetTotals = data.assets.map(a => {
    let total = 0
    data.members.forEach(m => m.accounts.forEach(ac => { total += h[`${m.id}|${a.id}|${ac}`] || 0 }))
    return { name: a.ticker, value: total, type: a.type }
  }).filter(a => a.value > 0)

  // Holdings per person (total shares across all assets)
  const personTotals = data.members.map((m, i) => {
    let shares = 0, cashVal = 0
    m.accounts.forEach(ac => {
      data.assets.forEach(a => {
        shares += h[`${m.id}|${a.id}|${ac}`] || 0
        cashVal += cash[`${m.id}|${a.id}|${ac}`] || 0
      })
    })
    return { name: m.name, shares, cash: cashVal, color: mColors[i % mColors.length] }
  })

  // Tx by type
  const txByType = TX_TYPES.map(t => ({ name: t, count: data.transactions.filter(tx => tx.type === t).length })).filter(t => t.count > 0)

  // Tx over time (by month)
  const txByMonth = useMemo(() => {
    const map = {}
    data.transactions.forEach(tx => {
      const m = tx.date?.slice(0, 7) || 'Unknown'
      map[m] = (map[m] || 0) + 1
    })
    return Object.entries(map).sort().map(([month, count]) => ({ month, count }))
  }, [data.transactions])

  // KPIs
  const totalShares = personTotals.reduce((s, p) => s + p.shares, 0)
  const totalCash = personTotals.reduce((s, p) => s + p.cash, 0)
  const totalTx = data.transactions.length

  const KPI = ({ label, value, color }) => (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px 24px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, letterSpacing: -0.5 }}>{value}</div>
    </div>
  )

  return (
    <>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <KPI label="Family Members" value={data.members.length} color="#5B21B6" />
        <KPI label="Total Units Held" value={fmtN(totalShares)} color="#0D9488" />
        <KPI label="Cash from Sales" value={fmt$(totalCash)} color="#F97316" />
        <KPI label="Transactions" value={totalTx} color="#2563EB" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Holdings by Asset */}
        <Card title="Units by Asset">
          {assetTotals.length === 0 ? <p style={{ color: '#CBD5E1' }}>No holdings yet</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={assetTotals} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => v.toLocaleString()} />
                <Tooltip formatter={v => fmtN(v)} contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }} />
                <Bar dataKey="value" radius={[6,6,0,0]}>
                  {assetTotals.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Holdings by Person (Pie) */}
        <Card title="Holdings Distribution by Person">
          {personTotals.filter(p=>p.shares>0).length === 0 ? <p style={{ color: '#CBD5E1' }}>No holdings yet</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={personTotals.filter(p=>p.shares>0)} cx="50%" cy="50%" outerRadius={95} innerRadius={50} dataKey="shares" nameKey="name" paddingAngle={2}>
                  {personTotals.filter(p=>p.shares>0).map((p, i) => <Cell key={i} fill={p.color} />)}
                </Pie>
                <Tooltip formatter={v => fmtN(v)} contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }} />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Cash per Person */}
        <Card title="Cash by Person">
          {personTotals.filter(p=>p.cash>0).length === 0 ? <p style={{ color: '#CBD5E1' }}>No cash yet</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={personTotals.filter(p=>p.cash>0)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => '$'+v.toLocaleString()} />
                <Tooltip formatter={v => fmt$(v)} contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }} />
                <Bar dataKey="cash" name="Cash ($)" radius={[6,6,0,0]}>
                  {personTotals.filter(p=>p.cash>0).map((p, i) => <Cell key={i} fill={p.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Tx by Type */}
        <Card title="Transactions by Type">
          {txByType.length === 0 ? <p style={{ color: '#CBD5E1' }}>No transactions yet</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={txByType} cx="50%" cy="50%" outerRadius={95} innerRadius={50} dataKey="count" nameKey="name" paddingAngle={3}>
                  {txByType.map((t, i) => <Cell key={i} fill={typeColors[t.name] || '#64748B'} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }} />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Tx over time */}
      {txByMonth.length > 1 && (
        <Card title="Transaction Activity Over Time" style={{ marginTop: 16 }}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={txByMonth} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }} />
              <Line type="monotone" dataKey="count" stroke="#5B21B6" strokeWidth={2.5} dot={{ r: 4, fill: '#5B21B6' }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </>
  )
}

// ══════════════════════════════════════
// RECORD TX
// ══════════════════════════════════════
function RecordTx({ data, viewData, isSuperAdmin, profile, save, toast }) {
  const blank = { date: new Date().toISOString().split('T')[0], type: '', memberId: '', assetId: '', fromAccount: '', toAccount: '', units: '', price: '', notes: '' }
  const [f, setF] = useState(blank)
  const members = isSuperAdmin ? data.members : data.members.filter(m => m.id === profile?.member_id)
  const member = data.members.find(m => m.id === f.memberId)
  const asset = data.assets.find(a => a.id === f.assetId)
  const total = (parseFloat(f.units)||0)*(parseFloat(f.price)||0)
  const showFrom = f.type==='Transfer'||f.type==='Sale'
  const showTo = f.type==='Transfer'||f.type==='Issuance'||f.type==='Buy'

  const submit = () => {
    if(!f.date||!f.type||!f.memberId||!f.assetId||!f.units){toast('Fill required fields');return}
    if(f.type==='Transfer'&&(!f.fromAccount||!f.toAccount)){toast('Transfer needs From & To');return}
    if(f.type==='Sale'&&!f.fromAccount){toast('Sale needs From');return}
    if((f.type==='Issuance'||f.type==='Buy')&&!f.toAccount){toast('Needs To account');return}
    const tx={id:uid(),date:f.date,type:f.type,memberId:f.memberId,memberName:member.name,assetId:f.assetId,assetTicker:asset.ticker,assetName:asset.name,fromAccount:f.fromAccount||'',toAccount:f.toAccount||'',units:parseFloat(f.units),price:parseFloat(f.price)||0,total,notes:f.notes}
    save({...data,transactions:[...data.transactions,tx]})
    setF(blank);toast('Recorded')
  }

  return (
    <Card title="Record Transaction" subtitle="Enter a new issuance, transfer, sale, or purchase.">
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}}>
        <Field label="Date *"><input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})} style={inp}/></Field>
        <Field label="Type *"><select value={f.type} onChange={e=>setF({...f,type:e.target.value,fromAccount:'',toAccount:''})} style={inp}><option value="">Select…</option>{TX_TYPES.map(t=><option key={t}>{t}</option>)}</select></Field>
        <Field label="Family Member *"><select value={f.memberId} onChange={e=>setF({...f,memberId:e.target.value,fromAccount:'',toAccount:''})} style={inp}><option value="">Select…</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Asset *"><select value={f.assetId} onChange={e=>setF({...f,assetId:e.target.value})} style={inp}><option value="">Select…</option>{data.assets.map(a=><option key={a.id} value={a.id}>{a.ticker} — {a.name}</option>)}</select></Field>
        {showFrom&&<Field label="From Account *"><select value={f.fromAccount} onChange={e=>setF({...f,fromAccount:e.target.value})} style={inp}><option value="">Select…</option>{member&&member.accounts.map(a=><option key={a}>{a}</option>)}</select></Field>}
        {showTo&&<Field label="To Account *"><select value={f.toAccount} onChange={e=>setF({...f,toAccount:e.target.value})} style={inp}><option value="">Select…</option>{member&&member.accounts.map(a=><option key={a}>{a}</option>)}</select></Field>}
        <Field label="Units *"><input type="number" min="0" value={f.units} onChange={e=>setF({...f,units:e.target.value})} style={inp} placeholder="0"/></Field>
        <Field label="Price / Unit ($)"><input type="number" min="0" step="0.01" value={f.price} onChange={e=>setF({...f,price:e.target.value})} style={inp} placeholder="0.00"/></Field>
        <Field label="Total"><div style={{...inp,background:'#F5F3FF',fontWeight:700,color:'#5B21B6'}}>{total?fmt$(total):'-'}</div></Field>
        <Field label="Notes"><input value={f.notes} onChange={e=>setF({...f,notes:e.target.value})} style={inp} placeholder="Optional…"/></Field>
      </div>
      <div style={{marginTop:16,display:'flex',gap:10}}>
        <button onClick={submit} style={btn1}>Record Transaction</button>
        <button onClick={()=>setF(blank)} style={btn2}>Clear</button>
      </div>
    </Card>
  )
}

// ══════════════════════════════════════
// LEDGER + EXPORT
// ══════════════════════════════════════
function Ledger({ data, fullData, save, toast, isSuperAdmin }) {
  const [search, setSearch] = useState('')
  const txs = useMemo(() => {
    let l=[...data.transactions].sort((a,b)=>b.date.localeCompare(a.date))
    if(search){const s=search.toLowerCase();l=l.filter(tx=>tx.memberName.toLowerCase().includes(s)||tx.assetTicker.toLowerCase().includes(s)||tx.type.toLowerCase().includes(s)||(tx.notes||'').toLowerCase().includes(s))}
    return l
  },[data.transactions,search])

  const del=id=>{save({...fullData,transactions:fullData.transactions.filter(t=>t.id!==id)});toast('Deleted')}
  const {headers,rows}=buildLedgerExport(txs)

  return (
    <Card title="Transaction Ledger" subtitle={`${data.transactions.length} transactions`}>
      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{...inp,maxWidth:300}}/>
        <button onClick={()=>exportCSV(rows,headers,'adraba-ledger.csv')} style={btn2}>📄 CSV</button>
        <button onClick={()=>exportPDF(rows,headers,'adraba — Transaction Ledger','adraba-ledger.pdf')} style={btn2}>📑 PDF</button>
      </div>
      {txs.length===0?<p style={{color:'#94A3B8',textAlign:'center',padding:40}}>No transactions.</p>:(
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr style={{background:'#F8FAFC',borderBottom:'2px solid #E2E8F0'}}>
              {['Date','Type','Person','Asset','From','To','Units','Price','Total','Notes',''].map(h=><th key={h} style={{...thL,whiteSpace:'nowrap'}}>{h}</th>)}
            </tr></thead>
            <tbody>{txs.map(tx=>(
              <tr key={tx.id} style={{borderBottom:'1px solid #F1F5F9'}}>
                <td style={{padding:'9px 10px',whiteSpace:'nowrap'}}>{tx.date}</td>
                <td style={{padding:'9px 10px'}}><span style={tag(typeColors[tx.type]||'#64748B')}>{tx.type}</span></td>
                <td style={{padding:'9px 10px',fontWeight:600}}>{tx.memberName}</td>
                <td style={{padding:'9px 10px'}}>{tx.assetTicker}</td>
                <td style={{padding:'9px 10px',color:'#64748B'}}>{tx.fromAccount||'—'}</td>
                <td style={{padding:'9px 10px',color:'#64748B'}}>{tx.toAccount||'—'}</td>
                <td style={{padding:'9px 10px',textAlign:'right',fontWeight:600}}>{fmtN(tx.units)}</td>
                <td style={{padding:'9px 10px',textAlign:'right'}}>{tx.price?fmt$(tx.price):'—'}</td>
                <td style={{padding:'9px 10px',textAlign:'right',fontWeight:600,color:'#5B21B6'}}>{tx.total?fmt$(tx.total):'—'}</td>
                <td style={{padding:'9px 10px',color:'#94A3B8',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tx.notes}</td>
                <td style={{padding:'9px 4px'}}>{isSuperAdmin&&<button onClick={()=>del(tx.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#EF4444',fontSize:15}}>×</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ══════════════════════════════════════
// HOLDINGS BY PERSON + EXPORT
// ══════════════════════════════════════
function HoldingsByPerson({ data, fullData }) {
  const h = useHoldings(data)
  const cash = useCash(data)
  const {headers,rows} = buildHoldingsExport(data, h, cash)

  return (
    <>
      <div style={{display:'flex',gap:10,marginBottom:14}}>
        <button onClick={()=>exportCSV(rows,headers,'adraba-holdings.csv')} style={btn2}>📄 Export CSV</button>
        <button onClick={()=>exportPDF(rows,headers,'adraba — Holdings by Person','adraba-holdings.pdf')} style={btn2}>📑 Export PDF</button>
      </div>
      {data.members.map((member,mi)=>{
        const color=mColors[mi%mColors.length]
        let mS=0,mC=0
        return (
          <Card key={member.id} style={{borderTop:`3px solid ${color}`}}>
            <h2 style={{fontSize:16,fontWeight:700,color,marginBottom:12}}>{member.name}</h2>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead><tr style={{background:'#F8FAFC',borderBottom:'2px solid #E2E8F0'}}>
                  <th style={thL}>Account</th>
                  {data.assets.map(a=><th key={a.id} style={thC}>{a.ticker}</th>)}
                  <th style={{...thC,fontWeight:700,color:'#1E293B'}}>Total</th>
                  <th style={{...thC,fontWeight:700,color:'#1E293B'}}>Cash</th>
                </tr></thead>
                <tbody>
                  {member.accounts.map(ac=>{
                    let rt=0,rc=0
                    const cells=data.assets.map(a=>{const v=h[`${member.id}|${a.id}|${ac}`]||0;rt+=v;return v})
                    data.assets.forEach(a=>{rc+=cash[`${member.id}|${a.id}|${ac}`]||0})
                    mS+=rt;mC+=rc
                    if(cells.every(v=>v===0)&&rc===0) return null
                    return (
                      <tr key={ac} style={{borderBottom:'1px solid #F1F5F9'}}>
                        <td style={{padding:'8px 12px',fontWeight:500}}>{ac}</td>
                        {cells.map((v,i)=><td key={i} style={{...tdC,color:v>0?'#1E293B':'#D1D5DB'}}>{fmtN(v)}</td>)}
                        <td style={{...tdC,fontWeight:700}}>{fmtN(rt)}</td>
                        <td style={{...tdC,color:rc>0?'#0D9488':'#D1D5DB',fontWeight:600}}>{rc>0?fmt$(rc):'-'}</td>
                      </tr>
                    )
                  })}
                  <tr style={{background:'#F5F3FF',borderTop:'2px solid #E2E8F0'}}>
                    <td style={{padding:'8px 12px',fontWeight:700,color}}>{member.name} Total</td>
                    {data.assets.map(a=>{let t=0;member.accounts.forEach(ac=>{t+=h[`${member.id}|${a.id}|${ac}`]||0});return <td key={a.id} style={{...tdC,fontWeight:700,color}}>{fmtN(t)}</td>})}
                    <td style={{...tdC,fontWeight:700,color}}>{fmtN(mS)}</td>
                    <td style={{...tdC,fontWeight:700,color}}>{fmt$(mC)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )
      })}
    </>
  )
}

// ══════════════════════════════════════
// HOLDINGS BY ASSET
// ══════════════════════════════════════
function HoldingsByAsset({ data }) {
  const h = useHoldings(data)
  const ac = {Stock:'#5B21B6',Warrant:'#0D9488',Art:'#F97316','Real Estate':'#2563EB',Crypto:'#7C3AED',Option:'#DC2626','Private Equity':'#0369A1',Other:'#64748B'}
  return (
    <>{data.assets.map(asset=>{
      const rows=[];let gt=0
      data.members.forEach(m=>m.accounts.forEach(a=>{const v=h[`${m.id}|${asset.id}|${a}`]||0;if(v!==0){rows.push({person:m.name,account:a,units:v});gt+=v}}))
      const color=ac[asset.type]||'#64748B'
      const av=data.assetValues?.[asset.id]
      return (
        <Card key={asset.id} style={{borderTop:`3px solid ${color}`}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,flexWrap:'wrap'}}>
            <h2 style={{fontSize:16,fontWeight:700,color}}>{asset.ticker}</h2>
            <span style={tag(color)}>{asset.type}</span>
            {!asset.liquid&&<span style={tag('#F97316')}>Illiquid</span>}
            <span style={{fontSize:12,color:'#94A3B8'}}>{asset.name}</span>
            {!asset.liquid&&av&&<span style={{fontSize:12,color:'#0D9488',fontWeight:600}}>Valued: {fmt$(av.value)} ({av.date})</span>}
          </div>
          {rows.length===0?<p style={{color:'#D1D5DB',fontSize:13}}>No holdings</p>:(
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{background:'#F8FAFC',borderBottom:'2px solid #E2E8F0'}}>
                {['Person','Account','Units','%'].map(hh=><th key={hh} style={thL}>{hh}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((r,i)=>(
                  <tr key={i} style={{borderBottom:'1px solid #F1F5F9'}}>
                    <td style={{padding:'8px 12px',fontWeight:600}}>{r.person}</td>
                    <td style={{padding:'8px 12px'}}>{r.account}</td>
                    <td style={{padding:'8px 12px',fontWeight:600}}>{fmtN(r.units)}</td>
                    <td style={{padding:'8px 12px',color}}>{gt>0?(r.units/gt*100).toFixed(1)+'%':'-'}</td>
                  </tr>
                ))}
                <tr style={{background:'#F5F3FF',borderTop:'2px solid #E2E8F0'}}>
                  <td colSpan={2} style={{padding:'8px 12px',fontWeight:700,color}}>Total</td>
                  <td style={{padding:'8px 12px',fontWeight:700,color}}>{fmtN(gt)}</td>
                  <td style={{padding:'8px 12px',fontWeight:700,color}}>100%</td>
                </tr>
              </tbody>
            </table>
          )}
        </Card>
      )
    })}</>
  )
}

// ══════════════════════════════════════
// CASH SUMMARY
// ══════════════════════════════════════
function CashSummary({ data }) {
  const cash = useCash(data)
  let grandTotal = 0
  const exportRows = []
  return (
    <Card title="Cash Summary" subtitle="Cash from all sales.">
      <div style={{display:'flex',gap:10,marginBottom:14}}>
        <button onClick={()=>{
          const h=['Person','Account',...data.assets.map(a=>a.ticker),'Total']
          const r=[]
          data.members.forEach(m=>m.accounts.forEach(ac=>{
            let rt=0;const vals=data.assets.map(a=>{const v=cash[`${m.id}|${a.id}|${ac}`]||0;rt+=v;return v})
            if(rt>0) r.push([m.name,ac,...vals,rt])
          }))
          exportCSV(r,h,'adraba-cash.csv')
        }} style={btn2}>📄 CSV</button>
        <button onClick={async ()=>{
          const h=['Person','Account',...data.assets.map(a=>a.ticker),'Total']
          const r=[]
          data.members.forEach(m=>m.accounts.forEach(ac=>{
            let rt=0;const vals=data.assets.map(a=>{const v=cash[`${m.id}|${a.id}|${ac}`]||0;rt+=v;return v?fmt$(v):'-'})
            if(rt>0) r.push([m.name,ac,...vals,fmt$(rt)])
          }))
          await exportPDF(r,h,'adraba — Cash Summary','adraba-cash.pdf')
        }} style={btn2}>📑 PDF</button>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr style={{background:'#F8FAFC',borderBottom:'2px solid #E2E8F0'}}>
            <th style={thL}>Person</th><th style={thL}>Account</th>
            {data.assets.map(a=><th key={a.id} style={thC}>{a.ticker}</th>)}
            <th style={{...thC,fontWeight:700}}>Total</th>
          </tr></thead>
          <tbody>
            {data.members.map(m=>{
              let mt=0
              const rows=m.accounts.map(ac=>{let rt=0;const vals=data.assets.map(a=>{const v=cash[`${m.id}|${a.id}|${ac}`]||0;rt+=v;return v});mt+=rt;return rt===0?null:{account:ac,vals,rt}}).filter(Boolean)
              grandTotal+=mt
              if(!rows.length) return null
              return rows.map((r,i)=>(
                <tr key={`${m.id}-${r.account}`} style={{borderBottom:'1px solid #F1F5F9'}}>
                  {i===0&&<td rowSpan={rows.length} style={{padding:'8px 12px',fontWeight:700,verticalAlign:'top',borderRight:'2px solid #E2E8F0'}}>{m.name}</td>}
                  <td style={{padding:'8px 12px'}}>{r.account}</td>
                  {r.vals.map((v,j)=><td key={j} style={{...tdC,color:v>0?'#1E293B':'#D1D5DB'}}>{v>0?fmt$(v):'-'}</td>)}
                  <td style={{...tdC,fontWeight:700,color:'#5B21B6'}}>{fmt$(r.rt)}</td>
                </tr>
              ))
            })}
            <tr style={{background:'#1E1B4B'}}>
              <td colSpan={2} style={{padding:'10px 12px',fontWeight:700,color:'#fff'}}>GRAND TOTAL</td>
              {data.assets.map(a=>{let t=0;Object.entries(cash).forEach(([k,v])=>{if(k.includes(`|${a.id}|`))t+=v});return <td key={a.id} style={{padding:'10px 10px',textAlign:'center',fontWeight:700,color:'#FBBF24'}}>{t>0?fmt$(t):'-'}</td>})}
              <td style={{padding:'10px 10px',textAlign:'center',fontWeight:700,color:'#FBBF24',fontSize:15}}>{fmt$(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ══════════════════════════════════════
// ADMIN: MEMBERS, ASSETS, ACCOUNTS
// ══════════════════════════════════════
function MemberForm({data,save,toast}){
  const [name,setName]=useState('');const [sel,setSel]=useState([])
  const toggle=a=>setSel(p=>p.includes(a)?p.filter(x=>x!==a):[...p,a])
  const add=()=>{if(!name.trim()){toast('Enter name');return};if(data.members.some(m=>m.name.toLowerCase()===name.trim().toLowerCase())){toast('Exists');return};save({...data,members:[...data.members,{id:uid(),name:name.trim(),accounts:sel.length?sel:['CST']}]});setName('');setSel([]);toast('Added')}
  const del=id=>{save({...data,members:data.members.filter(m=>m.id!==id)});toast('Removed')}
  const addA=(mid,a)=>save({...data,members:data.members.map(m=>m.id===mid&&!m.accounts.includes(a)?{...m,accounts:[...m.accounts,a]}:m)})
  const rmA=(mid,a)=>save({...data,members:data.members.map(m=>m.id===mid?{...m,accounts:m.accounts.filter(x=>x!==a)}:m)})
  return(<>
    <Card title="Add Family Member"><div style={{display:'grid',gridTemplateColumns:'200px 1fr auto',gap:14,alignItems:'end'}}>
      <Field label="Name *"><input value={name} onChange={e=>setName(e.target.value)} style={inp} placeholder="e.g. Sarah" onKeyDown={e=>e.key==='Enter'&&add()}/></Field>
      <Field label="Accounts"><div style={{display:'flex',flexWrap:'wrap',gap:6}}>{data.institutions.map(a=>(<button key={a} onClick={()=>toggle(a)} style={{padding:'5px 12px',borderRadius:20,border:sel.includes(a)?'2px solid #5B21B6':'1px solid #E2E8F0',background:sel.includes(a)?'#F5F3FF':'#fff',color:sel.includes(a)?'#5B21B6':'#64748B',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>{a}</button>))}</div></Field>
      <button onClick={add} style={btn1}>Add</button>
    </div></Card>
    <Card title="Current Members">{data.members.map(m=>(
      <div key={m.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:'1px solid #F1F5F9',flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:4}}>
          <span style={{fontWeight:700,marginRight:8,minWidth:80}}>{m.name}</span>
          {m.accounts.map(a=>(<span key={a} style={{...tag('#5B21B6'),cursor:'pointer',display:'inline-flex',alignItems:'center',gap:4}}>{a}<span onClick={()=>rmA(m.id,a)} style={{color:'#A78BFA',cursor:'pointer',fontSize:13}}>×</span></span>))}
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <select onChange={e=>{if(e.target.value){addA(m.id,e.target.value);e.target.value=''}}} style={{...inp,width:130,fontSize:12,padding:6}}><option value="">+ Account</option>{data.institutions.filter(a=>!m.accounts.includes(a)).map(a=><option key={a}>{a}</option>)}</select>
          <button onClick={()=>del(m.id)} style={{...btn2,color:'#EF4444',borderColor:'#FCA5A5',padding:'5px 10px',fontSize:12}}>Remove</button>
        </div>
      </div>
    ))}</Card>
  </>)
}

function AssetForm({data,save,toast}){
  const blank={name:'',ticker:'',desc:'',type:'Stock',liquid:true};const [f,setF]=useState(blank);const [vi,setVi]=useState({})
  const add=()=>{if(!f.name.trim()||!f.ticker.trim()){toast('Name & ticker required');return};save({...data,assets:[...data.assets,{id:uid(),...f,name:f.name.trim(),ticker:f.ticker.trim().toUpperCase()}]});setF(blank);toast('Added')}
  const del=id=>{save({...data,assets:data.assets.filter(a=>a.id!==id)});toast('Removed')}
  const setVal=(id,v)=>{save({...data,assetValues:{...data.assetValues,[id]:{value:parseFloat(v),date:new Date().toISOString().split('T')[0]}}});setVi({...vi,[id]:''});toast('Value set')}
  return(<>
    <Card title="Add New Asset" subtitle="Stocks, warrants, art, real estate, etc."><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,alignItems:'end'}}>
      <Field label="Name *"><input value={f.name} onChange={e=>setF({...f,name:e.target.value})} style={inp} placeholder="e.g. Apple"/></Field>
      <Field label="Ticker *"><input value={f.ticker} onChange={e=>setF({...f,ticker:e.target.value})} style={inp} placeholder="e.g. AAPL"/></Field>
      <Field label="Type"><select value={f.type} onChange={e=>setF({...f,type:e.target.value})} style={inp}>{ASSET_TYPES.map(t=><option key={t}>{t}</option>)}</select></Field>
      <Field label="Liquidity"><div style={{display:'flex',gap:8}}>{[true,false].map(l=><button key={String(l)} onClick={()=>setF({...f,liquid:l})} style={{flex:1,padding:8,borderRadius:8,fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'inherit',border:f.liquid===l?`2px solid ${l?'#0D9488':'#F97316'}`:'1px solid #E2E8F0',background:f.liquid===l?(l?'#ECFDF5':'#FFF7ED'):'#fff',color:f.liquid===l?(l?'#0D9488':'#F97316'):'#94A3B8'}}>{l?'Liquid':'Illiquid'}</button>)}</div></Field>
      <Field label="Description" span={3}><input value={f.desc} onChange={e=>setF({...f,desc:e.target.value})} style={inp} placeholder="Optional"/></Field>
      <div style={{display:'flex',alignItems:'end'}}><button onClick={add} style={btn1}>Add Asset</button></div>
    </div></Card>
    <Card title="Current Assets"><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
      <thead><tr style={{background:'#F8FAFC',borderBottom:'2px solid #E2E8F0'}}>{['Ticker','Name','Type','Liquid','Desc','Value',''].map(hh=><th key={hh} style={thL}>{hh}</th>)}</tr></thead>
      <tbody>{data.assets.map(a=>{const av=data.assetValues?.[a.id];return(
        <tr key={a.id} style={{borderBottom:'1px solid #F1F5F9'}}>
          <td style={{padding:'8px 12px',fontWeight:700}}>{a.ticker}</td>
          <td style={{padding:'8px 12px'}}>{a.name}</td>
          <td style={{padding:'8px 12px'}}><span style={tag(a.type==='Stock'?'#5B21B6':a.type==='Real Estate'?'#2563EB':'#F97316')}>{a.type}</span></td>
          <td style={{padding:'8px 12px'}}>{a.liquid?<span style={tag('#0D9488')}>Liquid</span>:<span style={tag('#F97316')}>Illiquid</span>}</td>
          <td style={{padding:'8px 12px',color:'#94A3B8'}}>{a.desc||'—'}</td>
          <td style={{padding:'8px 12px'}}>{a.liquid?<span style={{color:'#94A3B8',fontSize:12}}>Units × Price</span>:(
            <div style={{display:'flex',gap:4,alignItems:'center'}}>
              <input type="number" placeholder={av?String(av.value):'Value'} value={vi[a.id]||''} onChange={e=>setVi({...vi,[a.id]:e.target.value})} style={{...inp,width:100,padding:5,fontSize:12}}/>
              {vi[a.id]&&<button onClick={()=>setVal(a.id,vi[a.id])} style={{...btn2,padding:'3px 8px',fontSize:11}}>Set</button>}
              {av&&<span style={{fontSize:11,color:'#0D9488'}}>{fmt$(av.value)} ({av.date})</span>}
            </div>
          )}</td>
          <td style={{padding:'8px 4px'}}><button onClick={()=>del(a.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#EF4444',fontSize:15}}>×</button></td>
        </tr>
      )})}</tbody>
    </table></div></Card>
  </>)
}

function AccountForm({data,save,toast}){
  const [name,setName]=useState('')
  const add=()=>{if(!name.trim()){toast('Enter name');return};if(data.institutions.includes(name.trim())){toast('Exists');return};save({...data,institutions:[...data.institutions,name.trim()]});setName('');toast('Added')}
  const del=a=>{save({...data,institutions:data.institutions.filter(x=>x!==a)});toast('Removed')}
  return(<>
    <Card title="Add Financial Institution"><div style={{display:'flex',gap:14,alignItems:'end'}}>
      <Field label="Name *"><input value={name} onChange={e=>setName(e.target.value)} style={inp} placeholder="e.g. Fidelity" onKeyDown={e=>e.key==='Enter'&&add()}/></Field>
      <button onClick={add} style={btn1}>Add</button>
    </div></Card>
    <Card title="Current Institutions"><div style={{display:'flex',flexWrap:'wrap',gap:8}}>
      {data.institutions.map(a=>(
        <div key={a} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:10}}>
          <span style={{fontWeight:600,fontSize:14}}>{a}</span>
          <span style={{fontSize:11,color:'#94A3B8'}}>({data.members.filter(m=>m.accounts.includes(a)).map(m=>m.name).join(', ')||'none'})</span>
          <button onClick={()=>del(a)} style={{background:'none',border:'none',cursor:'pointer',color:'#CBD5E1',fontSize:14}}>×</button>
        </div>
      ))}
    </div></Card>
  </>)
}
