// api/v1/documents/clauses.js
// Jurisdiction-specific clause injection for Data Processing Agreements.
// Each clause library maps to specific statutory requirements and includes
// inline comments explaining WHY each clause satisfies the regulation.

// ── NDPA 2023 (Nigeria Data Protection Act) ────────────────────────────────
// Replaced NDPR 2019 as primary data protection legislation.
// Established the Nigeria Data Protection Commission (NDPC).
const NDPA_2023_CLAUSES = {
  dataSubjectRights: {
    title: 'Data Subject Rights (NDPA Section 34)',
    // NDPA Section 34 guarantees: right to be informed, right of access,
    // right to rectification, right to erasure, right to restrict processing,
    // right to data portability, right to object, rights regarding automated decision-making.
    text: `The Processor shall assist the Controller in fulfilling Data Subject rights under Section 34 of the Nigeria Data Protection Act 2023, including but not limited to:
(a) Right of Access: The Controller shall respond to a Data Subject's request for access to their personal data within 30 days of receipt, providing the data in a clear and intelligible format.
(b) Right to Rectification: The Controller shall correct inaccurate personal data without undue delay upon request from the Data Subject.
(c) Right to Erasure: The Controller shall erase personal data without undue delay where the data is no longer necessary for the purpose collected, consent is withdrawn, or processing is unlawful.
(d) Right to Object: The Data Subject may object to processing at any time. The Processor shall cease processing unless the Controller demonstrates compelling legitimate grounds.
(e) Right to Data Portability: The Controller shall provide personal data in a structured, commonly used, and machine-readable format upon request.
(f) Right to Restrict Processing: The Controller shall restrict processing where the accuracy of data is contested, processing is unlawful, or the Controller no longer needs the data but the Data Subject requires it for legal claims.

The Processor shall implement technical and organisational measures to enable the Controller to fulfil these obligations, including searchable data indexing, secure deletion procedures, and documented response workflows.`,
  },
  breachNotification: {
    title: 'Mandatory Breach Notification (NDPA Section 41)',
    // NDPA Section 41 requires notification to the Commission within 72 hours
    // of becoming aware of a breach. The DPA imposes a stricter 24-hour
    // internal notification from Processor to Controller.
    text: `In the event of a Personal Data Breach, the Processor shall:
(a) Notify the Controller without undue delay and in any case within 24 hours of becoming aware of the breach.
(b) Provide the Controller with sufficient information to enable the Controller to meet its obligation to notify the Nigeria Data Protection Commission (NDPC) within 72 hours of the breach becoming known, as required by Section 41 of the NDPA 2023.
(c) Cooperate fully with the Controller and the NDPC in any investigation or remediation efforts.
(d) Maintain a register of all Personal Data Breaches, including the facts relating to the breach, its effects, and the remedial action taken.

The notification to the Controller shall include, at minimum: the nature of the breach, categories and approximate number of Data Subjects affected, categories and approximate number of personal data records concerned, likely consequences, and measures taken or proposed to address the breach.`,
  },
  crossBorderTransfers: {
    title: 'Cross-Border Data Transfer (NDPA Section 43)',
    // NDPA Section 43 permits transfers only to countries with adequate data
    // protection laws, or with appropriate safeguards (SCCs, BCRs), or
    // with explicit consent of the Data Subject.
    text: `The Processor shall not transfer personal data outside the Federal Republic of Nigeria unless one of the following conditions is met, as required by Section 43 of the NDPA 2023:
(a) The destination country has been declared by the NDPC to have an adequate level of data protection.
(b) Appropriate safeguards are in place, such as Standard Contractual Clauses (SCCs), Binding Corporate Rules (BCRs), or approved codes of conduct.
(c) The Data Subject has given explicit consent to the proposed transfer after being informed of the possible risks.
(d) The transfer is necessary for the performance of a contract between the Data Subject and the Controller, or for the implementation of pre-contractual measures.
(e) The transfer is necessary for important reasons of public interest.
(f) The transfer is necessary for the establishment, exercise, or defence of legal claims.

Where personal data is transferred outside Nigeria, the Processor shall ensure that the level of protection guaranteed in Nigeria is not undermined. The Controller must be notified in writing before any such transfer.`,
  },
  controllerProcessorRoles: {
    title: 'Controller and Processor Role Definitions (NDPA Sections 5-6)',
    // NDPA clearly distinguishes between Controller (determines purposes/means)
    // and Processor (processes on behalf of Controller). This is critical
    // because many businesses confuse the two and misallocate obligations.
    text: `For the purposes of this Agreement and the NDPA 2023:

"Data Controller" means the organisation that determines the purposes and means of the processing of personal data. The Controller is responsible for ensuring that processing complies with the NDPA, obtaining lawful basis for processing, responding to Data Subject rights, and notifying the NDPC of breaches.

"Data Processor" means the organisation that processes personal data on behalf of the Controller. The Processor shall:
(a) Process personal data only on documented instructions from the Controller, including with regard to transfers outside Nigeria.
(b) Ensure that persons authorised to process personal data are subject to a duty of confidentiality.
(c) Implement appropriate technical and organisational security measures proportionate to the risk.
(d) Engage sub-processors only with prior specific or general written authorisation from the Controller.
(e) Assist the Controller in ensuring compliance with security, breach notification, and Data Subject rights obligations.
(f) At the Controller's choice, delete or return all personal data at the end of the processing services.
(g) Make available to the Controller all information necessary to demonstrate compliance and allow for audits.

The Processor shall not determine the purposes or means of processing beyond what is explicitly instructed by the Controller. Any processing beyond the scope of these instructions shall constitute a breach of this Agreement and the NDPA 2023.`,
  },
  gaidProvisions: {
    title: 'AI and Automated Decision-Making Provisions (GAID Guidelines)',
    // The NDPC's Guidelines on Artificial Intelligence and Data Protection
    // require transparency, fairness, non-discrimination, human oversight,
    // and accountability in AI-driven data processing.
    text: `Where the Processor uses automated decision-making, artificial intelligence, or algorithmic systems in processing personal data on behalf of the Controller, the following GAID-compliant provisions apply:

(a) Transparency: The Processor shall disclose to the Controller the logic, significance, and envisaged consequences of any automated processing. The Controller shall ensure this information is communicated to Data Subjects in plain language.
(b) Fairness and Non-Discrimination: The Processor shall ensure that any automated system does not produce discriminatory outcomes based on protected characteristics including ethnicity, gender, religion, disability, or socioeconomic status. Regular bias audits shall be conducted.
(c) Human Oversight: The Processor shall implement meaningful human review mechanisms for any automated decision that significantly affects a Data Subject. Data Subjects shall have the right to request human intervention, express their point of view, and contest the decision.
(d) Purpose Limitation: Personal data processed by automated systems shall be collected for specified, explicit, and legitimate purposes and not further processed in a manner incompatible with those purposes.
(e) Data Minimisation: Automated systems shall process only the personal data that is adequate, relevant, and limited to what is necessary for the purposes for which they are processed.
(f) Accountability: The Processor shall maintain documentation of all automated processing activities, including the algorithms used, training data sources, and decision logic. This documentation shall be made available to the Controller and the NDPC upon request.
(g) Impact Assessment: Before deploying any automated processing system, the Processor shall assist the Controller in conducting a Data Protection Impact Assessment (DPIA) as recommended by the GAID Guidelines.`,
  },
  securityMeasures: {
    title: 'Technical and Organisational Security Measures (NDPA Section 39)',
    // NDPA Section 39 requires appropriate security measures.
    // This clause translates the statutory requirement into actionable obligations.
    text: `The Processor shall implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk, as required by Section 39 of the NDPA 2023. These measures shall include:

(a) Encryption: Personal data shall be encrypted both in transit (using TLS 1.3 or equivalent) and at rest (using AES-256 or equivalent).
(b) Access Control: Access to personal data shall be restricted to authorised personnel on a need-to-know basis, using role-based access control (RBAC) and multi-factor authentication (MFA).
(c) Resilience: The Processor shall ensure the ongoing confidentiality, integrity, availability, and resilience of processing systems and services, including regular backups and disaster recovery procedures.
(d) Testing: The Processor shall regularly test, assess, and evaluate the effectiveness of security measures, including penetration testing at least annually and vulnerability scanning at least quarterly.
(e) Incident Response: The Processor shall maintain a documented incident response plan and conduct tabletop exercises at least annually.
(f) Staff Training: All personnel with access to personal data shall receive data protection and security awareness training upon onboarding and at least annually thereafter.
(g) Physical Security: Where personal data is processed or stored in physical form, appropriate physical security measures shall be in place, including access controls to premises and secure destruction of physical records.`,
  },
  retentionDeletion: {
    title: 'Data Retention and Deletion (NDPA Section 35)',
    // NDPA Section 35 requires data not be kept longer than necessary.
    // This clause operationalises the principle with specific procedures.
    text: `The Processor shall not retain personal data for longer than is necessary for the purposes for which it was collected, as required by Section 35 of the NDPA 2023.

(a) Retention Period: Personal data shall be retained only for the duration specified in this Agreement: ${'${RETENTION_PERIOD}'}.
(b) End of Processing: Upon termination of the processing services, the Processor shall, at the Controller's choice, delete or return all personal data and existing copies, unless Nigerian law requires retention of the data.
(c) Deletion Procedure: Deletion shall be performed using secure methods that render the data unrecoverable, including cryptographic erasure for encrypted data and certified destruction for physical media.
(d) Backup Data: Personal data contained in backup systems shall be overwritten in accordance with the Processor's standard backup rotation schedule, and in any case within 90 days of the deletion request.
(e) Certification: Upon completion of deletion, the Processor shall provide the Controller with a written certification of destruction, specifying the date, method, and scope of deletion.`,
  },
}

// ── UK GDPR / DPA 2018 ─────────────────────────────────────────────────────
const UK_GDPR_CLAUSES = {
  dataSubjectRights: {
    title: 'Data Subject Rights (UK GDPR Articles 15-22)',
    text: `The Processor shall assist the Controller in fulfilling Data Subject rights under the UK GDPR and Data Protection Act 2018, including the rights of access (Article 15), rectification (Article 16), erasure (Article 17), restriction of processing (Article 18), data portability (Article 20), objection (Article 21), and rights relating to automated decision-making and profiling (Article 22). The Processor shall implement appropriate technical and organisational measures to enable the Controller to respond to Data Subject requests within the statutory one-month timeframe.`,
  },
  breachNotification: {
    title: 'Breach Notification (UK GDPR Article 33)',
    text: `In the event of a Personal Data Breach, the Processor shall notify the Controller without undue delay and in any case within 24 hours of becoming aware of the breach, to enable the Controller to meet its obligation to notify the Information Commissioner's Office (ICO) within 72 hours as required by Article 33 of the UK GDPR. The notification shall include the nature of the breach, categories of data and Data Subjects affected, likely consequences, and measures taken or proposed.`,
  },
  crossBorderTransfers: {
    title: 'International Data Transfers (UK GDPR Chapter V)',
    text: `The Processor shall not transfer personal data outside the United Kingdom unless an appropriate transfer mechanism is in place under Chapter V of the UK GDPR, including: (a) an adequacy regulation by the Secretary of State, (b) Standard Contractual Clauses (SCCs) as adopted by the UK, (c) Binding Corporate Rules, or (d) derogations under Article 49 for specific situations. The Controller must be notified in writing before any such transfer.`,
  },
}

// ── EU GDPR ────────────────────────────────────────────────────────────────
const EU_GDPR_CLAUSES = {
  dataSubjectRights: {
    title: 'Data Subject Rights (GDPR Articles 15-22)',
    text: `The Processor shall assist the Controller in fulfilling Data Subject rights under the EU General Data Protection Regulation (Regulation (EU) 2016/679), including the rights of access (Article 15), rectification (Article 16), erasure — "right to be forgotten" (Article 17), restriction of processing (Article 18), data portability (Article 20), objection (Article 21), and rights relating to automated decision-making and profiling (Article 22).`,
  },
  breachNotification: {
    title: 'Breach Notification (GDPR Article 33)',
    text: `In the event of a Personal Data Breach, the Processor shall notify the Controller without undue delay and in any case within 24 hours of becoming aware of the breach, to enable the Controller to meet its obligation to notify the relevant supervisory authority within 72 hours as required by Article 33 of the GDPR.`,
  },
  crossBorderTransfers: {
    title: 'International Data Transfers (GDPR Chapter V)',
    text: `The Processor shall not transfer personal data outside the European Economic Area (EEA) unless an appropriate transfer mechanism is in place under Chapter V of the GDPR, including: (a) an adequacy decision by the European Commission, (b) Standard Contractual Clauses (SCCs) adopted by the Commission, (c) Binding Corporate Rules, or (d) derogations under Article 49 for specific situations.`,
  },
}

// ── POPIA (South Africa) ───────────────────────────────────────────────────
const POPIA_CLAUSES = {
  dataSubjectRights: {
    title: 'Data Subject Rights (POPIA Section 5)',
    text: `The Processor shall assist the Operator (Controller equivalent) in fulfilling Data Subject rights under the Protection of Personal Information Act 4 of 2013 (POPIA), including the rights to: (a) be notified of what personal information is being collected, (b) access their personal information (Section 23), (c) request correction or deletion of inaccurate information (Section 24), and (d) object to processing (Section 11).`,
  },
  breachNotification: {
    title: 'Breach Notification (POPIA Section 22)',
    text: `In the event of a Personal Data Breach, the Processor shall notify the Operator without undue delay and in any case within 24 hours of becoming aware of the breach, to enable the Operator to meet its obligation to notify the Information Regulator and the Data Subject as soon as reasonably practicable under Section 22 of POPIA.`,
  },
}

// ── Kenya Data Protection Act 2019 ─────────────────────────────────────────
const KENYA_DPA_CLAUSES = {
  dataSubjectRights: {
    title: 'Data Subject Rights (Kenya DPA Section 26)',
    text: `The Processor shall assist the Data Controller in fulfilling Data Subject rights under the Kenya Data Protection Act 2019, including the right to be informed, access, rectification, erasure, restriction of processing, data portability, and objection to automated decision-making (Section 26).`,
  },
  breachNotification: {
    title: 'Breach Notification (Kenya DPA Section 43)',
    text: `In the event of a Personal Data Breach, the Processor shall notify the Data Controller without undue delay and in any case within 24 hours of becoming aware of the breach, to enable the Data Controller to meet its obligation to notify the Office of the Data Protection Commissioner (ODPC) within 72 hours as required by Section 43 of the Kenya Data Protection Act 2019.`,
  },
}

// ── Ghana Data Protection Act 2012 ─────────────────────────────────────────
const GHANA_DPA_CLAUSES = {
  dataSubjectRights: {
    title: 'Data Subject Rights (Ghana DPA 2012, Act 843)',
    text: `The Processor shall assist the Data Controller in fulfilling Data Subject rights under the Ghana Data Protection Act 2012 (Act 843), including the right to prevent processing likely to cause damage or distress, the right to access personal data, and the right to rectification of inaccurate data.`,
  },
}

// ── Clause registry ────────────────────────────────────────────────────────
const CLAUSE_REGISTRY = {
  'Nigeria — NDPA 2023': {
    regime: 'NDPA 2023',
    regulator: 'Nigeria Data Protection Commission (NDPC)',
    clauses: [
      NDPA_2023_CLAUSES.controllerProcessorRoles,
      NDPA_2023_CLAUSES.dataSubjectRights,
      NDPA_2023_CLAUSES.breachNotification,
      NDPA_2023_CLAUSES.crossBorderTransfers,
      NDPA_2023_CLAUSES.securityMeasures,
      NDPA_2023_CLAUSES.retentionDeletion,
      NDPA_2023_CLAUSES.gaidProvisions,
    ],
  },
  'United Kingdom — UK GDPR / DPA 2018': {
    regime: 'UK GDPR / DPA 2018',
    regulator: "Information Commissioner's Office (ICO)",
    clauses: [
      UK_GDPR_CLAUSES.dataSubjectRights,
      UK_GDPR_CLAUSES.breachNotification,
      UK_GDPR_CLAUSES.crossBorderTransfers,
    ],
  },
  'European Union — GDPR': {
    regime: 'EU GDPR',
    regulator: 'Relevant EU Supervisory Authority',
    clauses: [
      EU_GDPR_CLAUSES.dataSubjectRights,
      EU_GDPR_CLAUSES.breachNotification,
      EU_GDPR_CLAUSES.crossBorderTransfers,
    ],
  },
  'South Africa — POPIA': {
    regime: 'POPIA',
    regulator: 'Information Regulator (South Africa)',
    clauses: [
      POPIA_CLAUSES.dataSubjectRights,
      POPIA_CLAUSES.breachNotification,
    ],
  },
  'Kenya — Data Protection Act 2019': {
    regime: 'Kenya DPA 2019',
    regulator: 'Office of the Data Protection Commissioner (ODPC)',
    clauses: [
      KENYA_DPA_CLAUSES.dataSubjectRights,
      KENYA_DPA_CLAUSES.breachNotification,
    ],
  },
  'Ghana — Data Protection Act 2012': {
    regime: 'Ghana DPA 2012',
    regulator: 'Data Protection Commission (Ghana)',
    clauses: [
      GHANA_DPA_CLAUSES.dataSubjectRights,
    ],
  },
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Get jurisdiction-specific clauses for a DPA.
 * @param {string} jurisdiction - The governing law / data protection regime
 * @returns {{ regime: string, regulator: string, clauses: Array<{title: string, text: string}> }}
 */
export function getDpaClauses(jurisdiction) {
  return CLAUSE_REGISTRY[jurisdiction] || null
}

/**
 * Build a DPA system prompt that injects jurisdiction-specific clauses
 * and enforces plain-language clarity requirements.
 * @param {string} jurisdiction - The governing law / data protection regime
 * @returns {string} - The system prompt for the LLM
 */
export function buildDpaSystemPrompt(jurisdiction) {
  const regime = CLAUSE_REGISTRY[jurisdiction]

  const baseSystem = `You are an expert data protection legal drafter with deep knowledge of international privacy law, including the ${jurisdiction || 'applicable data protection regime'}. Generate a comprehensive, professional Data Processing Agreement (DPA) tailored precisely to the details provided.

Your DPA must:
1. Clearly distinguish between Data Controller and Data Processor responsibilities — use plain, actionable language, not just legal jargon.
2. Include specific, implementable obligations with clear "Who," "What," and "When" for each duty.
3. Be structured with clear numbered sections and subsections.
4. End cleanly after the signature block — no disclaimers, footnotes, or suggestions to consult a lawyer.
5. Use formal legal language but prioritise clarity over complexity — every obligation must be understandable by a business operator, not just a lawyer.`

  if (regime) {
    const clauseText = regime.clauses.map(c => `## ${c.title}\n${c.text}`).join('\n\n')
    return `${baseSystem}

The following jurisdiction-specific clauses MUST be included in the DPA. These are statutory requirements under ${jurisdiction} — do not omit, weaken, or generalise them:

${clauseText}

Integrate these clauses naturally into the DPA structure. Where the user has provided specific values (e.g., retention period, breach notification timeline), use those values. Where the user has not specified a value, use the statutory minimum or standard practice.`
  }

  return baseSystem
}

/**
 * Generate a "Key Obligations Summary" — a plain-language, 5-bullet
 * actionable checklist for the business operator. This is placed at the
 * top of the DPA before the formal legal text.
 * @param {object} fields - The DPA field values
 * @param {string} jurisdiction - The governing law
 * @returns {string} - The plain-language summary text
 */
export function buildKeyObligationsSummary(fields, jurisdiction) {
  const items = []

  if (fields.controllerName && fields.processorName) {
    items.push(`ROLE CLARIFICATION: ${fields.controllerName} is the Data Controller (you decide what data is collected and why). ${fields.processorName} is the Data Processor (they handle data on your instructions). Do not allow the Processor to use your data for their own purposes.`)
  }

  if (fields.breachNotificationHours || jurisdiction?.includes('Nigeria')) {
    items.push('BREACH NOTIFICATION: If the Processor experiences a data breach, they must notify you within 24 hours. You must then notify the regulator within 72 hours of becoming aware. Have an incident response plan ready — test it at least annually.')
  }

  if (fields.retentionPeriod) {
    items.push(`DATA RETENTION: Personal data must be deleted after ${fields.retentionPeriod}. Action: Configure your database retention policy and backup rotation schedule accordingly. Verify deletion procedures with the Processor before contract end.`)
  }

  if (fields.dataSubjects && fields.dataCategories) {
    items.push(`DATA SUBJECT RIGHTS: You must be able to respond to requests from ${fields.dataSubjects} regarding their data (${fields.dataCategories}). Set up a process for access requests, rectification, and erasure. Response deadline: 30 days (NDPA) / one month (GDPR).`)
  }

  if (fields.dataTransfers && !fields.dataTransfers.includes('No') && !fields.dataTransfers.includes('stays in-country')) {
    items.push('CROSS-BORDER TRANSFERS: Data is being transferred outside your jurisdiction. Verify that the destination country has adequate data protection laws or that Standard Contractual Clauses (SCCs) are in place. Document all transfer destinations.')
  }

  if (items.length < 5) {
    items.push('SECURITY: Ensure the Processor implements encryption (in transit and at rest), role-based access control, multi-factor authentication, and regular security audits. Request evidence of compliance annually.')
  }

  return `KEY OBLIGATIONS SUMMARY — READ BEFORE SIGNING\n${'═'.repeat(50)}\n\nThe following ${Math.min(items.length, 5)} duties require your immediate attention. This is not legal advice — these are the operational actions you must take to comply with this DPA.\n\n${items.slice(0, 5).map((item, i) => `${i + 1}. ${item}`).join('\n\n')}\n\n${'═'.repeat(50)}\n\nEND OF KEY OBLIGATIONS SUMMARY\n${'═'.repeat(50)}`
}

/**
 * Generate a Data Flow Mapping Template for operational implementability.
 * @param {object} fields - The DPA field values
 * @returns {string} - The data flow mapping template
 */
export function buildDataFlowMappingTemplate(fields) {
  return `DATA FLOW MAPPING TEMPLATE\n${'═'.repeat(50)}\n\nComplete this mapping to align your actual data flows with the contract terms above. This bridges the gap between "paper compliance" and "operational reality."\n\n${'─'.repeat(50)}\n\nSYSTEM / APPLICATION MAPPING\n${'─'.repeat(50)}\n\nFor each system that processes personal data described in this DPA, complete the following:\n\n1. CRM / Customer Database\n   - System name: ___________________\n   - Data stored: ${fields.dataCategories || '[list data categories]'}\n   - Access: Who has access? ___________________\n   - Retention: How long is data kept? ${fields.retentionPeriod || '[specify]'}\n   - Deletion: How is data deleted? ___________________\n   - Cross-border: Is data transferred outside ${fields.jurisdiction?.split(' — ')[0] || 'your country'}? ___________________\n\n2. Cloud Storage (Google Drive, AWS, Azure, etc.)\n   - Provider: ___________________\n   - Data stored: ___________________\n   - Encryption: At rest? [ ] Yes [ ] No | In transit? [ ] Yes [ ] No\n   - Access controls: MFA enabled? [ ] Yes [ ] No\n   - Sub-processors: List all sub-processors: ___________________\n\n3. Email / Marketing Platform\n   - Platform: ___________________\n   - Consent basis: [ ] Explicit consent [ ] Legitimate interest [ ] Contract performance\n   - Opt-out mechanism: ___________________\n   - Data sharing with third parties: ___________________\n\n4. HR / Payroll System\n   - System: ___________________\n   - Employee data stored: ___________________\n   - Special category data (health, biometric): ___________________\n   - Access: Who has access? ___________________\n\n5. Payment / Billing System\n   - Provider: ___________________\n   - Payment data stored: [ ] Yes [ ] No\n   - PCI-DSS compliant? [ ] Yes [ ] No [ ] N/A\n\n${'─'.repeat(50)}\n\nACCESS CONTROL REVIEW\n${'─'.repeat(50)}\n\n- [ ] Review all IAM roles for "Confidential Data" tag\n- [ ] Verify MFA is enforced for all accounts with data access\n- [ ] Remove access for departed employees and contractors\n- [ ] Document emergency access procedures\n\n${'─'.repeat(50)}\n\nINCIDENT RESPONSE READINESS\n${'─'.repeat(50)}\n\n- [ ] Incident response plan documented and accessible\n- [ ] Contact list: DPO ${fields.dpoContact || '[specify]'}, Processor contact ___________________\n- [ ] Breach notification template prepared (24h to Controller, 72h to Regulator)\n- [ ] Last tabletop exercise date: ___________________\n- [ ] Next scheduled exercise: ___________________\n\n${'═'.repeat(50)}\n\nEND OF DATA FLOW MAPPING TEMPLATE\n${'═'.repeat(50)}`
}
