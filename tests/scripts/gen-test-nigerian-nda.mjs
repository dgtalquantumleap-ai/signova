/**
 * Part 4 generation test — Nigerian NDA Rosemary audit fixes
 * Calls Anthropic directly using the same prompts both endpoints would produce.
 * Run: node tests/scripts/gen-test-nigerian-nda.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { buildJurisdictionContext } from '../../lib/jurisdiction-context.js'

// Load env.local
const envLocal = readFileSync('.env.local', 'utf8')
const apiKey = envLocal.match(/ANTHROPIC_API_KEY=["']?([^"'\n]+)/)?.[1]?.trim()
if (!apiKey || apiKey.includes('YOUR_KEY')) {
  console.error('No live ANTHROPIC_API_KEY found in .env.local')
  process.exit(1)
}

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 20000

// Part 6 scenario — different parties from Part 4 to confirm prompt fires for
// any Nigerian NDA, not just the specific fixture parties.
const PARTIES = {
  disclosing: 'Olamide Bakare-Akintoye',
  receiving: 'DataBridge Analytics Ltd (RC 1234567)',
}
const PURPOSE = 'evaluating a data analytics outsourcing arrangement that will involve transfer of employee and customer personal data from the disclosing party\'s HR and CRM systems to the receiving party\'s processing environment'

// ── Shared Nigerian NDA clause content (matches both endpoints exactly) ───────
const NIGERIAN_NDA_CLAUSE =
  '\n\nIMPORTANT — NIGERIAN NDA / CONFIDENTIALITY LAW: Apply:\n' +
  '(i) NO STANDALONE TRADE-SECRET STATUTE — Nigeria does not have a dedicated trade-secrets act. Protection flows from (a) CONTRACT (the NDA itself), (b) EQUITABLE DOCTRINE OF BREACH OF CONFIDENCE (Coco v A.N. Clark (Engineers) [1969] RPC 41 applied by Nigerian courts), and (c) the implied equitable duty of confidence in fiduciary and employment relationships.\n' +
  '(ii) GAID 2025 PRIMACY / NDPA 2023 OVERLAY — GAID 2025 is the primary binding regulatory directive for data processing in Nigeria; NDPA 2023 is the underlying Act which GAID 2025 implements. Where "Confidential Information" includes personal data of third parties, both instruments apply concurrently: lawful basis [GAID 2025 (implementing NDPA 2023 s.25 [VERIFY])], data-subject rights [GAID 2025 (implementing NDPA 2023 s.34 [VERIFY])], cross-border transfer restrictions [GAID 2025 (implementing NDPA 2023 s.43 [VERIFY])]. The NDA should NOT purport to override data-subject rights by contract.\n' +
  '(iii) NIGERIAN AUTHORITIES — Adetoun Oladeji (Nig.) Ltd v N.B. Plc [2007] 5 NWLR (Pt.1027) 415 (Supreme Court on breach of confidence); Rabiu v AG Kaduna [1980] 8–11 SC 130; Microfeed Nigeria v Gov. of Kano State for confidential-information principles in commercial context.\n' +
  '(iv) REASONABLE DURATION — perpetual confidentiality obligations are enforceable where the information genuinely remains a trade secret; but where the information enters the public domain, the obligation falls away (absent contract to the contrary). Typical drafted duration: 3–5 years for ordinary business info; indefinite for trade secrets.\n' +
  '(v) NON-SOLICITATION / NON-DEALING — clauses restraining post-NDA solicitation of employees or customers are subject to the restraint-of-trade doctrine — must be reasonable in scope and duration (see Koumoulis v Leventis Motors).\n' +
  '(vi) REMEDIES — injunction (prohibitory and mandatory), damages (measured as loss of business / account of profits / unjust enrichment), delivery-up of materials.\n' +
  '(vii) DISPUTE RESOLUTION — Arbitration and Mediation Act 2023 is the current framework (repealed the Arbitration and Conciliation Act 2004). Reference AMA 2023 with Lagos seat for most commercial NDAs.\n' +
  '(viii) STAMP DUTY — NDAs are dutiable at a nominal rate as "agreements under hand" per Stamp Duties Act Sch.1.\n' +
  '\n\nNIGERIAN NDA — NDPA/GAID COMPLIANCE REQUIREMENTS (REVIEWED BY DATALEX CONSULTING)\n' +
  'The following 9 requirements are MANDATORY. Each must appear as a distinct, substantive clause in the generated NDA. A clause heading alone is NOT sufficient — each clause must contain operative obligations. Do not skip, summarise, or weaken any of these requirements.\n\n' +
  '1. LAWFUL BASIS FOR PROCESSING — MANDATORY\n' +
  '(a) The "Personal Data" definition MUST incorporate the full definition from NDPA 2023 Section 65 [VERIFY], covering any information relating to an identified or identifiable natural person, including information usable alone or in combination to identify a person.\n' +
  '(b) A SEPARATE "Sensitive Personal Data" sub-category MUST be defined per GAID 2025 (implementing NDPA 2023 Section 30 [VERIFY]), covering: genetic data, biometric data, health data, racial or ethnic origin, religious or philosophical beliefs, political opinions, trade union membership, sexual orientation.\n' +
  '(c) A dedicated clause titled "Lawful Basis for Processing" MUST require each party to: (i) declare in writing the specific lawful basis relied upon BEFORE processing any personal data shared under this Agreement; (ii) select the basis from those recognised under GAID 2025 (implementing NDPA 2023 Section 25 [VERIFY]): consent, contract performance, legal obligation, vital interests of the data subject, public interest, or legitimate interests; (iii) maintain written documentation of the chosen basis for regulatory inspection.\n\n' +
  '2. DATA MINIMISATION — MANDATORY\n' +
  'A dedicated clause titled "Data Minimisation" MUST: (a) expressly restrict any personal data shared under this Agreement to only what is strictly necessary to fulfil the defined Purpose; (b) prohibit collection, processing, or retention of personal data beyond that scope; (c) cite GAID 2025 (implementing NDPA 2023 Section 24(1)(c) [VERIFY]) as the statutory authority.\n\n' +
  '3. DATA RETENTION AND DELETION — MANDATORY\n' +
  'A dedicated clause titled "Data Retention and Deletion" MUST: (a) specify the retention period: personal data shall be retained for the duration of this Agreement plus 2 years where legally required, or 30 days following fulfilment of the Purpose, whichever is the shorter period [VERIFY with Rosemary — she will confirm the final recommended default]; (b) require secure deletion OR irreversible anonymisation of all personal data upon expiry of the retention period; (c) require written confirmation of deletion or anonymisation within 14 days of a request from the disclosing party; (d) cite the GAID 2025 retention directive as the primary authority.\n\n' +
  '4. SECURITY MEASURES (TECHNICAL AND ORGANISATIONAL) — MANDATORY\n' +
  'Replace any vague "appropriate security measures" language. A dedicated clause titled "Technical and Organisational Security Measures" MUST specify: (a) encryption of all personal data using industry-standard algorithms such as AES-256 or equivalent, applied both at rest and in transit; (b) role-based access controls with documented authorisation lists, restricting access to personal data to personnel who require it solely to fulfil the Purpose; (c) internal data governance processes including incident logging, access audit trails, and periodic (at minimum annual) compliance reviews; (d) an obligation to maintain these measures for the duration of the Agreement and the applicable retention period; (e) cite GAID 2025 (implementing NDPA 2023 Section 39 [VERIFY]) as the source of this obligation.\n\n' +
  '5. DATA SUBJECT RIGHTS — MANDATORY\n' +
  'A dedicated clause titled "Data Subject Rights" MUST: (a) acknowledge and give effect to the rights under GAID 2025 (implementing NDPA 2023 Sections 33–38 [VERIFY]): right of access, right to rectification, right to erasure, right to object, and right to data portability; (b) require each party to facilitate the exercise of these rights in relation to personal data for which it is responsible under this Agreement; (c) confirm each data subject\'s right to lodge a complaint with the Nigeria Data Protection Commission (NDPC); (d) require each party to respond to data subject requests within 30 days of receipt; (e) designate a named contact point at each party responsible for handling data subject requests.\n\n' +
  '6. AUDIT AND COMPLIANCE VERIFICATION — MANDATORY\n' +
  'A dedicated clause titled "Audit and Compliance Verification" MUST: (a) entitle each party to request, at any time, written evidence of the other party\'s compliance with its GAID 2025 and NDPA 2023 obligations under this Agreement; (b) entitle each party to conduct a reasonable compliance audit, or to accept an equivalent independent third-party audit report in lieu; (c) require 14 calendar days\' prior written notice before any audit; (d) provide that each party bears its own audit costs unless the audit reveals a material breach, in which case the breaching party bears the reasonable and documented costs of the audit.\n\n' +
  '7. CROSS-BORDER DATA TRANSFER — GAID 2025 SAFEGUARDS — MANDATORY\n' +
  'The cross-border transfer clause MUST be expanded to include: (a) a declaration that GAID 2025 is the primary framework governing international transfers of personal data originating from Nigeria; (b) a requirement that any transfer of personal data outside Nigeria must rely on one of: (i) an adequacy determination by the NDPC, (ii) binding contractual safeguards such as standard data transfer clauses, or (iii) where neither applies, the explicit and informed written consent of the affected data subjects; (c) an obligation to notify affected data subjects of any international transfer, including the destination country and the transfer mechanism used.\n\n' +
  '8. BREACH NOTIFICATION HIERARCHY — MANDATORY\n' +
  'The breach-notification clause MUST be structured as a TWO-STEP hierarchy:\n' +
  'STEP 1 — PARTY-TO-PARTY NOTIFICATION (IMMEDIATE, BEFORE REGULATORY REPORTING): Upon discovery of any actual or reasonably suspected personal data breach affecting data processed under this Agreement, the discovering party MUST notify the other party in writing within 24 hours of discovery, and in any event BEFORE making any regulatory notification. The notice MUST include: (i) the nature of the breach; (ii) the categories and approximate number of personal data records affected; (iii) the estimated number of data subjects affected; (iv) the remediation steps taken or proposed.\n' +
  'STEP 2 — REGULATORY NOTIFICATION (72-HOUR NDPC OBLIGATION — RETAIN): RETAIN the obligation to notify the NDPC within 72 hours of becoming aware of a personal data breach, as required by GAID 2025 (implementing NDPA 2023 Section 40 [VERIFY]). Do NOT reduce, limit, or remove this obligation.\n\n' +
  '9. CONFIDENTIALITY DURATION AND DATA PROTECTION SURVIVAL — MANDATORY\n' +
  'The confidentiality duration clause MUST: (a) specify the confidentiality period explicitly: obligations of confidentiality shall continue for 3 years from the date of termination or expiry of this Agreement, or such longer period as required by applicable law [VERIFY with Rosemary — she will set the final recommended default]; (b) include an express survival clause: data protection obligations (lawful basis, data minimisation, security measures, data subject rights, audit rights, cross-border transfer safeguards, and breach notification) SURVIVE termination or expiry of this Agreement for the full duration of the applicable retention period; (c) cite GAID 2025 (implementing NDPA 2023 Section 41 [VERIFY]) as the source of continuing post-termination obligations.\n\n' +
  'This Nigerian NDA has been reviewed for NDPA 2023 / GAID 2025 compliance gaps by DataLex Consulting (Barrister Rosemary Onu-Okeke, Esq. LL.B, B.L, MSc). Every instruction above is MANDATORY. Do not skip, summarise, or weaken any of the 9 numbered requirements. Where [VERIFY] tags appear, retain the exact statute citation provided — do NOT invent or substitute section numbers. Non-compliance with NDPA 2023 data protection obligations exposes parties to regulatory penalties under GAID 2025 (implementing NDPA 2023 Section 48 [VERIFY]) of up to ₦10,000,000 or 2% of annual gross revenue, whichever is greater.\n' +
  'Governing law: Laws of the Federal Republic of Nigeria. Jurisdiction: Federal High Court (IP / confidential-information disputes relating to patents/copyright) or State High Court (pure contract / equity).'

// ── Nigeria jurisdiction library context ─────────────────────────────────────
const nigeriaLibContext = buildJurisdictionContext('nigeria') +
  '\n\nWhen drafting this document, apply the jurisdiction framework above: cite the statutes listed where they bear on the document type; use the governing-law clause structure from the framework; use the forum/venue from the framework; use the currency from the framework for monetary references; do not invoke statutes from other jurisdictions.'

// ── Consumer endpoint system prompt ──────────────────────────────────────────
// Mirrors api/generate.js: library context + expert preamble + nigeriaNDAClause
const consumerSystemPrompt =
  nigeriaLibContext + '\n\n' +
  'You are an expert legal document drafter with deep knowledge of international law, including the common-law traditions of Nigeria, Kenya, Ghana, South Africa, Canada, the United States, the United Kingdom, and Commonwealth jurisdictions; the civil-law tradition of Quebec; and the statutory frameworks of each (CAMA 2020 & ISA 2025 for Nigeria; Lagos State Tenancy Law 2011; Labour Act & PRA 2014; Land Use Act 1978; Hire Purchase Act 1965; Companies Act 2015 for Kenya; Companies Act 2019 (Act 992) for Ghana; Companies Act 71 of 2008 for South Africa; Companies Act 2006 and FSMA 2000 for the UK; DGCL for Delaware; CBCA and provincial ESAs for Canada; PIPEDA, Quebec Law 25, CCPA/CPRA, UK GDPR, NDPA 2023, POPIA, Kenya DPA 2019 for data). Generate comprehensive, professional legal documents tailored precisely to the user details provided. Use formal legal language, clear numbered sections, and include all standard clauses. Use the spelling conventions of the governing jurisdiction (British / Commonwealth English for Nigerian documents). This is a premium paid document — make it exceptional. Never add disclaimers, footnotes, notes, or suggestions to consult a lawyer at the end of the document. The document ends cleanly after the signature block with no additional commentary.' +
  NIGERIAN_NDA_CLAUSE

// ── v1 API endpoint system prompt ────────────────────────────────────────────
// Mirrors api/v1/documents/generate.js: library context + generic expert + v1NigeriaNDAClause
const v1SystemPrompt =
  nigeriaLibContext + '\n\n' +
  'You are an expert legal document drafter with deep knowledge of international law, including common-law (Canada, US, UK, Commonwealth), civil-law (Quebec), and the North American statutory privacy regimes (PIPEDA, Quebec Law 25, CCPA/CPRA). Generate comprehensive, professional legal documents tailored precisely to the details provided. Use formal legal language, clear numbered sections, and include all standard clauses. Use the spelling conventions of the governing jurisdiction. This is a premium paid document — make it exceptional. Never add disclaimers, footnotes, notes, or suggestions to consult a lawyer at the end of the document. The document ends cleanly after the signature block with no additional commentary.' +
  NIGERIAN_NDA_CLAUSE

// ── User prompts ─────────────────────────────────────────────────────────────
const consumerUserPrompt =
  `Generate a Non-Disclosure Agreement for the following:\n\n` +
  `Document Type: Non-Disclosure Agreement\n` +
  `Governing Law: Nigeria\n` +
  `Disclosing Party: ${PARTIES.disclosing}\n` +
  `Receiving Party: ${PARTIES.receiving}\n` +
  `Purpose: ${PURPOSE}\n` +
  `\nThis is a mutual NDA. Both parties may share confidential information with the other.`

const v1UserPrompt =
  `Generate a professional, comprehensive Non-Disclosure Agreement document for the following:\n\n` +
  `Document Type: nda\n` +
  `Jurisdiction: Nigeria\n` +
  `Disclosing Party: ${PARTIES.disclosing}\n` +
  `Receiving Party: ${PARTIES.receiving}\n` +
  `Purpose: ${PURPOSE}\n` +
  `\nRequirements:\n` +
  `- Write in formal legal language appropriate for the document type\n` +
  `- Be specific and detailed, not generic\n` +
  `- Structure with clear numbered sections and subsections\n` +
  `- Include all standard clauses expected in a Non-Disclosure Agreement\n` +
  `- Tailor the content to the specific details provided\n` +
  `- Do not include any placeholder text like [INSERT NAME] — use the actual values provided\n` +
  `- End with a signature block\n` +
  `- Do NOT add any disclaimers, footnotes, notes, or suggestions to seek legal advice\n\n` +
  `Output the complete document only, no preamble, explanation, or closing notes.`

// ── Anthropic API call ────────────────────────────────────────────────────────
async function generate(label, systemPrompt, userPrompt) {
  console.log(`\n[${label}] Calling Anthropic (model=${MODEL}, max_tokens=${MAX_TOKENS})...`)
  const start = Date.now()
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(`Anthropic error ${resp.status}: ${JSON.stringify(err)}`)
  }
  const data = await resp.json()
  const text = data?.content?.[0]?.text || ''
  const stopReason = data?.stop_reason
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`[${label}] Done in ${elapsed}s. stop_reason=${stopReason}. length=${text.length} chars`)
  if (stopReason === 'max_tokens') {
    console.warn(`[${label}] WARNING: hit max_tokens — output may be truncated`)
  }
  return { text, stopReason }
}

// ── Clause presence checker ───────────────────────────────────────────────────
const CLAUSE_PATTERNS = [
  { id: 'lawful-basis-processing',         re: /lawful basis|legal basis|grounds for processing|Section 25|consent.*contract.*legitimate/i },
  { id: 'data-minimisation',               re: /data minimis[sz]ation|only.*strictly necessary|limited to.*purpose|Section 24/i },
  { id: 'retention-deletion',              re: /retention period|retain.*data.*for|delete.*data|anonymi[sz]e|GAID 2025.*retention|30 days.*purpose/i },
  { id: 'security-measures-specific',      re: /AES.256|industry.standard encryption|role.based access|technical and organisational|Section 39/i },
  { id: 'data-subject-rights',             re: /data subject rights|right.*access.*rectif|right to erasure|lodge.*complaint.*NDPC|Sections 33|section 33/i },
  { id: 'audit-verification',              re: /right to audit|evidence of compliance|independent audit|reasonable.*notice|14.*calendar|audit cooperation/i },
  { id: 'cross-border-transfer-gaid',      re: /cross.border.*transfer|international.*transfer|adequacy|GAID 2025.*transfer|approved transfer mechanism/i },
  { id: 'breach-notification-hierarchy',   re: /immediate.*party|party.to.party|before.*regulatory|24 hours.*discovery|step 1|STEP 1/i },
  { id: 'duration-survival-data-protection', re: /survive termination|surviving.*termination|continuing obligation|data protection.*survive|Section 41/i },
]

const GAID_PRIMACY_PATTERN = /GAID 2025/i
const NDPA_AS_UNDERLYING = /GAID 2025.*implementing.*NDPA|GAID 2025.*NDPA 2023/i

function auditOutput(label, text) {
  console.log(`\n${'='.repeat(72)}`)
  console.log(`CLAUSE AUDIT — ${label}`)
  console.log('='.repeat(72))

  let score = 0
  for (const { id, re } of CLAUSE_PATTERNS) {
    const match = re.test(text)
    if (match) score++
    const excerpt = match
      ? (() => {
          const idx = text.search(re)
          return text.slice(Math.max(0, idx - 30), idx + 200).replace(/\n/g, ' ').trim()
        })()
      : '—'
    console.log(`\n[${match ? '✅' : '❌'}] ${id}`)
    if (match) console.log(`   Excerpt: "${excerpt.slice(0, 220)}"`)
  }

  const gaidPresent = GAID_PRIMACY_PATTERN.test(text)
  const gaidPrimacy = NDPA_AS_UNDERLYING.test(text)
  console.log(`\n[${gaidPresent ? '✅' : '❌'}] GAID 2025 cited in document`)
  console.log(`[${gaidPrimacy ? '✅' : '❌'}] GAID 2025 framed as primary (implementing NDPA 2023)`)

  const gaidCitations = text.match(/GAID 2025[^.\n]*/g) || []
  if (gaidCitations.length > 0) {
    console.log(`\nFirst 3 GAID/NDPA citation patterns:`)
    gaidCitations.slice(0, 3).forEach((c, i) => console.log(`  ${i+1}. ${c.trim()}`))
  }

  console.log(`\nAudit-grade: ${score}/9 Rosemary gaps covered`)
  return score
}

// ── Main ──────────────────────────────────────────────────────────────────────
const [consumer, v1api] = await Promise.all([
  generate('CONSUMER', consumerSystemPrompt, consumerUserPrompt),
  generate('V1-API',   v1SystemPrompt,       v1UserPrompt),
])

writeFileSync('.audit-outputs/nigerian-nda-rosemary-fixes-test-03.txt', consumer.text, 'utf8')
writeFileSync('.audit-outputs/nigerian-nda-rosemary-fixes-test-04.txt', v1api.text, 'utf8')
console.log('\n✅ Outputs saved to .audit-outputs/')

const score1 = auditOutput('CONSUMER endpoint (test-03)', consumer.text)
const score2 = auditOutput('V1-API endpoint (test-04)',   v1api.text)

console.log(`\n${'='.repeat(72)}`)
console.log('SUMMARY')
console.log('='.repeat(72))
console.log(`Consumer endpoint: ${score1}/9`)
console.log(`V1 API endpoint:   ${score2}/9`)
console.log(`Both outputs truncated: consumer=${consumer.stopReason === 'max_tokens'}, v1=${v1api.stopReason === 'max_tokens'}`)
