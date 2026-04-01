import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { loadData, saveData } from './lib/db'
import { hasSupa, signIn, signUp, signOut, getSession, getProfile, onAuthChange } from './lib/supabase'
import { exportCSV, exportPDF } from './lib/export'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const C = {
  gold:'#FFBE14', orange:'#FA8100', brown:'#675C47', dark:'#3D372C', cream:'#F4EDE5',
  bg:'#FAF8F5', white:'#FFFFFF', text:'#3D372C', muted:'#A09888', border:'#E5DDD3',
  success:'#2D9F6F', danger:'#D94545', info:'#3B82C4',
}
const chart8 = [C.gold, C.orange, C.brown, '#3B82C4', '#2D9F6F', '#9B6FD4', '#D94545', '#5BA3A3']
const TYPES = ['Stock','Warrant','Option','Art','Real Estate','Crypto','Private Equity','Other']
const TX = ['Issuance','Transfer','Sale','Buy']
const uid = () => Math.random().toString(36).slice(2, 10)
const fmt$ = n => !n ? '-' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 })
const fmtN = n => !n ? '-' : n.toLocaleString()
const fmtPct = n => `${n >= 0 ? '+' : ''}${n}%`

const cardS = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px 28px', marginBottom: 16 }
const inpS = { width: '100%', padding: '10px 14px', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 14, color: C.text, background: C.bg, outline: 'none', fontFamily: 'Rubik,sans-serif' }
const btnG = { padding: '10px 24px', background: C.gold, color: C.dark, border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'Rubik,sans-serif' }
const btnO = { ...btnG, background: 'transparent', border: `1.5px solid ${C.border}`, color: C.brown }
const tagS = c => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${c}20`, color: c })
const thS = { padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: C.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: `2px solid ${C.border}` }
const thC = { ...thS, textAlign: 'center' }
const tdC = { padding: '10px', textAlign: 'center' }
const txC = { Issuance: C.success, Transfer: C.brown, Sale: C.orange, Buy: C.info }

function useHoldings(data) {
  return useMemo(() => {
    const holdings = {}
    data.transactions.forEach(tx => {
      if (tx.toAccount) {
        const key = `${tx.memberId}|${tx.assetId}|${tx.toAccount}`
        holdings[key] = (holdings[key] || 0) + tx.units
      }
      if (tx.fromAccount) {
        const key = `${tx.memberId}|${tx.assetId}|${tx.fromAccount}`
        holdings[key] = (holdings[key] || 0) - tx.units
      }
    })
    return holdings
  }, [data.transactions])
}

function useCash(data) {
  return useMemo(() => {
    const cash = {}
    data.transactions.filter(tx => tx.type === 'Sale' && tx.total > 0).forEach(tx => {
      const key = `${tx.memberId}|${tx.assetId}|${tx.fromAccount}`
      cash[key] = (cash[key] || 0) + tx.total
    })
    return cash
  }, [data.transactions])
}

function filterForMember(data, memberId) {
  if (!memberId) {
    return data
  }
  return {
    ...data,
    members: data.members.filter(member => member.id === memberId),
    transactions: data.transactions.filter(tx => tx.memberId === memberId),
  }
}

async function fetchPrices(tickers) {
  try {
    const response = await fetch(`/api/prices?symbols=${tickers.join(',')}`)
    if (response.ok) {
      return await response.json()
    }
  } catch {}
  return {}
}

function Login({ onLocal }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login')

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    const { error: authError } = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password, email.split('@')[0])

    if (authError) {
      setError(authError.message)
    } else if (mode === 'signup') {
      setError('Account created! Sign in now.')
    }
    setLoading(false)
  }

  if (!hasSupa()) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.cream, fontFamily: 'Rubik' }}>
        <div style={{ ...cardS, maxWidth: 400, textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: C.dark, marginBottom: 4, letterSpacing: -1 }}>adraba</div>
          <p style={{ color: C.muted, fontSize: 14, marginBottom: 32 }}>Running in local mode</p>
          <button onClick={onLocal} style={{ ...btnG, width: '100%' }}>Enter as Admin</button>
          <p style={{ color: C.muted, fontSize: 11, marginTop: 16 }}>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for cloud auth</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${C.dark}, ${C.brown})`, fontFamily: 'Rubik' }}>
      <div style={{ ...cardS, maxWidth: 420, padding: '48px 40px', borderRadius: 24, boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
            <span style={{ color: C.gold }}>ad</span><span style={{ color: C.orange }}>ra</span><span style={{ color: C.brown }}>ba</span>
          </div>
          <p style={{ color: C.muted, fontSize: 14 }}>Growth & Capital Advisory</p>
        </div>

        <div style={{ display: 'flex', marginBottom: 24, background: C.cream, borderRadius: 10, padding: 3 }}>
          {['login', 'signup'].map(currentMode => (
            <button
              key={currentMode}
              onClick={() => { setMode(currentMode); setError('') }}
              style={{
                flex: 1,
                padding: 10,
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Rubik',
                background: mode === currentMode ? C.white : 'transparent',
                color: mode === currentMode ? C.dark : C.muted,
                boxShadow: mode === currentMode ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {currentMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.brown, display: 'block', marginBottom: 4 }}>Email</label>
            <input type="email" value={email} onChange={event => setEmail(event.target.value)} style={inpS} placeholder="you@example.com" onKeyDown={event => event.key === 'Enter' && handleSubmit()} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.brown, display: 'block', marginBottom: 4 }}>Password</label>
            <input type="password" value={password} onChange={event => setPassword(event.target.value)} style={inpS} placeholder="••••••••" onKeyDown={event => event.key === 'Enter' && handleSubmit()} />
          </div>
          {error && <p style={{ color: error.includes('created') ? C.success : C.danger, fontSize: 13, margin: 0 }}>{error}</p>}
          <button onClick={handleSubmit} disabled={loading} style={{ ...btnG, width: '100%', opacity: loading ? 0.6 : 1 }}>{loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [auth, setAuth] = useState('loading')
  const [profile, setProfile] = useState(null)
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('dashboard')
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)
  const [prices, setPrices] = useState({})

  const isAdmin = !hasSupa() || profile?.role === 'superadmin'
  const viewData = useMemo(() => data ? (isAdmin ? data : filterForMember(data, profile?.member_id)) : null, [data, profile, isAdmin])

  useEffect(() => {
    if (!hasSupa()) {
      setAuth('login')
      return
    }

    getSession().then(session => {
      if (session) {
        loadProfile(session.user.id)
      } else {
        setAuth('login')
      }
    })

    const { data: subscription } = onAuthChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        loadProfile(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        setAuth('login')
        setProfile(null)
        setData(null)
      }
    })

    return () => subscription?.subscription?.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const nextProfile = await getProfile(userId)
    setProfile(nextProfile || { role: 'member', member_id: null, display_name: 'User' })
    const nextData = await loadData()
    setData(nextData)
    setAuth('ready')
  }

  function localLogin() {
    setProfile({ role: 'superadmin', member_id: 'm1', display_name: 'Menny' })
    loadData().then(nextData => {
      setData(nextData)
      setAuth('ready')
    })
  }

  const save = useCallback(async nextData => {
    setData(nextData)
    setSaving(true)
    await saveData(nextData)
    setSaving(false)
  }, [])

  const show = message => {
    setToast(message)
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    if (!data) return
    const tickers = data.assets.filter(asset => asset.liquid).map(asset => asset.ticker)
    if (tickers.length) {
      fetchPrices(tickers).then(setPrices)
    }
  }, [data?.assets])

  if (auth === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Rubik', color: C.muted }}>
        <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    )
  }

  if (auth === 'login') return <Login onLocal={localLogin} />
  if (!data || !viewData) return null

  const nav = [
    { key: 'dashboard', icon: '◆', label: 'Dashboard' },
    { key: 'record', icon: '+', label: 'Record' },
    ...(isAdmin ? [
      { key: 'bulk', icon: '≡', label: 'Bulk Entry' },
      { key: 'upload', icon: '↑', label: 'Upload' },
    ] : []),
    { key: 'ledger', icon: '☰', label: 'Ledger' },
    { key: 'holdings', icon: '◎', label: 'By Person' },
    { key: 'byAsset', icon: '▣', label: 'By Asset' },
    { key: 'cash', icon: '$', label: 'Cash' },
    ...(isAdmin ? [{ key: 'admin', icon: '⚙', label: 'Admin' }] : []),
  ]

  return (
    <div style={{ fontFamily: 'Rubik,sans-serif', background: C.bg, minHeight: '100vh', color: C.text, display: 'flex' }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}input,select,textarea,button{font-family:Rubik,sans-serif}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}input[type=checkbox]{accent-color:${C.gold};width:16px;height:16px;cursor:pointer}`}</style>

      <div style={{ width: 200, background: C.dark, color: C.cream, position: 'fixed', top: 0, left: 0, bottom: 0, display: 'flex', flexDirection: 'column', zIndex: 100 }}>
        <div style={{ padding: '24px 20px 20px' }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1, marginBottom: 2 }}><span style={{ color: C.gold }}>ad</span><span style={{ color: C.orange }}>ra</span><span style={{ color: '#C4B8A8' }}>ba</span></div>
          <div style={{ fontSize: 10, color: '#8A7E70', letterSpacing: 1, textTransform: 'uppercase' }}>Holdings Tracker</div>
        </div>

        <nav style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {nav.map(item => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Rubik', fontSize: 13, fontWeight: tab === item.key ? 600 : 400, textAlign: 'left', background: tab === item.key ? 'rgba(255,190,20,0.12)' : 'transparent', color: tab === item.key ? C.gold : '#A09888', transition: 'all 0.15s',
              }}
            >
              <span style={{ width: 20, textAlign: 'center', fontSize: 15, opacity: tab === item.key ? 1 : 0.5 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 12 }}>
          <div style={{ color: '#A09888', marginBottom: 6 }}>{profile?.display_name}{isAdmin && <span style={{ color: C.gold, marginLeft: 6, fontSize: 10 }}>ADMIN</span>}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {saving && <span style={{ color: C.gold, fontSize: 10 }}>● saving</span>}
            <button onClick={async () => { await signOut(); setAuth('login'); setProfile(null); setData(null) }} style={{ background: 'none', border: 'none', color: '#8A7E70', cursor: 'pointer', fontSize: 12, fontFamily: 'Rubik', padding: 0 }}>Sign out</button>
          </div>
        </div>
      </div>

      <div style={{ marginLeft: 200, flex: 1, padding: '24px 32px', maxWidth: 1200, animation: 'fadeIn 0.2s' }} key={tab}>
        {tab === 'dashboard' && <Dashboard data={viewData} prices={prices} />}
        {tab === 'record' && <RecordTx data={data} isAdmin={isAdmin} profile={profile} save={save} show={show} />}
        {tab === 'bulk' && isAdmin && <BulkEntry data={data} isAdmin={isAdmin} profile={profile} save={save} show={show} />}
        {tab === 'upload' && isAdmin && <UploadXLS data={data} save={save} show={show} />}
        {tab === 'ledger' && <Ledger data={viewData} fullData={data} save={save} show={show} isAdmin={isAdmin} />}
        {tab === 'holdings' && <Holdings data={viewData} prices={prices} />}
        {tab === 'byAsset' && <ByAsset data={viewData} prices={prices} />}
        {tab === 'cash' && <CashView data={viewData} />}
        {tab === 'admin' && isAdmin && <Admin data={data} save={save} show={show} prices={prices} />}
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: C.dark, color: C.cream, padding: '10px 28px', borderRadius: 12, fontSize: 14, fontWeight: 500, boxShadow: '0 8px 30px rgba(0,0,0,0.2)', zIndex: 999, animation: 'fadeIn 0.2s' }}>{toast}</div>}
    </div>
  )
}

function Dashboard({ data, prices }) {
  const holdings = useHoldings(data)
  const cash = useCash(data)
  const assetTotals = data.assets.map(asset => {
    let units = 0
    data.members.forEach(member => member.accounts.forEach(account => { units += holdings[`${member.id}|${asset.id}|${account}`] || 0 }))
    return { name: asset.ticker, units, value: units * (prices[asset.ticker]?.price || 0) }
  }).filter(asset => asset.units > 0)
  const personTotals = data.members.map((member, index) => {
    let shares = 0
    let cashValue = 0
    let portfolioValue = 0
    member.accounts.forEach(account => data.assets.forEach(asset => {
      const units = holdings[`${member.id}|${asset.id}|${account}`] || 0
      shares += units
      portfolioValue += units * (prices[asset.ticker]?.price || 0)
      cashValue += cash[`${member.id}|${asset.id}|${account}`] || 0
    }))
    return { name: member.name, shares, cash: cashValue, value: portfolioValue, color: chart8[index % 8] }
  })
  const totalValue = personTotals.reduce((sum, item) => sum + item.value, 0)
  const totalCash = personTotals.reduce((sum, item) => sum + item.cash, 0)
  const KPI = ({ label, value, accent }) => (
    <div style={{ ...cardS, borderTop: `3px solid ${accent}`, padding: '20px 24px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: C.dark, letterSpacing: -0.5 }}>{value}</div>
    </div>
  )
  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 20 }}>Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        <KPI label="Portfolio Value" value={fmt$(totalValue)} accent={C.gold} />
        <KPI label="Cash from Sales" value={fmt$(totalCash)} accent={C.orange} />
        <KPI label="Total Units" value={fmtN(personTotals.reduce((sum, item) => sum + item.shares, 0))} accent={C.brown} />
        <KPI label="Transactions" value={data.transactions.length} accent={C.info} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={cardS}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: C.dark, marginBottom: 16 }}>Holdings Value by Asset</h3>
          {assetTotals.length === 0 ? <p style={{ color: C.muted }}>No data</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={assetTotals}>
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={value => `$${value.toLocaleString()}`} />
                <Tooltip formatter={value => fmt$(value)} contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'Rubik' }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>{assetTotals.map((_, index) => <Cell key={index} fill={chart8[index % 8]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div style={cardS}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: C.dark, marginBottom: 16 }}>Distribution by Person</h3>
          {personTotals.filter(item => item.shares > 0).length === 0 ? <p style={{ color: C.muted }}>No data</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={personTotals.filter(item => item.shares > 0)} cx="50%" cy="50%" outerRadius={90} innerRadius={48} dataKey="shares" nameKey="name" paddingAngle={2}>{personTotals.filter(item => item.shares > 0).map((item, index) => <Cell key={index} fill={item.color} />)}</Pie>
                <Tooltip formatter={value => fmtN(value)} contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13 }} />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  )
}

function RecordTx({ data, isAdmin, profile, save, show }) {
  const blank = { date: new Date().toISOString().split('T')[0], type: '', memberId: '', assetId: '', fromAccount: '', toAccount: '', units: '', price: '', notes: '' }
  const [form, setForm] = useState(blank)
  const members = isAdmin ? data.members : data.members.filter(member => member.id === profile?.member_id)
  const member = data.members.find(item => item.id === form.memberId)
  const asset = data.assets.find(item => item.id === form.assetId)
  const total = (parseFloat(form.units) || 0) * (parseFloat(form.price) || 0)
  const showFrom = form.type === 'Transfer' || form.type === 'Sale'
  const showTo = form.type === 'Transfer' || form.type === 'Issuance' || form.type === 'Buy'

  const submit = () => {
    if (!form.date || !form.type || !form.memberId || !form.assetId || !form.units) { show('Fill required fields'); return }
    if (form.type === 'Transfer' && (!form.fromAccount || !form.toAccount)) { show('Transfer needs From & To'); return }
    if (form.type === 'Sale' && !form.fromAccount) { show('Sale needs From'); return }
    if ((form.type === 'Issuance' || form.type === 'Buy') && !form.toAccount) { show('Needs To account'); return }

    save({
      ...data,
      transactions: [...data.transactions, {
        id: uid(),
        date: form.date,
        type: form.type,
        memberId: form.memberId,
        memberName: member.name,
        assetId: form.assetId,
        assetTicker: asset.ticker,
        assetName: asset.name,
        fromAccount: form.fromAccount || '',
        toAccount: form.toAccount || '',
        units: parseFloat(form.units),
        price: parseFloat(form.price) || 0,
        total,
        notes: form.notes,
      }],
    })
    setForm(blank)
    show('Recorded')
  }

  const Field = ({ label, children }) => (<div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>{children}</div>)

  return (
    <div style={cardS}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: C.dark, marginBottom: 4 }}>Record Transaction</h2>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Single transaction entry</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <Field label="Date *"><input type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} style={inpS} /></Field>
        <Field label="Type *"><select value={form.type} onChange={event => setForm({ ...form, type: event.target.value, fromAccount: '', toAccount: '' })} style={inpS}><option value="">Select…</option>{TX.map(type => <option key={type}>{type}</option>)}</select></Field>
        <Field label="Member *"><select value={form.memberId} onChange={event => setForm({ ...form, memberId: event.target.value, fromAccount: '', toAccount: '' })} style={inpS}><option value="">Select…</option>{members.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Asset *"><select value={form.assetId} onChange={event => setForm({ ...form, assetId: event.target.value })} style={inpS}><option value="">Select…</option>{data.assets.map(item => <option key={item.id} value={item.id}>{item.ticker} — {item.name}</option>)}</select></Field>
        {showFrom && <Field label="From *"><select value={form.fromAccount} onChange={event => setForm({ ...form, fromAccount: event.target.value })} style={inpS}><option value="">Select…</option>{member?.accounts.map(account => <option key={account}>{account}</option>)}</select></Field>}
        {showTo && <Field label="To *"><select value={form.toAccount} onChange={event => setForm({ ...form, toAccount: event.target.value })} style={inpS}><option value="">Select…</option>{member?.accounts.map(account => <option key={account}>{account}</option>)}</select></Field>}
        <Field label="Units *"><input type="number" min="0" value={form.units} onChange={event => setForm({ ...form, units: event.target.value })} style={inpS} placeholder="0" /></Field>
        <Field label="Price ($)"><input type="number" min="0" step="0.01" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} style={inpS} placeholder="0.00" /></Field>
        <Field label="Total"><div style={{ ...inpS, background: C.cream, fontWeight: 700, color: C.dark }}>{total ? fmt$(total) : '-'}</div></Field>
        <Field label="Notes"><input value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} style={inpS} placeholder="Optional" /></Field>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
        <button onClick={submit} style={btnG}>Record</button>
        <button onClick={() => setForm(blank)} style={btnO}>Clear</button>
      </div>
    </div>
  )
}

function BulkEntry({ data, isAdmin, profile, save, show }) {
  const emptyRow = () => ({ key: uid(), date: new Date().toISOString().split('T')[0], type: '', memberId: '', assetId: '', fromAccount: '', toAccount: '', units: '', price: '', notes: '' })
  const [rows, setRows] = useState(() => Array.from({ length: 5 }, emptyRow))
  const members = isAdmin ? data.members : data.members.filter(member => member.id === profile?.member_id)
  const update = (index, field, value) => {
    const nextRows = [...rows]
    nextRows[index] = { ...nextRows[index], [field]: value }
    if (field === 'type' || field === 'memberId') {
      nextRows[index].fromAccount = ''
      nextRows[index].toAccount = ''
    }
    setRows(nextRows)
  }
  const submitAll = () => {
    const validRows = rows.filter(row => row.type && row.memberId && row.assetId && row.units)
    if (!validRows.length) { show('No valid rows'); return }
    const transactions = validRows.map(row => {
      const member = data.members.find(item => item.id === row.memberId)
      const asset = data.assets.find(item => item.id === row.assetId)
      const units = parseFloat(row.units) || 0
      const price = parseFloat(row.price) || 0
      return {
        id: uid(),
        date: row.date,
        type: row.type,
        memberId: row.memberId,
        memberName: member?.name || '',
        assetId: row.assetId,
        assetTicker: asset?.ticker || '',
        assetName: asset?.name || '',
        fromAccount: row.fromAccount || '',
        toAccount: row.toAccount || '',
        units,
        price,
        total: units * price,
        notes: row.notes,
      }
    })
    save({ ...data, transactions: [...data.transactions, ...transactions] })
    setRows(Array.from({ length: 5 }, emptyRow))
    show(`${transactions.length} transactions recorded`)
  }

  const cellInp = { ...inpS, padding: '6px 8px', fontSize: 12, borderRadius: 6, background: C.white }

  return (
    <div style={cardS}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: C.dark, marginBottom: 4 }}>Bulk Entry</h2>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Enter multiple transactions at once — spreadsheet style</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ background: C.cream }}>{['Date', 'Type', 'Member', 'Asset', 'From', 'To', 'Units', 'Price', 'Notes'].map(header => <th key={header} style={{ ...thS, padding: '8px 6px', fontSize: 10 }}>{header}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, index) => {
              const member = data.members.find(item => item.id === row.memberId)
              return (
                <tr key={row.key} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: 3 }}><input type="date" value={row.date} onChange={event => update(index, 'date', event.target.value)} style={{ ...cellInp, width: 120 }} /></td>
                  <td style={{ padding: 3 }}><select value={row.type} onChange={event => update(index, 'type', event.target.value)} style={{ ...cellInp, width: 90 }}><option value="">—</option>{TX.map(type => <option key={type}>{type}</option>)}</select></td>
                  <td style={{ padding: 3 }}><select value={row.memberId} onChange={event => update(index, 'memberId', event.target.value)} style={{ ...cellInp, width: 100 }}><option value="">—</option>{members.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></td>
                  <td style={{ padding: 3 }}><select value={row.assetId} onChange={event => update(index, 'assetId', event.target.value)} style={{ ...cellInp, width: 100 }}><option value="">—</option>{data.assets.map(item => <option key={item.id} value={item.id}>{item.ticker}</option>)}</select></td>
                  <td style={{ padding: 3 }}><select value={row.fromAccount} onChange={event => update(index, 'fromAccount', event.target.value)} style={{ ...cellInp, width: 90 }}><option value="">—</option>{member?.accounts.map(account => <option key={account}>{account}</option>)}</select></td>
                  <td style={{ padding: 3 }}><select value={row.toAccount} onChange={event => update(index, 'toAccount', event.target.value)} style={{ ...cellInp, width: 90 }}><option value="">—</option>{member?.accounts.map(account => <option key={account}>{account}</option>)}</select></td>
                  <td style={{ padding: 3 }}><input type="number" value={row.units} onChange={event => update(index, 'units', event.target.value)} style={{ ...cellInp, width: 70 }} placeholder="0" /></td>
                  <td style={{ padding: 3 }}><input type="number" value={row.price} onChange={event => update(index, 'price', event.target.value)} style={{ ...cellInp, width: 80 }} placeholder="0.00" /></td>
                  <td style={{ padding: 3 }}><input value={row.notes} onChange={event => update(index, 'notes', event.target.value)} style={{ ...cellInp, width: 120 }} placeholder="Notes" /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
        <button onClick={submitAll} style={btnG}>Submit All Valid Rows</button>
        <button onClick={() => setRows([...rows, ...Array.from({ length: 5 }, emptyRow)])} style={btnO}>+ 5 More Rows</button>
        <button onClick={() => setRows(Array.from({ length: 5 }, emptyRow))} style={btnO}>Clear All</button>
      </div>
    </div>
  )
}

function UploadXLS({ data, save, show }) {
  const fileRef = useRef()
  const [preview, setPreview] = useState(null)
  const handleFile = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer)
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    setPreview(XLSX.utils.sheet_to_json(worksheet, { defval: '' }))
  }
  const importRows = () => {
    if (!preview?.length) { show('No data'); return }
    const transactions = preview.map(row => {
      const memberName = String(row.Member || row['Family Member'] || row.Person || '').trim()
      const ticker = String(row.Ticker || row.Asset || row.Symbol || '').trim().toUpperCase()
      const member = data.members.find(item => item.name.toLowerCase() === memberName.toLowerCase())
      const asset = data.assets.find(item => item.ticker === ticker)
      if (!member || !asset) return null
      const units = parseFloat(row.Units || row.Shares || 0)
      const price = parseFloat(row.Price || row['Price/Share'] || row['Price per Unit'] || 0)
      return {
        id: uid(),
        date: String(row.Date || new Date().toISOString().split('T')[0]),
        type: String(row.Type || 'Issuance'),
        memberId: member.id,
        memberName: member.name,
        assetId: asset.id,
        assetTicker: asset.ticker,
        assetName: asset.name,
        fromAccount: String(row.From || row['From Account'] || ''),
        toAccount: String(row.To || row['To Account'] || ''),
        units,
        price,
        total: units * price,
        notes: String(row.Notes || ''),
      }
    }).filter(Boolean)
    if (!transactions.length) { show('No matching rows found'); return }
    save({ ...data, transactions: [...data.transactions, ...transactions] })
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
    show(`${transactions.length} transactions imported`)
  }

  return (
    <div style={cardS}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: C.dark, marginBottom: 4 }}>Upload Transactions</h2>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Upload an Excel file with columns: Date, Type, Member, Ticker, From, To, Units, Price, Notes</p>
      <div style={{ border: `2px dashed ${C.border}`, borderRadius: 16, padding: 40, textAlign: 'center', background: C.cream, marginBottom: 16 }}>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} id="file-upload" />
        <label htmlFor="file-upload" style={{ cursor: 'pointer' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.dark }}>Click to select file or drag & drop</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>.xlsx, .xls, or .csv</div>
        </label>
      </div>
      {preview && (
        <>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 8 }}>{preview.length} rows found — preview:</p>
          <div style={{ overflowX: 'auto', maxHeight: 300 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ background: C.cream }}>{Object.keys(preview[0] || {}).map(header => <th key={header} style={{ ...thS, fontSize: 10, padding: '6px 8px' }}>{header}</th>)}</tr></thead>
              <tbody>{preview.slice(0, 10).map((row, rowIndex) => <tr key={rowIndex} style={{ borderBottom: `1px solid ${C.border}` }}>{Object.values(row).map((value, valueIndex) => <td key={valueIndex} style={{ padding: '6px 8px', fontSize: 12 }}>{String(value)}</td>)}</tr>)}</tbody>
            </table>
          </div>
          {preview.length > 10 && <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>…and {preview.length - 10} more rows</p>}
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button onClick={importRows} style={btnG}>Import {preview.length} Rows</button>
            <button onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = '' }} style={btnO}>Cancel</button>
          </div>
        </>
      )}
    </div>
  )
}

function Ledger({ data, fullData, save, show, isAdmin }) {
  const [query, setQuery] = useState('')
  const transactions = useMemo(() => {
    let list = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date))
    if (query) {
      const search = query.toLowerCase()
      list = list.filter(tx => tx.memberName.toLowerCase().includes(search) || tx.assetTicker.toLowerCase().includes(search) || tx.type.toLowerCase().includes(search) || (tx.notes || '').toLowerCase().includes(search))
    }
    return list
  }, [data.transactions, query])

  const remove = id => {
    save({ ...fullData, transactions: fullData.transactions.filter(tx => tx.id !== id) })
    show('Deleted')
  }

  const headers = ['Date', 'Type', 'Person', 'Asset', 'From', 'To', 'Units', 'Price', 'Total', 'Notes']
  const rows = transactions.map(tx => [tx.date, tx.type, tx.memberName, tx.assetTicker, tx.fromAccount || '', tx.toAccount || '', tx.units, tx.price || '', tx.total || '', tx.notes || ''])

  return (
    <div style={cardS}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.dark }}>Transaction Ledger</h2>
          <p style={{ fontSize: 13, color: C.muted }}>{data.transactions.length} transactions</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search…" style={{ ...inpS, width: 220, padding: '8px 12px', fontSize: 13 }} />
          <button onClick={() => exportCSV(rows, headers, 'adraba-ledger.csv')} style={btnO}>CSV</button>
          <button onClick={() => exportPDF(rows, headers, 'Transaction Ledger', 'adraba-ledger.pdf')} style={btnO}>PDF</button>
        </div>
      </div>
      {transactions.length === 0 ? <p style={{ color: C.muted, textAlign: 'center', padding: 40 }}>No transactions.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>{['Date', 'Type', 'Person', 'Asset', 'From', 'To', 'Units', 'Price', 'Total', 'Notes', ''].map(header => <th key={header} style={thS}>{header}</th>)}</tr></thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{tx.date}</td>
                  <td style={{ padding: '10px 12px' }}><span style={tagS(txC[tx.type] || C.muted)}>{tx.type}</span></td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{tx.memberName}</td>
                  <td style={{ padding: '10px 12px' }}>{tx.assetTicker}</td>
                  <td style={{ padding: '10px 12px', color: C.muted }}>{tx.fromAccount || '—'}</td>
                  <td style={{ padding: '10px 12px', color: C.muted }}>{tx.toAccount || '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{fmtN(tx.units)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{tx.price ? fmt$(tx.price) : '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: C.dark }}>{tx.total ? fmt$(tx.total) : '—'}</td>
                  <td style={{ padding: '10px 12px', color: C.muted, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.notes}</td>
                  <td>{isAdmin && <button onClick={() => remove(tx.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.danger, fontSize: 14 }}>×</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Holdings({ data, prices }) {
  const holdings = useHoldings(data)
  const cash = useCash(data)
  const [checked, setChecked] = useState({})

  const headers = ['Person', 'Account', ...data.assets.map(asset => asset.ticker), 'Value ($)', 'Cash ($)']
  const rows = []
  data.members.forEach(member => member.accounts.forEach(account => {
    let rowValue = 0
    let rowCash = 0
    const cells = data.assets.map(asset => {
      const units = holdings[`${member.id}|${asset.id}|${account}`] || 0
      rowValue += units * (prices[asset.ticker]?.price || 0)
      return units
    })
    data.assets.forEach(asset => { rowCash += cash[`${member.id}|${asset.id}|${account}`] || 0 })
    if (cells.some(value => value !== 0)) rows.push([member.name, account, ...cells, rowValue ? fmt$(rowValue) : '', rowCash ? fmt$(rowCash) : ''])
  }))

  const selectedTotal = data.members.reduce((sum, member) => sum + member.accounts.reduce((accountSum, account) => {
    const key = `${member.id}|all|${account}`
    if (!checked[key]) return accountSum
    const accountValue = data.assets.reduce((valueSum, asset) => valueSum + (holdings[`${member.id}|${asset.id}|${account}`] || 0) * (prices[asset.ticker]?.price || 0), 0)
    return accountSum + accountValue
  }, 0), 0)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C.dark }}>Holdings by Person</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => exportCSV(rows, headers, 'adraba-holdings.csv')} style={btnO}>CSV</button>
          <button onClick={() => exportPDF(rows, headers, 'Holdings by Person', 'adraba-holdings.pdf')} style={btnO}>PDF</button>
        </div>
      </div>
      {data.members.map((member, index) => {
        let memberValue = 0
        let memberCash = 0
        return (
          <div key={member.id} style={{ ...cardS, borderLeft: `4px solid ${chart8[index % 8]}` }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: chart8[index % 8], marginBottom: 12 }}>{member.name}</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr><th style={{ ...thS, width: 30 }}></th><th style={thS}>Account</th>{data.assets.map(asset => <th key={asset.id} style={thC}>{asset.ticker}</th>)}<th style={{ ...thC, fontWeight: 700 }}>Value</th><th style={{ ...thC, fontWeight: 700 }}>Cash</th></tr></thead>
                <tbody>
                  {member.accounts.map(account => {
                    let rowValue = 0
                    let rowCash = 0
                    const cells = data.assets.map(asset => {
                      const units = holdings[`${member.id}|${asset.id}|${account}`] || 0
                      rowValue += units * (prices[asset.ticker]?.price || 0)
                      return units
                    })
                    data.assets.forEach(asset => { rowCash += cash[`${member.id}|${asset.id}|${account}`] || 0 })
                    memberValue += rowValue
                    memberCash += rowCash
                    if (cells.every(value => value === 0) && rowCash === 0) return null
                    const key = `${member.id}|all|${account}`
                    return (
                      <tr key={account} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}><input type="checkbox" checked={!!checked[key]} onChange={() => setChecked(prev => ({ ...prev, [key]: !prev[key] }))} /></td>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{account}</td>
                        {cells.map((value, valueIndex) => <td key={valueIndex} style={{ ...tdC, color: value > 0 ? C.text : C.border }}>{fmtN(value)}</td>)}
                        <td style={{ ...tdC, fontWeight: 600, color: C.dark }}>{rowValue ? fmt$(rowValue) : '-'}</td>
                        <td style={{ ...tdC, color: rowCash ? C.success : C.border, fontWeight: 600 }}>{rowCash ? fmt$(rowCash) : '-'}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: C.cream, borderTop: `2px solid ${C.border}` }}>
                    <td></td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: chart8[index % 8] }}>{member.name} Total</td>
                    {data.assets.map(asset => {
                      let totalUnits = 0
                      member.accounts.forEach(account => { totalUnits += holdings[`${member.id}|${asset.id}|${account}`] || 0 })
                      return <td key={asset.id} style={{ ...tdC, fontWeight: 700, color: chart8[index % 8] }}>{fmtN(totalUnits)}</td>
                    })}
                    <td style={{ ...tdC, fontWeight: 700, color: chart8[index % 8] }}>{fmt$(memberValue)}</td>
                    <td style={{ ...tdC, fontWeight: 700, color: chart8[index % 8] }}>{fmt$(memberCash)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
      {Object.values(checked).some(Boolean) && <div style={{ position: 'fixed', bottom: 24, right: 32, background: C.dark, color: C.cream, padding: '14px 24px', borderRadius: 14, fontSize: 14, fontWeight: 600, boxShadow: '0 8px 30px rgba(0,0,0,0.2)', zIndex: 50, display: 'flex', alignItems: 'center', gap: 12 }}><span>Selected total:</span><span style={{ color: C.gold, fontSize: 18, fontWeight: 700 }}>{fmt$(selectedTotal)}</span></div>}
    </>
  )
}

function ByAsset({ data, prices }) {
  const holdings = useHoldings(data)
  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 16 }}>Holdings by Asset</h1>
      {data.assets.map((asset, index) => {
        const rows = []
        let totalUnits = 0
        data.members.forEach(member => member.accounts.forEach(account => {
          const units = holdings[`${member.id}|${asset.id}|${account}`] || 0
          if (units) {
            rows.push({ person: member.name, account, units })
            totalUnits += units
          }
        }))
        const price = prices[asset.ticker]
        return (
          <div key={asset.id} style={{ ...cardS, borderLeft: `4px solid ${chart8[index % 8]}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: chart8[index % 8] }}>{asset.ticker}</h3>
              <span style={tagS(chart8[index % 8])}>{asset.type}</span>
              <span style={{ fontSize: 12, color: C.muted }}>{asset.name}</span>
              {price && <span style={{ fontSize: 13, fontWeight: 600, color: C.dark }}>{fmt$(price.price)}</span>}
              {price?.change && <span style={{ fontSize: 12, fontWeight: 600, color: parseFloat(price.change) >= 0 ? C.success : C.danger }}>{fmtPct(price.change)}</span>}
            </div>
            {rows.length === 0 ? <p style={{ color: C.muted, fontSize: 13 }}>No holdings</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr>{['Person', 'Account', 'Units', 'Value', '%'].map(header => <th key={header} style={thS}>{header}</th>)}</tr></thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.person}</td>
                      <td style={{ padding: '8px 12px' }}>{row.account}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{fmtN(row.units)}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: C.dark }}>{price ? fmt$(row.units * price.price) : '-'}</td>
                      <td style={{ padding: '8px 12px', color: chart8[index % 8] }}>{totalUnits ? `${((row.units / totalUnits) * 100).toFixed(1)}%` : '-'}</td>
                    </tr>
                  ))}
                  <tr style={{ background: C.cream, borderTop: `2px solid ${C.border}` }}>
                    <td colSpan={2} style={{ padding: '8px 12px', fontWeight: 700, color: chart8[index % 8] }}>Total</td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: chart8[index % 8] }}>{fmtN(totalUnits)}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: chart8[index % 8] }}>{price ? fmt$(totalUnits * price.price) : '-'}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: chart8[index % 8] }}>100%</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        )
      })}
    </>
  )
}

function CashView({ data }) {
  const cash = useCash(data)
  let grandTotal = 0
  return (
    <div style={cardS}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.dark }}>Cash Summary</h2>
          <p style={{ fontSize: 13, color: C.muted }}>Proceeds from all sales</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => {
            const headers = ['Person', 'Account', ...data.assets.map(asset => asset.ticker), 'Total']
            const rows = []
            data.members.forEach(member => member.accounts.forEach(account => {
              let rowTotal = 0
              const values = data.assets.map(asset => {
                const current = cash[`${member.id}|${asset.id}|${account}`] || 0
                rowTotal += current
                return current
              })
              if (rowTotal > 0) rows.push([member.name, account, ...values, rowTotal])
            }))
            exportCSV(rows, headers, 'adraba-cash.csv')
          }} style={btnO}>CSV</button>
          <button onClick={async () => {
            const headers = ['Person', 'Account', ...data.assets.map(asset => asset.ticker), 'Total']
            const rows = []
            data.members.forEach(member => member.accounts.forEach(account => {
              let rowTotal = 0
              const values = data.assets.map(asset => {
                const current = cash[`${member.id}|${asset.id}|${account}`] || 0
                rowTotal += current
                return current > 0 ? fmt$(current) : '-'
              })
              if (rowTotal > 0) rows.push([member.name, account, ...values, fmt$(rowTotal)])
            }))
            await exportPDF(rows, headers, 'Cash Summary', 'adraba-cash.pdf')
          }} style={btnO}>PDF</button>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr><th style={thS}>Person</th><th style={thS}>Account</th>{data.assets.map(asset => <th key={asset.id} style={thC}>{asset.ticker}</th>)}<th style={{ ...thC, fontWeight: 700 }}>Total</th></tr></thead>
          <tbody>
            {data.members.map(member => {
              let memberTotal = 0
              const memberRows = member.accounts.map(account => {
                let rowTotal = 0
                const values = data.assets.map(asset => {
                  const current = cash[`${member.id}|${asset.id}|${account}`] || 0
                  rowTotal += current
                  return current
                })
                memberTotal += rowTotal
                return rowTotal ? { account, values, rowTotal } : null
              }).filter(Boolean)
              grandTotal += memberTotal
              return memberRows.map((row, rowIndex) => (
                <tr key={`${member.id}-${row.account}`} style={{ borderBottom: `1px solid ${C.border}` }}>
                  {rowIndex === 0 && <td rowSpan={memberRows.length} style={{ padding: '8px 12px', fontWeight: 700, verticalAlign: 'top', borderRight: `2px solid ${C.border}` }}>{member.name}</td>}
                  <td style={{ padding: '8px 12px' }}>{row.account}</td>
                  {row.values.map((value, valueIndex) => <td key={valueIndex} style={{ ...tdC, color: value ? C.text : C.border }}>{value ? fmt$(value) : '-'}</td>)}
                  <td style={{ ...tdC, fontWeight: 700, color: C.dark }}>{fmt$(row.rowTotal)}</td>
                </tr>
              ))
            })}
            <tr style={{ background: C.dark }}>
              <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 700, color: C.cream }}>GRAND TOTAL</td>
              {data.assets.map(asset => {
                let total = 0
                Object.entries(cash).forEach(([key, value]) => { if (key.includes(`|${asset.id}|`)) total += value })
                return <td key={asset.id} style={{ ...tdC, fontWeight: 700, color: C.gold }}>{total ? fmt$(total) : '-'}</td>
              })}
              <td style={{ ...tdC, fontWeight: 700, color: C.gold, fontSize: 15 }}>{fmt$(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Admin({ data, save, show, prices }) {
  const [subtab, setSubtab] = useState('members')
  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 16 }}>Administration</h1>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {[['members', 'Members'], ['assets', 'Assets'], ['accounts', 'Accounts']].map(([key, label]) => (
          <button key={key} onClick={() => setSubtab(key)} style={{ padding: '10px 20px', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: subtab === key ? 600 : 400, cursor: 'pointer', fontFamily: 'Rubik', background: subtab === key ? `${C.gold}30` : C.cream, color: subtab === key ? C.dark : C.muted }}>{label}</button>
        ))}
      </div>
      {subtab === 'members' && <MembersAdmin data={data} save={save} show={show} />}
      {subtab === 'assets' && <AssetsAdmin data={data} save={save} show={show} prices={prices} />}
      {subtab === 'accounts' && <AccountsAdmin data={data} save={save} show={show} />}
    </>
  )
}

function MembersAdmin({ data, save, show }) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState([])
  const add = () => {
    if (!name.trim()) { show('Enter name'); return }
    if (data.members.some(member => member.name.toLowerCase() === name.trim().toLowerCase())) { show('Exists'); return }
    save({ ...data, members: [...data.members, { id: uid(), name: name.trim(), accounts: selected.length ? selected : ['CST'] }] })
    setName('')
    setSelected([])
    show('Added')
  }

  return (
    <>
      <div style={cardS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 12 }}>Add Family Member</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: 14, alignItems: 'end' }}>
          <div><label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4 }}>NAME</label><input value={name} onChange={event => setName(event.target.value)} style={inpS} placeholder="Name" onKeyDown={event => event.key === 'Enter' && add()} /></div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4 }}>ACCOUNTS</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {data.institutions.map(account => (
                <button key={account} onClick={() => setSelected(prev => prev.includes(account) ? prev.filter(item => item !== account) : [...prev, account])} style={{ padding: '5px 12px', borderRadius: 20, border: selected.includes(account) ? `2px solid ${C.gold}` : `1px solid ${C.border}`, background: selected.includes(account) ? `${C.gold}20` : C.white, color: selected.includes(account) ? C.dark : C.muted, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'Rubik' }}>{account}</button>
              ))}
            </div>
          </div>
          <button onClick={add} style={btnG}>Add</button>
        </div>
      </div>
      <div style={cardS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 12 }}>Current Members</h3>
        {data.members.map(member => (
          <div key={member.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              <span style={{ fontWeight: 700, marginRight: 8, minWidth: 80 }}>{member.name}</span>
              {member.accounts.map(account => (
                <span key={account} style={{ ...tagS(C.brown), cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>{account}<span onClick={() => save({ ...data, members: data.members.map(item => item.id === member.id ? { ...item, accounts: item.accounts.filter(value => value !== account) } : item) })} style={{ color: C.muted, cursor: 'pointer', fontSize: 12 }}>×</span></span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <select onChange={event => { if (event.target.value) { save({ ...data, members: data.members.map(item => item.id === member.id && !item.accounts.includes(event.target.value) ? { ...item, accounts: [...item.accounts, event.target.value] } : item) }); event.target.value = '' } }} style={{ ...inpS, width: 120, fontSize: 12, padding: 6 }}><option value="">+ Account</option>{data.institutions.filter(account => !member.accounts.includes(account)).map(account => <option key={account}>{account}</option>)}</select>
              <button onClick={() => { save({ ...data, members: data.members.filter(item => item.id !== member.id) }); show('Removed') }} style={{ ...btnO, color: C.danger, borderColor: `${C.danger}60`, padding: '5px 10px', fontSize: 12 }}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function AssetsAdmin({ data, save, show, prices }) {
  const holdings = useHoldings(data)
  const [form, setForm] = useState({ name: '', ticker: '', desc: '', type: 'Stock', liquid: true })
  const [valueInputs, setValueInputs] = useState({})
  const [checked, setChecked] = useState({})
  const add = () => {
    if (!form.name.trim() || !form.ticker.trim()) { show('Name & ticker needed'); return }
    save({ ...data, assets: [...data.assets, { id: uid(), ...form, name: form.name.trim(), ticker: form.ticker.trim().toUpperCase() }] })
    setForm({ name: '', ticker: '', desc: '', type: 'Stock', liquid: true })
    show('Added')
  }
  const setManualValue = (id, value) => {
    save({ ...data, assetValues: { ...data.assetValues, [id]: { value: parseFloat(value), date: new Date().toISOString().split('T')[0] } } })
    setValueInputs({ ...valueInputs, [id]: '' })
    show('Value set')
  }
  const assetUnits = {}
  data.assets.forEach(asset => {
    let total = 0
    data.members.forEach(member => member.accounts.forEach(account => { total += holdings[`${member.id}|${asset.id}|${account}`] || 0 }))
    assetUnits[asset.id] = total
  })
  let checkedTotal = 0
  data.assets.forEach(asset => {
    if (checked[asset.id]) {
      const price = prices[asset.ticker]?.price || data.assetValues?.[asset.id]?.value || 0
      checkedTotal += assetUnits[asset.id] * price
    }
  })

  return (
    <>
      <div style={cardS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 12 }}>Add Asset</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, alignItems: 'end' }}>
          <div><label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4 }}>NAME</label><input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} style={inpS} placeholder="e.g. Apple" /></div>
          <div><label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4 }}>TICKER</label><input value={form.ticker} onChange={event => setForm({ ...form, ticker: event.target.value })} style={inpS} placeholder="e.g. AAPL" /></div>
          <div><label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4 }}>TYPE</label><select value={form.type} onChange={event => setForm({ ...form, type: event.target.value })} style={inpS}>{TYPES.map(type => <option key={type}>{type}</option>)}</select></div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4 }}>LIQUIDITY</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[true, false].map(liquid => <button key={String(liquid)} onClick={() => setForm({ ...form, liquid })} style={{ flex: 1, padding: 8, borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Rubik', border: form.liquid === liquid ? `2px solid ${liquid ? C.success : C.orange}` : `1px solid ${C.border}`, background: form.liquid === liquid ? `${liquid ? C.success : C.orange}15` : C.white, color: form.liquid === liquid ? (liquid ? C.success : C.orange) : C.muted }}>{liquid ? 'Liquid' : 'Illiquid'}</button>)}
            </div>
          </div>
          <div style={{ gridColumn: 'span 3' }}><label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4 }}>DESCRIPTION</label><input value={form.desc} onChange={event => setForm({ ...form, desc: event.target.value })} style={inpS} placeholder="Optional" /></div>
          <button onClick={add} style={{ ...btnG, alignSelf: 'end' }}>Add Asset</button>
        </div>
      </div>
      <div style={cardS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 12 }}>Current Assets</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr><th style={{ ...thS, width: 30 }}></th>{['Ticker', 'Name', 'Type', 'Last Price', 'Units', 'Value', 'Liquid', ''].map(header => <th key={header} style={thS}>{header}</th>)}</tr></thead>
            <tbody>
              {data.assets.map(asset => {
                const priceData = prices[asset.ticker]
                const manualValue = data.assetValues?.[asset.id]
                const units = assetUnits[asset.id] || 0
                const lastPrice = priceData?.price || manualValue?.value || 0
                const totalValue = units * lastPrice
                return (
                  <tr key={asset.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}><input type="checkbox" checked={!!checked[asset.id]} onChange={() => setChecked(prev => ({ ...prev, [asset.id]: !prev[asset.id] }))} /></td>
                    <td style={{ padding: '8px 12px', fontWeight: 700 }}>{asset.ticker}</td>
                    <td style={{ padding: '8px 12px' }}>{asset.name}</td>
                    <td style={{ padding: '8px 12px' }}><span style={tagS(C.brown)}>{asset.type}</span></td>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: C.dark }}>{lastPrice ? fmt$(lastPrice) : '-'}{priceData?.change && <span style={{ marginLeft: 6, fontSize: 11, color: parseFloat(priceData.change) >= 0 ? C.success : C.danger }}>{fmtPct(priceData.change)}</span>}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{fmtN(units)}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: C.dark }}>{totalValue ? fmt$(totalValue) : '-'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {asset.liquid ? <span style={tagS(C.success)}>Liquid</span> : (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <span style={tagS(C.orange)}>Illiquid</span>
                          <input type="number" placeholder="Value" value={valueInputs[asset.id] || ''} onChange={event => setValueInputs({ ...valueInputs, [asset.id]: event.target.value })} style={{ ...inpS, width: 80, padding: 4, fontSize: 11 }} />
                          {valueInputs[asset.id] && <button onClick={() => setManualValue(asset.id, valueInputs[asset.id])} style={{ ...btnO, padding: '2px 6px', fontSize: 10 }}>Set</button>}
                        </div>
                      )}
                    </td>
                    <td><button onClick={() => { save({ ...data, assets: data.assets.filter(item => item.id !== asset.id) }); show('Removed') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.danger, fontSize: 14 }}>×</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {Object.values(checked).some(Boolean) && <div style={{ marginTop: 16, padding: '14px 20px', background: C.dark, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ color: C.cream, fontSize: 14, fontWeight: 500 }}>Selected assets total value:</span><span style={{ color: C.gold, fontSize: 20, fontWeight: 700 }}>{fmt$(checkedTotal)}</span></div>}
      </div>
    </>
  )
}

function AccountsAdmin({ data, save, show }) {
  const [name, setName] = useState('')
  const add = () => {
    if (!name.trim()) { show('Enter name'); return }
    if (data.institutions.includes(name.trim())) { show('Exists'); return }
    save({ ...data, institutions: [...data.institutions, name.trim()] })
    setName('')
    show('Added')
  }

  return (
    <>
      <div style={cardS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 12 }}>Add Institution</h3>
        <div style={{ display: 'flex', gap: 14, alignItems: 'end' }}>
          <div><label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4 }}>NAME</label><input value={name} onChange={event => setName(event.target.value)} style={inpS} placeholder="e.g. Fidelity" onKeyDown={event => event.key === 'Enter' && add()} /></div>
          <button onClick={add} style={btnG}>Add</button>
        </div>
      </div>
      <div style={cardS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 12 }}>Current Institutions</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {data.institutions.map(account => (
            <div key={account} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: C.cream, border: `1px solid ${C.border}`, borderRadius: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{account}</span>
              <span style={{ fontSize: 11, color: C.muted }}>({data.members.filter(member => member.accounts.includes(account)).map(member => member.name).join(', ') || 'none'})</span>
              <button onClick={() => { save({ ...data, institutions: data.institutions.filter(item => item !== account) }); show('Removed') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 13 }}>×</button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}