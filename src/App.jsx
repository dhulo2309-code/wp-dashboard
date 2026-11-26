import { useEffect, useState, useCallback } from 'react'
import { supabase, api } from './supabase'

const sc = n => n == null ? 'mu' : n >= 90 ? 'good' : n >= 50 ? 'mid' : 'bad'
const lvl = c => !c ? 'none' : !c.up ? 'bad' : c.issues?.length ? 'mid' : 'good'
const days = d => d ? Math.round((new Date(d) - Date.now()) / 864e5) : null
const dc = d => d == null ? '' : d < 14 ? 'bd' : d < 30 ? 'warn' : 'ok'
const Y = ({ t, v }) => <div className="row"><span>{t}</span><b className={v ? 'ok' : 'bd'}>{v ? '✓' : '✗'}</b></div>
const Box = ({ t, cls = '', children }) => <div className={`card ${cls}`}><h4>{t}</h4>{children}</div>

function Login() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [err, setErr] = useState('')
  const go = async e => { e.preventDefault(); const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) setErr(error.message) }
  return <form onSubmit={go} className="login"><h2>WP Dashboard</h2>
    <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
    <button>Login</button>{err && <p className="bd">{err}</p>}</form>
}

function Detail({ site, onBack, reload }) {
  const [rows, setRows] = useState([]), [busy, setBusy] = useState('')
  const load = useCallback(async () => {
    const { data } = await supabase.from('checks').select('*').eq('site_id', site.id).order('checked_at', { ascending: false }).limit(30)
    setRows(data || [])
  }, [site.id])
  useEffect(() => { load(); const ch = supabase.channel('d' + site.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'checks', filter: `site_id=eq.${site.id}` }, load).subscribe(); return () => supabase.removeChannel(ch) }, [load])
  const run = async (key, path, body) => { setBusy(key); await api(path, { site_id: site.id, ...body }); setBusy('') }
  const remove = async () => { if (confirm('Delete this site?')) { await supabase.from('sites').delete().eq('id', site.id); reload(); onBack() } }
  const c = rows[0], seo = c?.seo || {}, sec = c?.security || {}, w = c?.wp_extra || {}, L = lvl(c)
  return <>
    <a className="muted" onClick={onBack}>← Back</a>
    <div className="top" style={{ margin: '8px 0 12px' }}><h1 style={{ margin: 0 }}>{site.name} <span className="muted">{site.url}</span></h1>
      {c && <span className={`pill ${c.up ? 'good' : 'bad'}`}>● {c.up ? 'Up' : 'Down'}</span>}</div>
    <button disabled={!!busy} onClick={() => run('c', 'check')}>{busy === 'c' ? 'Checking… (30-60s)' : 'Check now'}</button>{' '}
    <button className="g" disabled={!!busy} onClick={() => run('a', 'action', { action: 'clear_cache' })}>Clear cache</button>{' '}
    <button className="g" disabled={!!busy} onClick={() => run('b', 'action', { action: 'cleanup_db' })}>Clean DB</button>{' '}
    <button className="d" onClick={remove}>Delete</button>
    {c && <div className="grid" style={{ marginTop: 16 }}>
      <Box t="Speed" cls="good">
        <div className="row"><span>PageSpeed</span><span className={`pill ${sc(c.perf_score)}`}>{c.perf_score ?? '-'}</span></div>
        <div className="row"><span>LCP</span><span className={c.lcp_s > 4 ? 'bd' : c.lcp_s > 2.5 ? 'warn' : 'ok'}>{c.lcp_s != null ? Number(c.lcp_s).toFixed(1) + 's' : '-'}</span></div>
        <div className="row"><span>CLS</span><span className={c.cls > 0.25 ? 'bd' : c.cls > 0.1 ? 'warn' : 'ok'}>{c.cls != null ? Number(c.cls).toFixed(3) : '-'}</span></div>
        <div className="row"><span>TBT</span><span className={c.tbt_ms > 600 ? 'bd' : c.tbt_ms > 200 ? 'warn' : 'ok'}>{c.tbt_ms != null ? Math.round(c.tbt_ms) + 'ms' : '-'}</span></div>
        <div className="row"><span>TTFB</span><span className={c.ttfb_ms > 800 ? 'warn' : 'ok'}>{c.ttfb_ms}ms</span></div>
        <div className="row"><span>Response</span><span className={c.response_ms > 2500 ? 'bd' : 'ok'}>{c.response_ms}ms</span></div></Box>
      <Box t="Uptime, SSL ane domain">
        <div className="row"><span>HTTP status</span><span className={c.up ? 'ok' : 'bd'}>{c.status_code}</span></div>
        <div className="row"><span>SSL expires</span><span className={dc(days(c.ssl_expires))}>{c.ssl_expires ? `${c.ssl_expires.slice(0, 10)} (${days(c.ssl_expires)}d)` : '-'}</span></div>
        <div className="row"><span>Domain expires</span><span className={dc(days(c.domain_expires))}>{c.domain_expires ? `${c.domain_expires.slice(0, 10)} (${days(c.domain_expires)}d)` : '-'}</span></div>
        <div className="row"><span>Broken links</span><span className={c.broken_links ? 'bd' : 'ok'}>{c.broken_links ?? '-'}</span></div></Box>
      <Box t="WordPress">
        {c.wp_version ? <>
        <div className="row"><span>WP / PHP</span><span className={parseFloat(c.php_version) < 8.1 ? 'warn' : ''}>{c.wp_version} / {c.php_version}</span></div>
        <div className="row"><span>Updates core/plugins/themes</span><span className={c.updates_core || c.updates_plugins || c.updates_themes ? 'warn' : 'ok'}>{c.updates_core}/{c.updates_plugins}/{c.updates_themes}</span></div>
        <div className="row"><span>DB size</span><span>{c.db_size_mb}MB</span></div>
        <div className="row"><span>Autoload</span><span className={c.autoload_kb > 1500 ? 'warn' : 'ok'}>{c.autoload_kb}KB</span></div>
        <div className="row"><span>Revisions</span><span>{w.revisions}</span></div>
        <div className="row"><span>Inactive plugins</span><span className={w.inactive_plugins ? 'warn' : 'ok'}>{w.inactive_plugins}</span></div></> : <p className="muted">WP key nathi. Plugin install karo to aa data aavse.</p>}</Box>
      <Box t="SEO">
        <Y t="Title tag" v={seo.title} /><Y t="Meta description" v={seo.desc} /><Y t="Ek H1" v={seo.h1 === 1} /><Y t="Indexable (noindex nathi)" v={!seo.noindex} />
        <Y t="robots.txt" v={seo.robots} /><Y t="sitemap.xml" v={seo.sitemap} /><Y t="Mobile viewport" v={seo.viewport} /><Y t="Canonical" v={seo.canonical} /></Box>
      <Box t="Security">
        <Y t="HTTPS" v={sec.https} /><Y t="HSTS" v={sec.hsts} /><Y t="X-Content-Type-Options" v={sec.xcto} /><Y t="Clickjacking protection" v={sec.xfo} /><Y t="CSP" v={sec.csp} />
        {c.wp_version && <><Y t={'"admin" user nathi'} v={!w.admin_user} /><Y t="XML-RPC band" v={!w.xmlrpc} /><Y t="WP_DEBUG band" v={!w.wp_debug} /></>}</Box>
      <Box t={`Issues (${c.issues.length})`} cls={c.issues.length ? 'mid' : 'good'}>
        {c.issues.length ? c.issues.map(i => <div key={i} className="iss">⚠ {i}</div>) : <div className="ok">Badhu barabar che ✓</div>}</Box>
    </div>}
    <h3>History</h3><div className="card scroll"><table><thead><tr><th>Time</th><th>Status</th><th>Response</th><th>Score</th><th>Issues</th></tr></thead><tbody>
      {rows.map(r => <tr key={r.id}><td>{new Date(r.checked_at).toLocaleString()}</td><td><span className={`pill ${r.up ? 'good' : 'bad'}`}>{r.up ? 'Up' : 'Down'}</span></td><td>{r.response_ms}ms</td><td><span className={`pill ${sc(r.perf_score)}`}>{r.perf_score ?? '-'}</span></td><td>{r.issues.length}</td></tr>)}</tbody></table></div>
  </>
}

function Dashboard() {
  const [sites, setSites] = useState([]), [last, setLast] = useState({}), [sel, setSel] = useState(null), [showAdd, setShowAdd] = useState(false)
  const [f, setF] = useState({ name: '', url: '', wp_key: '' }), [q, setQ] = useState('')
  const load = useCallback(async () => {
    const { data: s } = await supabase.from('sites').select('*').order('name')
    const { data: l } = await supabase.from('latest_checks').select('*')
    setSites(s || []); setLast(Object.fromEntries((l || []).map(x => [x.site_id, x])))
  }, [])
  useEffect(() => { load(); const ch = supabase.channel('all').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'checks' }, load).subscribe(); return () => supabase.removeChannel(ch) }, [load])
  const add = async e => { e.preventDefault(); await supabase.from('sites').insert({ name: f.name, url: f.url.replace(/\/$/, ''), wp_key: f.wp_key || null }); setF({ name: '', url: '', wp_key: '' }); setShowAdd(false); load() }
  if (sel) return <Detail site={sel} onBack={() => setSel(null)} reload={load} />
  const rank = { bad: 0, mid: 1, good: 2, none: 3 }
  const list = sites.filter(x => (x.name + x.url).toLowerCase().includes(q.toLowerCase())).sort((a, b) => rank[lvl(last[a.id])] - rank[lvl(last[b.id])])
  const n = k => sites.filter(x => lvl(last[x.id]) === k).length
  return <>
    <div className="top"><h1>Websites</h1><div><button onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancel' : '+ Add site'}</button>{' '}<button className="g" onClick={() => supabase.auth.signOut()}>Logout</button></div></div>
    <div className="sum"><div><b>{sites.length}</b><span className="muted">Total</span></div><div><b className="ok">{n('good')}</b><span className="muted">Healthy</span></div>
      <div><b className="warn">{n('mid')}</b><span className="muted">Issues</span></div><div><b className="bd">{n('bad')}</b><span className="muted">Down</span></div></div>
    {showAdd && <form className="add" onSubmit={add}>
      <input placeholder="Name" required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
      <input placeholder="https://site.com" required value={f.url} onChange={e => setF({ ...f, url: e.target.value })} />
      <input placeholder="WP connector key (optional)" value={f.wp_key} onChange={e => setF({ ...f, wp_key: e.target.value })} /><button>Save site</button></form>}
    <input placeholder="Search sites…" value={q} onChange={e => setQ(e.target.value)} style={{ margin: '4px 0 14px', width: 260 }} />
    {!sites.length && <p className="muted">Hajū koi site nathi. Upar '+ Add site' dabavo.</p>}
    <div className="grid">{list.map(x => { const c = last[x.id], L = lvl(c), k = c?.issues?.length ?? 0
      return <div key={x.id} className={`card click ${L}`} onClick={() => setSel(x)}>
        <div className="top"><b>{x.name}</b><span className={`pill ${!c ? 'ac' : c.up ? 'good' : 'bad'}`}>{!c ? 'No data' : c.up ? '● Up' : '● Down'}</span></div>
        <div className="muted">{x.url}</div>
        {c && <><div className="row"><span>PageSpeed</span><span className={`pill ${sc(c.perf_score)}`}>{c.perf_score ?? '-'}</span></div>
          <div className="row"><span>Response</span><span className={c.response_ms > 2500 ? 'bd' : ''}>{c.response_ms}ms</span></div>
          <div className="row"><span>Issues</span><span className={`pill ${k ? 'mid' : 'good'}`}>{k || 'None'}</span></div></>}
      </div> })}</div>
  </>
}

export default function App() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])
  if (session === undefined) return null
  return <main>{session ? <Dashboard /> : <Login />}</main>
}
