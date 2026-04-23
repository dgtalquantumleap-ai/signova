// lib/insights-poller.js
// Polls Reddit and Nairaland for active monitors, writes matches to Redis.
// Designed to run as a serverless cron endpoint on Vercel.
//
// Usage: POST /api/v1/insights/poll (with internal cron secret)
// Each run:
//   1. Fetch all monitors from insights:active_monitors set
//   2. For each monitor, search Reddit/Nairaland for its keywords
//   3. Deduplicate against already-seen post IDs
//   4. Write new matches to Redis: lpush insights:matches:{monitorId}, set insights:match:{monitorId}:{matchId}
//   5. Update monitor.lastPollAt and totalMatchesFound
//
// No dependencies beyond what signova already has.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const _POLL_SECRET  = process.env.POLL_CRON_SECRET || ''
const POST_MAX_AGE_HOURS = parseInt(process.env.INSIGHTS_POST_MAX_AGE_HOURS || '24')
const MAX_AGE_MS = POST_MAX_AGE_HOURS * 60 * 60 * 1000

// ── Approved subreddits (same as reddit-monitor/mcp-server.js) ────────────────
const APPROVED_SUBREDDITS = new Set([
  'freelance','freelancers','smallbusiness','Entrepreneur','EntrepreneurRideAlong',
  'SoloDevelopment','agency','agencynewbies','Nigeria','lagos','naija','nairaland',
  'LandlordLady','webdev','SaaS','startups','IndieHackers','buildinpublic',
  'androiddev','iOSProgramming','Teachers','education','Professors','PublicSpeaking',
  'churchtech','photography','eventplanning','Weddings','AV','hometheater',
  'techsupport','SubstituteTeachers','OnlineLearning','edtech','wedding',
  'weddingplanning','Christianity','church','Reformed','DIY','weddingphotography',
  'cleaning','housekeeping','recruiting','HR','artificial','ClaudeAI','LocalLLaMA',
  'LangChain','CursorIDE','legaltech','fintech','Africa','Kenya','Ghana',
  'CryptoCurrency','Upwork','Fiverr','tax','CleaningBusiness','HVAC',
  'cscareerquestions','cscareeradvice','ExperiencedDevs','forhire',
  'MachineLearning','learnmachinelearning','datascience','MLjobs',
  'recruitinghell','jobsearchhacks','jobs','remotework','techjobs',
  'YCombinator','venturecapital','angels','product_management','ProductManagement',
  'graphic_design','writing','copywriting','videography','marketing',
  'socialmediamanagement','malelivingspace','digitalnomad','workingdigitalnomad',
  'legal','automation','Content_marketing','filmmakers',
])

const delay = ms => new Promise(r => setTimeout(r, ms))

// ── Reddit search — uses public JSON endpoints, no API key needed ─────────────
async function searchReddit(keyword, subreddits = []) {
  const results = []
  const encoded = encodeURIComponent(keyword)
  const urls = subreddits.length > 0
    ? subreddits.map(sr =>
        `https://www.reddit.com/r/${sr}/search.json?q=${encoded}&sort=new&limit=10&t=day&restrict_sr=1`
      )
    : [`https://www.reddit.com/search.json?q=${encoded}&sort=new&limit=10&t=day`]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ebenova-insights-monitor/1.0' },
      })
      if (!res.ok) { await delay(2000); continue }
      const data = await res.json()
      const posts = data?.data?.children || []

      for (const post of posts) {
        const p = post.data
        const ageMs = Date.now() - p.created_utc * 1000
        if (ageMs > MAX_AGE_MS) continue
        results.push({
          id: p.id,
          title: p.title || '(no title)',
          url: `https://reddit.com${p.permalink}`,
          subreddit: p.subreddit,
          author: p.author,
          score: p.score,
          comments: p.num_comments,
          body: (p.selftext || '').slice(0, 600),
          createdAt: new Date(p.created_utc * 1000).toISOString(),
          keyword,
          source: 'reddit',
          approved: APPROVED_SUBREDDITS.has(p.subreddit),
          postAgeHours: Math.round(ageMs / (60 * 60 * 1000)),
        })
      }
    } catch { /* skip */ }
    await delay(2000) // rate limit respect
  }
  return results
}

// ── Nairaland search — scrapes public search page ─────────────────────────────
async function searchNairaland(keyword) {
  const results = []
  const encoded = encodeURIComponent(keyword)
  const url = `https://www.nairaland.com/search/posts/${encoded}/business/0/0`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EbenovaInsights/1.0)',
        'Accept': 'text/html',
      },
    })
    if (!res.ok) return results
    const html = await res.text()
    const pattern = /<td[^>]*>\s*<b>\s*<a href="(\/[^"]+)"[^>]*>([^<]+)<\/a>/gi
    const seen = new Set()
    let match
    while ((match = pattern.exec(html)) !== null) {
      const path = match[1]
      const title = match[2].trim()
      if (!path || !title || path.length < 5) continue
      const id = `nl_${path.replace(/\//g, '_')}`
      if (seen.has(id)) continue
      seen.add(id)
      const snippet = html.slice(pattern.lastIndex, pattern.lastIndex + 700)
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
      results.push({
        id, title,
        url: `https://www.nairaland.com${path}`,
        subreddit: 'Nairaland/business',
        author: 'nairaland',
        score: 0, comments: 0,
        body: snippet,
        createdAt: new Date().toISOString(),
        keyword, source: 'nairaland', approved: true,
        postAgeHours: 0,
      })
      if (results.length >= 5) break
    }
  } catch { /* skip */ }
  return results
}

// ── AI reply draft — uses Claude Haiku 4.5, skips if not approved or no context
async function generateReplyDraft(post, productContext) {
  if (!ANTHROPIC_API_KEY) return null
  if (!productContext || !productContext.trim()) return null
  if (!post.approved) return null

  const prompt = `You are a Reddit community member who genuinely helps people. You are NOT a marketer.

YOUR PRODUCT/EXPERTISE:
${productContext.slice(0, 1500)}

REDDIT POST:
Title: ${post.title}
Subreddit: r/${post.subreddit}
Body: ${post.body || '(no body)'}

━━━ SKIP FILTER ━━━
Respond ONLY with the word SKIP if ANY are true:
- Post is emotional, relational, or venting — not a task/tool problem
- Keyword matched incidentally (e.g. social meaning, not product-relevant)
- The post is clearly from a bot or spam
- Mentioning a product would feel like an ad in this context
- Post is asking about something completely unrelated to your expertise

━━━ REPLY (if not skipping) ━━━
Write a helpful 2-4 sentence reply as a community member.
- Sound like a real Reddit user: casual, direct, no corporate language
- Give real advice first. Only mention your product if it's the single most natural fit.
- Never use "check out", "I recommend", "great tool"
- No bullet points, headers, or markdown
- Do not start with "I"
- If mentioning your product: phrase as "I use" or "there's a tool called"

Respond with SKIP or the reply only. No labels or explanation.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data?.content?.[0]?.text?.trim() || null
    return (!text || text === 'SKIP') ? null : text
  } catch { return null }
}

// ── Main poller — called by the cron endpoint ─────────────────────────────────
export async function pollInsights(redis) {
  const startTime = Date.now()
  const logs = []
  const log = (msg) => { logs.push(msg); console.log(`[insights-poller] ${msg}`) }

  log(`Starting poll at ${new Date().toISOString()}`)

  // 1. Get all active monitor IDs
  const activeMonitorIds = await redis.smembers('insights:active_monitors') || []
  log(`Found ${activeMonitorIds.length} active monitor(s)`)

  if (activeMonitorIds.length === 0) {
    return { success: true, monitorsPolled: 0, totalNewMatches: 0, logs }
  }

  let totalNewMatches = 0
  let monitorsPolled = 0

  for (const monitorId of activeMonitorIds) {
    try {
      const raw = await redis.get(`insights:monitor:${monitorId}`)
      if (!raw) continue
      const monitor = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (!monitor.active || !monitor.keywords || monitor.keywords.length === 0) continue

      log(`Polling monitor ${monitorId} "${monitor.name}" (${monitor.keywords.length} keywords)`)

      // 2. Collect existing match IDs to deduplicate
      const existingMatchIds = new Set()
      try {
        const existingKeys = await redis.keys(`insights:match:${monitorId}:*`)
        for (const key of existingKeys) {
          const matchId = key.split(':').pop()
          existingMatchIds.add(matchId)
        }
      } catch { /* no existing matches, fresh monitor */ }

      let newMatchesForMonitor = 0

      // 3. Search for each keyword
      for (const kw of monitor.keywords) {
        const keyword = typeof kw === 'string' ? kw : kw.keyword
        const subreddits = (typeof kw === 'object' && Array.isArray(kw.subreddits)) ? kw.subreddits : []
        if (!keyword || keyword.length < 2) continue

        // Reddit
        const redditResults = await searchReddit(keyword, subreddits)
        for (const post of redditResults) {
          if (existingMatchIds.has(post.id)) continue
          existingMatchIds.add(post.id)

          // Generate draft if approved
          const productContext = (typeof kw === 'object' && kw.productContext) ? kw.productContext : (monitor.productContext || '')
          const draft = await generateReplyDraft(post, productContext)
          await delay(500)

          const matchId = post.id
          const match = {
            id: matchId,
            keyword: post.keyword,
            title: post.title,
            url: post.url,
            subreddit: post.subreddit,
            author: post.author,
            score: post.score,
            comments: post.comments,
            body: post.body,
            createdAt: post.createdAt,
            source: post.source,
            approved: post.approved,
            draft,
            feedback: null,
          }

          await redis.set(`insights:match:${monitorId}:${matchId}`, JSON.stringify(match))
          await redis.lpush(`insights:matches:${monitorId}`, matchId)
          newMatchesForMonitor++
        }

        // Nairaland (only if no subreddit restrictions or explicitly including nairaland)
        if (subreddits.length === 0 || subreddits.some(s => s.toLowerCase().includes('nairaland'))) {
          const nlResults = await searchNairaland(keyword)
          for (const post of nlResults) {
            const nlId = post.id
            if (existingMatchIds.has(nlId)) continue
            existingMatchIds.add(nlId)

            const match = {
              id: nlId,
              keyword: post.keyword,
              title: post.title,
              url: post.url,
              subreddit: post.subreddit,
              author: post.author,
              score: post.score,
              comments: post.comments,
              body: post.body,
              createdAt: post.createdAt,
              source: post.source,
              approved: post.approved,
              draft: null,
              feedback: null,
            }

            await redis.set(`insights:match:${monitorId}:${nlId}`, JSON.stringify(match))
            await redis.lpush(`insights:matches:${monitorId}`, nlId)
            newMatchesForMonitor++
          }
        }

        await delay(1000) // throttle between keywords
      }

      // 4. Update monitor metadata
      monitor.lastPollAt = new Date().toISOString()
      monitor.totalMatchesFound = (monitor.totalMatchesFound || 0) + newMatchesForMonitor
      await redis.set(`insights:monitor:${monitorId}`, JSON.stringify(monitor))

      log(`Monitor ${monitorId}: ${newMatchesForMonitor} new match(es)`)
      totalNewMatches += newMatchesForMonitor
      monitorsPolled++

    } catch (err) {
      log(`Error polling ${monitorId}: ${err.message}`)
    }
  }

  const duration = Date.now() - startTime
  log(`Poll complete: ${monitorsPolled} monitor(s), ${totalNewMatches} new match(es), ${duration}ms`)

  return {
    success: true,
    monitorsPolled,
    totalNewMatches,
    durationMs: duration,
    logs,
  }
}
