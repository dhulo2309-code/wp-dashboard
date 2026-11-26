import tls from 'node:tls'
const sslExpiry = host => new Promise(res => {
  const s = tls.connect(443, host, { servername: host }, () => {
    const c = s.getPeerCertificate(); s.end(); res(c.valid_to ? new Date(c.valid_to).toISOString() : null)
  })
  s.on('error', () => res(null)); s.setTimeout(5000, () => { s.destroy(); res(null) })
})
const ok = async u => { try { return (await fetch(u, { signal: AbortSignal.timeout(8000) })).ok } catch { return false } }
const domExpiry = async host => {
  try {
    const p = host.split('.'), n = p.length > 2 && p.at(-1).length === 2 && ['co', 'com', 'org', 'net', 'gov', 'ac'].includes(p.at(-2)) ? 3 : 2
    const j = await (await fetch(`https://rdap.org/domain/${p.slice(-n).join('.')}`, { signal: AbortSignal.timeout(8000) })).json()
    return j.events?.find(e => e.eventAction === 'expiration')?.eventDate || null
  } catch { return null }
}
const brokenLinks = async (html, base) => {
  const set = new Set(), o = new URL(base).origin
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try { const u = new URL(m[1], base); if (u.origin === o && !/\.(jpe?g|png|gif|webp|svg|pdf|zip|css|js)$/i.test(u.pathname)) set.add(u.href) } catch {}
    if (set.size >= 15) break
  }
  const r = await Promise.all([...set].map(async u => { try { const x = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(8000) }); return x.status === 404 || x.status === 410 || x.status >= 500 } catch { return false } }))
  return r.filter(Boolean).length
}
const psi = async base => {
  try {
    const q = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(base)}&strategy=mobile&category=performance&key=${process.env.PSI_KEY}`
    const j = await (await fetch(q, { signal: AbortSignal.timeout(40000) })).json(), a = j.lighthouseResult?.audits
    return { perf: Math.round((j.lighthouseResult?.categories?.performance?.score ?? 0) * 100),
      lcp: a?.['largest-contentful-paint']?.numericValue / 1000, cls: a?.['cumulative-layout-shift']?.numericValue, tbt: a?.['total-blocking-time']?.numericValue }
  } catch { return {} }
}
export async function checkSite(site) {
  const base = site.url.replace(/\/$/, ''), host = new URL(base).hostname, issues = []
  const t = Date.now(); let up = false, status = 0, html = '', h = new Headers(), ttfb = null
  try { const r = await fetch(base, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'WPDash/1.0' } }); ttfb = Date.now() - t; status = r.status; up = r.ok; h = r.headers; html = await r.text() } catch {}
  const ms = Date.now() - t
  const [ssl, p, wp, robots, sitemap, broken, dom] = await Promise.all([
    sslExpiry(host), psi(base),
    site.wp_key ? fetch(`${base}/wp-json/wpdash/v1/status`, { headers: { 'x-wpdash-key': site.wp_key }, signal: AbortSignal.timeout(15000) }).then(r => r.json()).catch(() => { issues.push('WP connector not reachable'); return {} }) : {},
    ok(`${base}/robots.txt`), ok(`${base}/sitemap.xml`), up ? brokenLinks(html, base) : 0, domExpiry(host)])
  const seo = { title: (html.match(/<title[^>]*>([^<]*)/i) || [])[1]?.trim() || null, desc: /<meta[^>]+name=["']description["']/i.test(html),
    h1: (html.match(/<h1[\s>]/gi) || []).length, noindex: /<meta[^>]+name=["']robots["'][^>]*noindex/i.test(html),
    viewport: /<meta[^>]+name=["']viewport["']/i.test(html), canonical: /<link[^>]+rel=["']canonical["']/i.test(html), robots, sitemap }
  const security = { https: base.startsWith('https'), hsts: !!h.get('strict-transport-security'), xcto: !!h.get('x-content-type-options'),
    xfo: !!(h.get('x-frame-options') || /frame-ancestors/.test(h.get('content-security-policy') || '')), csp: !!h.get('content-security-policy') }
  const days = d => d ? (new Date(d) - Date.now()) / 864e5 : null
  if (!up) issues.push(`Site down (HTTP ${status})`)
  if (ms > 2500) issues.push(`Slow response: ${ms}ms`)
  if (ttfb > 800) issues.push(`High TTFB: ${ttfb}ms`)
  if (days(ssl) !== null && days(ssl) < 14) issues.push('SSL expires in less than 14 days')
  if (days(dom) !== null && days(dom) < 30) issues.push('Domain expires in less than 30 days')
  if (p.perf != null && p.perf < 50) issues.push(`Low PageSpeed score: ${p.perf}`)
  if (up) {
    if (seo.noindex) issues.push('Site has a noindex tag, hidden from Google')
    if (!seo.title) issues.push('SEO: missing title tag')
    if (!seo.desc) issues.push('SEO: missing meta description')
    if (seo.h1 !== 1) issues.push(`SEO: ${seo.h1} H1 tags (should be 1)`)
    if (!robots) issues.push('robots.txt missing'); if (!sitemap) issues.push('sitemap.xml missing')
    if (broken > 0) issues.push(`${broken} broken link(s) on homepage`)
    const miss = ['hsts', 'xcto', 'xfo'].filter(k => !security[k]); if (miss.length) issues.push(`Security headers missing: ${miss.join(', ')}`)
  }
  if (wp.updates_core) issues.push('WordPress core update pending')
  if (wp.updates_plugins > 0) issues.push(`${wp.updates_plugins} plugin update(s) pending`)
  if (wp.updates_themes > 0) issues.push(`${wp.updates_themes} theme update(s) pending`)
  if (wp.autoload_kb > 1500) issues.push(`Autoload bloat: ${wp.autoload_kb}KB`)
  if (wp.error_log_kb > 1024) issues.push('PHP error log is large')
  if (wp.php_version && parseFloat(wp.php_version) < 8.1) issues.push(`PHP ${wp.php_version} is outdated`)
  if (wp.wp_debug) issues.push('WP_DEBUG is on (turn off in production)')
  if (wp.admin_user) issues.push('Username "admin" exists')
  if (wp.xmlrpc) issues.push('XML-RPC is enabled')
  if (wp.inactive_plugins > 0) issues.push(`${wp.inactive_plugins} inactive plugin(s), delete them`)
  return { site_id: site.id, up, status_code: status, response_ms: ms, ttfb_ms: ttfb, ssl_expires: ssl, domain_expires: dom,
    perf_score: p.perf ?? null, lcp_s: p.lcp ?? null, cls: p.cls ?? null, tbt_ms: p.tbt ?? null,
    wp_version: wp.wp_version ?? null, php_version: wp.php_version ?? null,
    updates_core: wp.updates_core ?? null, updates_plugins: wp.updates_plugins ?? null, updates_themes: wp.updates_themes ?? null,
    db_size_mb: wp.db_size_mb ?? null, autoload_kb: wp.autoload_kb ?? null, broken_links: broken, seo, security, wp_extra: wp, issues }
}
