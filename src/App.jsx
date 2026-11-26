import { useEffect, useState, useCallback } from 'react'
import { supabase, api } from './supabase'

const sc = n => n == null ? 'mu' : n >= 90 ? 'good' : n >= 50 ? 'mid' : 'bad'
const lvl = c => !c ? 'none' : !c.up ? 'bad' : c.issues?.length ? 'mid' : 'good'
const days = d => d ? Math.round((new Date(d) - Date.now()) / 864e5) : null
const dc = d => d == null ? '' : d < 14 ? 'bd' : d < 30 ? 'warn' : 'ok'
const Y = ({ t, v }) => <div className="row"><span>{t}</span><b className={v ? 'ok' : 'bd'}>{v ? '✓' : '✗'}</b></div>
const cat = i => /PageSpeed|response|TTFB/i.test(i) ? 'Speed' : /SEO|robots|sitemap|noindex/i.test(i) ? 'SEO' : /Security headers|admin|XML-RPC|WP_DEBUG/i.test(i) ? 'Security' : /down|SSL|Domain|broken/i.test(i) ? 'Uptime, SSL and domain' : 'WordPress'
const goBox = t => document.getElementById('box-' + t.replace(/\W+/g, ''))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
const HT = 'Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"\nHeader always set X-Content-Type-Options "nosniff"\nHeader always set X-Frame-Options "SAMEORIGIN"'
const FIX = [
  { t: /Site down/, title: 'Your site is not loading', steps: ['Click Check now once more, it may have been a short glitch.', 'Check your hosting panel for an outage, expired plan or resource limit.', 'Read the error log (hosting panel or wp-content/debug.log) to see the exact error.', 'If it began after an update, rename wp-content/plugins to plugins_off via FTP, then re-enable plugins one by one.', 'Still down? Contact hosting support and share the HTTP code from the issue.'] },
  { t: /Slow response|High TTFB/, title: 'Server is responding slowly', steps: ['Install a cache plugin (LiteSpeed Cache, WP Rocket or W3 Total Cache) and turn on page caching.', 'Switch PHP to 8.2 or newer in your hosting panel.', 'Deactivate heavy plugins you do not need.', 'Put the site behind a CDN such as Cloudflare.', 'If it is still slow, the hosting plan may be too small.'], action: 'clear_cache', label: 'Clear cache now' },
  { t: /SSL expires/, title: 'SSL certificate is about to expire', steps: ['Open your hosting panel (cPanel: SSL/TLS Status) and run AutoSSL / renew the certificate.', 'If you use Cloudflare or a paid SSL, renew it there.', 'Turn on auto-renewal so it does not happen again.', 'Click Check now to confirm the new expiry date.'] },
  { t: /Domain expires/, title: 'Domain is about to expire', steps: ['Log in to the registrar where you bought the domain.', 'Renew it for at least 1 more year.', 'Turn on auto-renew and make sure the payment card is valid.'] },
  { t: /Low PageSpeed/, title: 'Mobile speed score is low', steps: ['Compress images and convert them to WebP (Imagify or ShortPixel).', 'Enable caching plus CSS/JS minify and defer (LiteSpeed Cache or WP Rocket).', 'Turn on lazy loading for images and videos.', 'Remove unused plugins and heavy page-builder widgets.', 'Use a lightweight theme if the score stays low.'], action: 'clear_cache', label: 'Clear cache now' },
  { t: /noindex/, title: 'Google is told not to index this site', steps: ['WP Admin > Settings > Reading: untick "Discourage search engines from indexing this site".', 'Check your SEO plugin (Yoast or Rank Math) for a noindex setting on the homepage.', 'Clear the cache, then click Check now.'], action: 'clear_cache', label: 'Clear cache now' },
  { t: /missing title/, title: 'Homepage has no title tag', steps: ['Install Yoast SEO or Rank Math and set an SEO title for the homepage.', 'If your theme has no title support, add add_theme_support("title-tag") in functions.php.', 'Keep it under 60 characters and include the main keyword.'] },
  { t: /missing meta description/, title: 'Homepage has no meta description', steps: ['Open Yoast SEO or Rank Math and edit the homepage SEO settings.', 'Write a description of 120 to 160 characters.', 'Clear the cache and click Check now.'] },
  { t: /H1 tags/, title: 'Homepage should have exactly one H1', steps: ['Edit the homepage and find all Heading 1 blocks.', 'If there are none, make your main headline an H1.', 'If there are several, change the extra ones to H2 or H3.', 'Also check theme or widget headings (logo or site title is often an extra H1).'] },
  { t: /robots\.txt/, title: 'robots.txt is missing', steps: ['In Yoast SEO: Tools > File editor to create robots.txt, or Rank Math: General Settings > Edit robots.txt.', 'Or create a robots.txt file in the site root with these lines: User-agent: * and Allow: /', 'Open yoursite.com/robots.txt to confirm it loads.'] },
  { t: /sitemap\.xml/, title: 'sitemap.xml is missing', steps: ['Turn on the XML sitemap in Yoast SEO or Rank Math.', 'Your sitemap may live at /sitemap_index.xml or /wp-sitemap.xml. Add a redirect from /sitemap.xml to it (Redirection plugin).', 'Submit the sitemap in Google Search Console.'] },
  { t: /broken link/, title: 'Some links on the homepage return 404 or errors', steps: ['Install Broken Link Checker (or run Screaming Frog) to find the exact links.', 'Fix the URL, remove the link, or add a 301 redirect with the Redirection plugin.', 'Click Check now to confirm.'] },
  { t: /Security headers/, title: 'Security headers are missing', steps: ['Easiest: install the plugin "Headers Security Advanced & HSTS WP" and enable the headers.', 'Or add these lines to .htaccess (Apache servers) after the site works fully on HTTPS:', 'On Cloudflare, you can add the same headers under Rules > Transform Rules.'], code: HT },
  { t: /core update/, title: 'WordPress core update is available', steps: ['Take a full backup first.', 'WP Admin > Dashboard > Updates > Update now.', 'Open the site and check that it still works.'] },
  { t: /plugin update/, title: 'Plugins need updating', steps: ['Take a full backup first.', 'WP Admin > Plugins: update them, ideally one by one.', 'Check the site after each important plugin.', 'Delete plugins you do not use.'] },
  { t: /theme update/, title: 'Theme needs updating', steps: ['Take a full backup first.', 'WP Admin > Appearance > Themes: update the theme.', 'If you edited the theme files directly, move those changes to a child theme first.'] },
  { t: /Autoload/, title: 'Too much data loads on every page', steps: ['Run Clean DB to remove expired transients.', 'Find big autoloaded options with Query Monitor or Advanced Database Cleaner.', 'Delete options left behind by plugins you removed.', 'Click Check now to see the new size.'], action: 'cleanup_db', label: 'Run Clean DB now' },
  { t: /error log/, title: 'PHP error log keeps growing', steps: ['Download wp-content/debug.log and read the most repeated errors.', 'Fix or update the plugin or theme that causes them.', 'Delete the log file after fixing.', 'Turn off WP_DEBUG_LOG in wp-config.php.'] },
  { t: /outdated/, title: 'PHP version is old', steps: ['Take a backup.', 'Hosting panel (cPanel: Select PHP Version): switch to PHP 8.2 or 8.3.', 'Open the site and admin and check for errors. If something breaks, switch back and update that plugin.'] },
  { t: /WP_DEBUG/, title: 'Debug mode is on in production', steps: ['Open wp-config.php through FTP or File Manager.', 'Set the lines shown below, then save.'], code: "define('WP_DEBUG', false);\ndefine('WP_DEBUG_LOG', false);\ndefine('WP_DEBUG_DISPLAY', false);" },
  { t: /Username "admin"/, title: 'The "admin" username is easy to guess', steps: ['Users > Add New: create a new Administrator with a different username and a strong password.', 'Log in with the new user.', 'Delete the "admin" user and assign its content to the new user.'] },
  { t: /XML-RPC/, title: 'XML-RPC is a common attack target', steps: ['Install the plugin "Disable XML-RPC", or add the line below to a small custom plugin.', 'Do not disable it if you use the Jetpack or the mobile app.'], code: "add_filter('xmlrpc_enabled', '__return_false');" },
  { t: /inactive plugin/, title: 'Unused plugins are still installed', steps: ['WP Admin > Plugins > Inactive.', 'Delete every plugin you do not need (not just deactivate).'] },
  { t: /connector not reachable/, title: 'Dashboard cannot reach the WP connector', steps: ['Check that the wpdash connector plugin is active.', 'Check that the key in wp-config.php matches the key saved for this site.', 'Settings > Permalinks > Save to refresh REST routes.', 'If you use Wordfence, Cloudflare or a "disable REST API" plugin, allow /wp-json/wpdash/.'] },
]
const fixFor = i => FIX.find(f => f.t.test(i)) || { title: 'Review this issue', steps: ['Open the related box below and check the red items.', 'Fix them, then click Check now.'] }
const IC = { Speed: '⚡', 'Uptime, SSL and domain': '🔒', WordPress: '🧩', SEO: '🔎', Security: '🛡️' }
const Box = ({ t, cls = '', children }) => <div id={'box-' + t.replace(/\W+/g, '')} className={`card ${cls}`}><h4>{IC[t] || '⚠️'} {t}</h4>{children}</div>

function Login() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [err, setErr] = useState('')
  const go = async e => { e.preventDefault(); const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) setErr(error.message) }
  return <div className="loginwrap"><form onSubmit={go} className="login"><div className="logo">🌐</div><h2>WP Dashboard</h2><p className="muted">Monitor all your websites in one place</p>
    <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
    <button>Login</button>{err && <p className="bd">{err}</p>}</form></div>
}

function Detail({ site, onBack, reload }) {
  const [rows, setRows] = useState([]), [busy, setBusy] = useState(''), [open, setOpen] = useState(null)
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
      <Box t={`Issues (${c.issues.length})`} cls={c.issues.length ? 'mid' : 'good'}>
        {c.issues.length ? c.issues.map(i => { const f = fixFor(i), o = open === i; return <div key={i}>
          <div className="iss" style={{ cursor: 'pointer' }} onClick={() => setOpen(o ? null : i)}>⚠ {i} <b style={{ float: 'right' }}>{o ? '▲' : 'How to fix ▼'}</b></div>
          {o && <div style={{ background: 'var(--card)', border: '1px solid var(--mdbd)', borderRadius: 8, padding: '10px 14px', margin: '4px 0 8px', fontSize: 13, color: 'var(--tx)' }}>
            <b>{f.title}</b>
            <ol style={{ paddingLeft: 18, margin: '8px 0' }}>{f.steps.map(x => <li key={x} style={{ marginBottom: 4 }}>{x}</li>)}</ol>
            {f.code && <pre style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: 10, overflowX: 'auto', fontSize: 12 }}>{f.code}</pre>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {f.action && site.wp_key && <button disabled={!!busy} onClick={() => run('x', 'action', { action: f.action })}>{busy === 'x' ? 'Running…' : f.label}</button>}
              <button className="g" onClick={() => goBox(cat(i))}>Show related box: {cat(i)}</button></div>
            <div className="muted" style={{ marginTop: 8 }}>After fixing, click Check now to confirm the issue is gone.</div>
          </div>}
        </div> }) : <div className="ok">All good ✓</div>}</Box>
      <Box t="Speed" cls="good">
        <div className="row"><span>PageSpeed</span><span className={`pill ${sc(c.perf_score)}`}>{c.perf_score ?? '-'}</span></div>
        <div className="row"><span>LCP</span><span className={c.lcp_s > 4 ? 'bd' : c.lcp_s > 2.5 ? 'warn' : 'ok'}>{c.lcp_s != null ? Number(c.lcp_s).toFixed(1) + 's' : '-'}</span></div>
        <div className="row"><span>CLS</span><span className={c.cls > 0.25 ? 'bd' : c.cls > 0.1 ? 'warn' : 'ok'}>{c.cls != null ? Number(c.cls).toFixed(3) : '-'}</span></div>
        <div className="row"><span>TBT</span><span className={c.tbt_ms > 600 ? 'bd' : c.tbt_ms > 200 ? 'warn' : 'ok'}>{c.tbt_ms != null ? Math.round(c.tbt_ms) + 'ms' : '-'}</span></div>
        <div className="row"><span>TTFB</span><span className={c.ttfb_ms > 800 ? 'warn' : 'ok'}>{c.ttfb_ms}ms</span></div>
        <div className="row"><span>Response</span><span className={c.response_ms > 2500 ? 'bd' : 'ok'}>{c.response_ms}ms</span></div></Box>
      <Box t="Uptime, SSL and domain">
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
        <div className="row"><span>Inactive plugins</span><span className={w.inactive_plugins ? 'warn' : 'ok'}>{w.inactive_plugins}</span></div></> : <p className="muted">No WP key set. Install the connector plugin to see this data.</p>}</Box>
      <Box t="SEO">
        <Y t="Title tag" v={seo.title} /><Y t="Meta description" v={seo.desc} /><Y t="Single H1" v={seo.h1 === 1} /><Y t="Indexable (no noindex tag)" v={!seo.noindex} />
        <Y t="robots.txt" v={seo.robots} /><Y t="sitemap.xml" v={seo.sitemap} /><Y t="Mobile viewport" v={seo.viewport} /><Y t="Canonical" v={seo.canonical} /></Box>
      <Box t="Security">
        <Y t="HTTPS" v={sec.https} /><Y t="HSTS" v={sec.hsts} /><Y t="X-Content-Type-Options" v={sec.xcto} /><Y t="Clickjacking protection" v={sec.xfo} /><Y t="CSP" v={sec.csp} />
        {c.wp_version && <><Y t={'No "admin" username'} v={!w.admin_user} /><Y t="XML-RPC disabled" v={!w.xmlrpc} /><Y t="WP_DEBUG off" v={!w.wp_debug} /></>}</Box>
    </div>}
    <h3>History</h3><div className="card scroll"><table><thead><tr><th>Time</th><th>Status</th><th>Response</th><th>Score</th><th>Issues</th></tr></thead><tbody>
      {rows.map(r => <tr key={r.id}><td>{new Date(r.checked_at).toLocaleString()}</td><td><span className={`pill ${r.up ? 'good' : 'bad'}`}>{r.up ? 'Up' : 'Down'}</span></td><td>{r.response_ms}ms</td><td><span className={`pill ${sc(r.perf_score)}`}>{r.perf_score ?? '-'}</span></td><td>{r.issues.length}</td></tr>)}</tbody></table></div>
  </>
}

function Dashboard() {
  const [sites, setSites] = useState([]), [last, setLast] = useState({}), [sel, setSel] = useState(null), [showAdd, setShowAdd] = useState(false), [prog, setProg] = useState(null)
  const [f, setF] = useState({ name: '', url: '', wp_key: '' }), [q, setQ] = useState('')
  const load = useCallback(async () => {
    const { data: s } = await supabase.from('sites').select('*').order('name')
    const { data: l } = await supabase.from('latest_checks').select('*')
    setSites(s || []); setLast(Object.fromEntries((l || []).map(x => [x.site_id, x])))
  }, [])
  useEffect(() => { load(); const ch = supabase.channel('all').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'checks' }, load).subscribe(); return () => supabase.removeChannel(ch) }, [load])
  const add = async e => { e.preventDefault(); await supabase.from('sites').insert({ name: f.name, url: f.url.replace(/\/$/, ''), wp_key: f.wp_key || null }); setF({ name: '', url: '', wp_key: '' }); setShowAdd(false); load() }
  const checkAll = async () => {
    const queue = sites.map(x => x.id), total = queue.length; let done = 0
    setProg({ done: 0, total })
    const worker = async () => { while (queue.length) { const id = queue.shift(); try { await api('check', { site_id: id }) } catch {} done++; setProg({ done, total }) } }
    await Promise.all([worker(), worker(), worker()])
    setProg(null); load()
  }
  if (sel) return <Detail site={sel} onBack={() => setSel(null)} reload={load} />
  const rank = { bad: 0, mid: 1, good: 2, none: 3 }
  const list = sites.filter(x => (x.name + x.url).toLowerCase().includes(q.toLowerCase())).sort((a, b) => rank[lvl(last[a.id])] - rank[lvl(last[b.id])])
  const n = k => sites.filter(x => lvl(last[x.id]) === k).length
  return <>
    <div className="top" style={{ flexWrap: 'wrap' }}><h1><span className="logo sm">🌐</span> Websites</h1><div><button disabled={!!prog || !sites.length} onClick={checkAll}>{prog ? `Checking ${prog.done}/${prog.total}…` : '↻ Check all sites'}</button>{' '}<button onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancel' : '+ Add site'}</button>{' '}<button className="g" onClick={() => supabase.auth.signOut()}>Logout</button></div></div>
    <div className="sum"><div className="t ac"><b>{sites.length}</b><span>Total sites</span></div><div className="t gd"><b>{n('good')}</b><span>Healthy</span></div><div className="t md"><b>{n('mid')}</b><span>Need attention</span></div><div className="t bd"><b>{n('bad')}</b><span>Down</span></div></div>
    {prog && <div style={{ height: 6, borderRadius: 6, background: 'var(--line)', margin: '0 0 14px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${(prog.done / prog.total) * 100}%`, background: 'linear-gradient(90deg,var(--ac),var(--ac2))', transition: '.3s' }} /></div>}
    {showAdd && <form className="add" onSubmit={add}>
      <input placeholder="Name" required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
      <input placeholder="https://site.com" required value={f.url} onChange={e => setF({ ...f, url: e.target.value })} />
      <input placeholder="WP connector key (optional)" value={f.wp_key} onChange={e => setF({ ...f, wp_key: e.target.value })} /><button>Save site</button></form>}
    <input placeholder="Search sites…" value={q} onChange={e => setQ(e.target.value)} style={{ margin: '4px 0 14px', width: 260 }} />
    {!sites.length && <p className="muted">No sites yet. Click '+ Add site' above.</p>}
    <div className="grid">{list.map(x => { const c = last[x.id], L = lvl(c), k = c?.issues?.length ?? 0
      return <div key={x.id} className={`card click ${L}`} onClick={() => setSel(x)}>
        <div className="top"><span className="nm"><span className="av">{(x.name || "?")[0].toUpperCase()}</span><b>{x.name}</b></span><span className={`pill ${!c ? 'ac' : c.up ? 'good' : 'bad'}`}>{!c ? 'No data' : c.up ? '● Up' : '● Down'}</span></div>
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
  return session ? <main><Dashboard /></main> : <Login />
}
