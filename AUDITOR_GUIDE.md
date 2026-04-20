# AUDITOR GUIDE — Signova Data Processing Agreement (DPA) Generator

**Prepared for:** Rosemary Onu-Okeke, Data Protection Consultant  
**Prepared by:** Signova Engineering Team, Ebenova Solutions  
**Date:** April 2026  
**Version:** 1.0  

---

## 1. PURPOSE OF THIS GUIDE

This document explains how Signova generates Data Processing Agreements (DPAs), the compliance logic behind NDPA/GAID clause selection, and how to use the "Implementation Checklist" feature. It also provides three test cases (Mock WhatsApp chats) you can use to stress-test the system during your audit.

---

## 2. WHAT IS SIGNOVA?

Signova is a legal document generation platform that produces jurisdiction-aware contracts from structured form inputs or conversational text (WhatsApp chats, emails, etc.). For DPAs, the platform:

1. Accepts structured inputs about the Controller, Processor, data categories, processing purposes, and governing law.
2. Injects **statutory-mandated clauses** specific to the selected jurisdiction (e.g., NDPA 2023 for Nigeria, GDPR for EU, POPIA for South Africa).
3. Generates a DPA with **three sections**:
   - **Section 1: Key Obligations Summary** — Plain-language, actionable bullet points (Criterion 2: Clarity).
   - **Section 2: The Formal DPA** — Comprehensive legal document with all statutory clauses.
   - **Section 3: Data Flow Mapping Template** — Practical checklist bridging contract to operations (Criterion 3: Implementability).

---

## 3. NDPA 2023 & GAID CLAUSE SELECTION LOGIC

When **"Nigeria — NDPA 2023"** is selected as the governing law, the following statutory clauses are **automatically injected** into the DPA system prompt. Each clause maps to a specific section of the NDPA 2023 or the NDPC's Guidelines on AI and Data Protection (GAID):

| Clause | Statutory Source | What It Covers |
|--------|-----------------|----------------|
| **Controller/Processor Roles** | NDPA Sections 5-6 | Clear distinction between who determines purposes (Controller) and who processes on instructions (Processor). Prevents the common confusion where businesses misallocate obligations. |
| **Data Subject Rights** | NDPA Section 34 | Access (30-day response), Rectification, Erasure, Restriction, Portability, Objection, Automated Decision-Making rights. Processor must implement technical measures to enable Controller compliance. |
| **Breach Notification** | NDPA Section 41 | Processor notifies Controller within **24 hours**. Controller notifies NDPC within **72 hours**. Register of breaches must be maintained. |
| **Cross-Border Transfers** | NDPA Section 43 | Transfers only to adequate countries, with SCCs/BCRs, or with explicit consent. Controller must be notified in writing before any transfer. |
| **Security Measures** | NDPA Section 39 | Encryption (TLS 1.3 / AES-256), RBAC, MFA, penetration testing (annual), vulnerability scanning (quarterly), incident response plan, staff training. |
| **Data Retention & Deletion** | NDPA Section 35 | Data not kept longer than necessary. Secure deletion at end of processing. Backup data overwritten within 90 days. Written certification of destruction required. |
| **GAID Provisions (AI/Automated Processing)** | NDPC GAID Guidelines | Transparency, fairness, non-discrimination, human oversight, purpose limitation, data minimisation, accountability, DPIA before deployment. |

**Code location:** `api/v1/documents/clauses.js` — each clause has inline comments explaining the statutory basis.

### Why this satisfies NDPA/GAID expectations:

- **Section 34 compliance:** The DPA explicitly operationalises each Data Subject right with deadlines, procedures, and technical measures — not just a statement that rights "shall be respected."
- **Section 41 compliance:** The 24h/72h dual-notification structure is stricter than the statutory minimum, giving the Controller buffer time to prepare the NDPC notification.
- **Section 43 compliance:** The cross-border clause lists all six lawful transfer mechanisms explicitly, preventing the common error of vague "data may be transferred globally" language.
- **GAID compliance:** The AI-specific provisions address the growing use of algorithmic systems in data processing — bias audits, human review, DPIAs, and documentation requirements.

---

## 4. HOW THE "WHATSAPP EXTRACTION" ENSURES ACCURACY

Signova's extraction engine (`api/extract-terms.js`) uses Claude Haiku to parse raw conversations and extract structured fields. For DPAs, the following 15 fields are extracted:

`controllerName`, `processorName`, `dataSubjects`, `dataCategories`, `specialCategoryData`, `processingPurpose`, `processingActivities`, `retentionPeriod`, `subProcessors`, `securityMeasures`, `dataTransfers`, `jurisdiction`, `dpoContact`, `breachNotificationHours`

**Extraction rules:**
- Only extracts what is clearly stated — conservative, no guessing.
- Infers governing law from context if strongly implied (e.g., "Lagos" → "Nigeria — NDPA 2023").
- Returns only fields found — omitted fields are left blank for manual completion.
- Rate-limited to 5 extractions per IP per hour to prevent abuse.

This means Rosemary can paste a real client email chain or WhatsApp conversation, and the system will auto-fill the DPA fields — reducing drafting time from hours to minutes.

---

## 5. HOW TO USE THE "IMPLEMENTATION CHECKLIST" FEATURE

Every generated DPA includes **Section 3: Data Flow Mapping Template**. This is not legal text — it is an **operational checklist** that translates contract clauses into actionable tasks.

### How to use it:

1. **Generate the DPA** (via form or WhatsApp extraction).
2. **Scroll to Section 3** at the end of the document.
3. **Complete each system mapping:**
   - CRM / Customer Database — list data stored, access, retention, deletion procedures.
   - Cloud Storage — provider, encryption status, access controls, sub-processors.
   - Email / Marketing Platform — consent basis, opt-out, third-party sharing.
   - HR / Payroll System — employee data, special category data, access.
   - Payment / Billing System — PCI-DSS compliance, payment data storage.
4. **Complete the Access Control Review** — verify IAM roles, MFA, departed employee access.
5. **Complete the Incident Response Readiness** — documented plan, contact list, notification templates, tabletop exercises.

**Why this matters:** Rosemary noted that "contracts say one thing, but internal data flows are not mapped." This section forces the business to map their actual systems against the contract terms — bridging paper compliance to operational reality.

---

## 6. EVALUATION CRITERIA CHECKLIST

Use this checklist when reviewing a generated DPA:

### Criterion 1: Alignment with NDPA/GAID
- [ ] Controller/Processor roles clearly distinguished (Sections 5-6)
- [ ] Data Subject Rights procedures specified with deadlines (Section 34)
- [ ] Breach notification: 24h to Controller, 72h to NDPC (Section 41)
- [ ] Cross-border transfer restrictions and adequacy requirements (Section 43)
- [ ] Security measures specified (Section 39)
- [ ] Data retention and deletion procedures (Section 35)
- [ ] GAID AI/automated processing provisions included

### Criterion 2: Clarity of Obligations
- [ ] Key Obligations Summary at top — 5 plain-language bullet points
- [ ] Each obligation states "Who," "What," and "When"
- [ ] Legal jargon is minimised or explained
- [ ] No ambiguous "shall" without clear actor and deadline

### Criterion 3: Practical Implementability
- [ ] Data Flow Mapping Template included
- [ ] System-by-system mapping (CRM, Cloud, Email, HR, Payments)
- [ ] Access control review checklist
- [ ] Incident response readiness checklist
- [ ] Actionable checkboxes (not just "comply with NDPA")

---

## 7. TEST CASES — Mock WhatsApp Chats for Stress-Testing

### TEST CASE 1: Fintech Startup — Cloud Hosting DPA
**Scenario:** A Nigerian fintech (PaySwift Ltd.) engages a cloud provider (CloudServ Africa) to host their customer database. They need a DPA compliant with NDPA 2023.

**Paste this into the WhatsApp extraction field:**

```
PaySwift: We need a DPA for our cloud hosting arrangement with CloudServ. We're the controller — we collect customer names, BVNs, phone numbers, and transaction history for payment processing. CloudServ stores and backs up this data on their AWS infrastructure in South Africa. We need 99.9% uptime, encryption at rest and in transit, and they can't share our data with anyone else. If there's a breach, they must tell us within 24 hours so we can report to NDPC within 72 hours. Data retention is for the duration of the contract plus 30 days. Our DPO is legal@payswift.ng.
```

**Expected extraction:**
- Controller: PaySwift Ltd.
- Processor: CloudServ Africa
- Data categories: Customer names, BVNs, phone numbers, transaction history
- Processing purpose: Payment processing
- Processing activities: Cloud hosting, data storage, backup on AWS infrastructure in South Africa
- Security measures: Encryption at rest and in transit, 99.9% uptime
- Data transfers: Yes — to South Africa
- Breach notification: 24 hours to Controller, 72 hours to NDPC
- Retention: Duration of contract + 30 days
- DPO: legal@payswift.ng
- Jurisdiction: Nigeria — NDPA 2023 (inferred from "NDPC" and Nigerian context)

**What to verify in the output:**
- Cross-border transfer clause references South Africa specifically
- BVN (Bank Verification Number) treated as sensitive personal data
- 72-hour NDPC notification explicitly stated
- Data Flow Mapping Template includes cloud storage section with AWS as provider

---

### TEST CASE 2: HealthTech — Patient Data Processing DPA
**Scenario:** A Lagos healthtech (MediRecord Ltd.) uses an AI-powered diagnostics vendor (DiagnoAI) that processes patient health records. This tests GAID compliance for automated decision-making.

**Paste this into the WhatsApp extraction field:**

```
MediRecord: We're a health records management company in Lagos. We want to engage DiagnoAI, a South African company, to provide AI-powered diagnostic analysis on patient medical records. They'll receive patient names, medical histories, lab results, and X-ray images. Their AI system analyses the data and returns diagnostic recommendations. Our doctors make the final decision — DiagnoAI doesn't diagnose patients directly. We need them to delete all patient data within 14 days of contract end. They can't use our data to train their models. Breach notification within 12 hours. Our patients are mostly in Nigeria.
```

**Expected extraction:**
- Controller: MediRecord Ltd. (Lagos)
- Processor: DiagnoAI (South Africa)
- Data subjects: Patients
- Data categories: Patient names, medical histories, lab results, X-ray images
- Special category data: Health data, medical records
- Processing purpose: AI-powered diagnostic analysis
- Processing activities: Receiving and analysing patient medical records, returning diagnostic recommendations
- Retention: Delete within 14 days of contract end
- Sub-processors: Not permitted (data cannot be used for model training)
- Data transfers: Yes — to South Africa
- Breach notification: 12 hours
- Jurisdiction: Nigeria — NDPA 2023

**What to verify in the output:**
- **GAID clause is triggered:** AI/automated processing provisions included (transparency, human oversight, bias audits, DPIA)
- **Special category data clause:** Health data treated with heightened protections
- **Purpose limitation:** DiagnoAI cannot use data for model training
- **Human oversight:** Final diagnosis made by doctors, not AI
- **Data Flow Mapping Template** includes HR/Payroll and cloud storage sections for health data

---

### TEST CASE 3: E-Commerce — Marketing Platform DPA
**Scenario:** A Nigerian e-commerce platform (ShopNaija) engages a marketing SaaS (MailReach Pro) for email campaigns. This tests consent-based processing and data portability.

**Paste this into the WhatsApp extraction field:**

```
ShopNaija: We run an online marketplace in Nigeria. We want to use MailReach Pro for email marketing to our customers. They'll handle customer emails, purchase history, and browsing behaviour to send personalised campaigns. Customers must opt-in — we have explicit consent. MailReach can share aggregated analytics with us but not with any third party. We need the ability to export all our customer data if we switch providers. Data should be deleted within 7 days of contract termination. Contact: dpo@shopnaija.com.
```

**Expected extraction:**
- Controller: ShopNaija
- Processor: MailReach Pro
- Data subjects: Customers
- Data categories: Email addresses, purchase history, browsing behaviour
- Processing purpose: Email marketing with personalised campaigns
- Processing activities: Sending email campaigns, analytics
- Retention: Deleted within 7 days of contract termination
- Sub-processors: Not permitted (no third-party sharing)
- Data transfers: No — data stays in-country (inferred)
- DPO: dpo@shopnaija.com
- Jurisdiction: Nigeria — NDPA 2023

**What to verify in the output:**
- **Consent basis:** Explicit opt-in requirement reflected in Data Subject Rights clause
- **Data portability:** Export clause included for switching providers
- **Purpose limitation:** Analytics only — no third-party sharing
- **Quick deletion:** 7-day deletion period (shorter than standard)
- **Data Flow Mapping Template** includes email/marketing platform section with consent basis and opt-out mechanism

---

## 8. TECHNICAL ARCHITECTURE

```
WhatsApp Chat → api/extract-terms.js (Claude Haiku) → JSON Fields
                                                      ↓
                                    api/generate-preview.js (Groq — free)
                                    api/generate.js (Claude Sonnet — paid)
                                    api/v1/documents/generate.js (API — authenticated)
                                                      ↓
                        DPA System Prompt + NDPA/GAID Clauses Injected
                                    (api/v1/documents/clauses.js)
                                                      ↓
                        Three-Section Output:
                        1. Key Obligations Summary (plain language)
                        2. Formal DPA (statutory clauses)
                        3. Data Flow Mapping Template (operational)
```

---

## 9. LIMITATIONS & DISCLAIMERS

- Signova generates **templates** for informational purposes. They do not constitute legal advice.
- Laws change frequently. The NDPA 2023 is relatively new and subject to regulatory guidance that may evolve.
- We recommend that any DPA generated by Signova be reviewed by a qualified data protection professional before execution.
- The Implementation Checklist is a **starting point** — businesses should adapt it to their specific technical environment.

---

## 10. CONTACT

For technical questions about the DPA generation logic:
- **Engineering:** info@ebenova.net
- **Platform:** https://www.getsignova.com/generate/data-processing-agreement

Thank you for testing Signova. We welcome your feedback on the NDPA/GAID alignment, clarity of obligations, and practical implementability of the generated documents.
