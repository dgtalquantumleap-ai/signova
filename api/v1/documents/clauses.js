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

// ── Canada PIPEDA (Personal Information Protection and Electronic Documents Act) ──
// Federal private-sector privacy law applying to commercial activities across Canada
// (except where substantially similar provincial legislation applies — e.g. Alberta PIPA,
// BC PIPA, Quebec Law 25). Enforced by the Office of the Privacy Commissioner of Canada (OPC).
const PIPEDA_CLAUSES = {
  dataSubjectRights: {
    title: 'Individual Rights under PIPEDA (Principles 4.9 & 4.10)',
    text: `The Processor shall assist the Controller in fulfilling individual rights under the Personal Information Protection and Electronic Documents Act (PIPEDA), including:
(a) Right of Access (Principle 4.9): Upon written request, an individual shall be informed of the existence, use, and disclosure of their personal information and shall be given access to that information within 30 days, subject to limited exceptions.
(b) Right of Correction (Principle 4.9.5): Individuals may challenge the accuracy and completeness of their personal information and have it amended as appropriate.
(c) Right to Withdraw Consent (Principle 4.3.8): Individuals may withdraw consent at any time, subject to legal or contractual restrictions and reasonable notice.
(d) Right to Challenge Compliance (Principle 4.10): Individuals may challenge an organisation's compliance with PIPEDA by directing complaints to the designated privacy officer.

The Processor shall implement technical and organisational measures to enable the Controller to respond to such requests within the statutory 30-day timeframe.`,
  },
  breachNotification: {
    title: 'Breach of Security Safeguards — Reporting & Notification (PIPEDA s.10.1)',
    text: `In the event of a breach of security safeguards involving personal information under the Processor's control that creates a real risk of significant harm (RROSH) to an individual, the Processor shall:
(a) Notify the Controller without undue delay and in any case within 24 hours of becoming aware of the breach, to enable the Controller to meet its statutory obligations under section 10.1 of PIPEDA.
(b) Provide sufficient information for the Controller to report the breach to the Office of the Privacy Commissioner of Canada (OPC) "as soon as feasible" using the OPC's prescribed form.
(c) Assist the Controller in notifying affected individuals "as soon as feasible" where there is a real risk of significant harm, and in notifying any other organisation or government institution that may be able to reduce the risk of harm.
(d) Maintain a record of every breach of security safeguards for a minimum of 24 months from the date the organisation determined the breach occurred, as required by section 10.3 of PIPEDA.`,
  },
  crossBorderTransfers: {
    title: 'Cross-Border Transfers & Accountability (PIPEDA Principle 4.1.3)',
    text: `Where personal information is transferred to a third party (including a sub-processor) for processing — whether inside or outside Canada — the Processor remains accountable under Principle 4.1.3 of PIPEDA. The Processor shall:
(a) Use contractual or other means to provide a comparable level of protection while the information is being processed by a third party.
(b) Inform the Controller in writing of all jurisdictions in which personal information may be stored, processed, or accessed, so the Controller can provide appropriate notice to individuals.
(c) Where information is transferred outside Canada, notify individuals (via the Controller) that their information may be accessible to foreign governments pursuant to lawful access requests, in accordance with OPC guidance on trans-border data flows.
(d) For transfers involving Quebec residents, comply with the additional impact-assessment requirements under Quebec Law 25 (see separate clause if applicable).`,
  },
  consentAccountability: {
    title: 'Meaningful Consent & Accountability (PIPEDA Principles 4.1 & 4.3)',
    text: `The Controller shall obtain meaningful consent from individuals in accordance with PIPEDA Principle 4.3 and the OPC's Guidelines for Obtaining Meaningful Consent, ensuring individuals understand (i) what personal information is being collected, (ii) with whom it is being shared, (iii) for what purposes, and (iv) the risk of harm and other consequences.

The Processor shall process personal information only on documented instructions from the Controller and only for purposes consistent with the consent obtained. The Controller shall designate an individual accountable for compliance (Chief Privacy Officer or equivalent) pursuant to Principle 4.1.`,
  },
}

// ── Quebec Law 25 (Act to modernize legislative provisions as regards the protection
// of personal information, formerly Bill 64) — applies to organisations operating in Quebec.
// Significantly stricter than PIPEDA; often described as Canada's GDPR.
const QUEBEC_LAW25_CLAUSES = {
  dataSubjectRights: {
    title: 'Rights of Data Subjects under Quebec Law 25',
    text: `The Processor shall assist the Controller in fulfilling the enhanced individual rights under the Act respecting the protection of personal information in the private sector (as amended by Law 25), including:
(a) Right to Access and Rectification (ss. 27, 28): Response within 30 days of receipt of a written request, free of charge.
(b) Right to Data Portability (s. 27, in force since September 22, 2024): Individuals may obtain their computerised personal information in a structured, commonly used technological format, and may require its transfer to any person or body authorised to receive it.
(c) Right to De-indexing / Right to be Forgotten (s. 28.1): Individuals may require that a hyperlink giving access to their personal information be de-indexed where dissemination causes serious prejudice that outweighs the public interest.
(d) Right Regarding Automated Decision-Making (s. 12.1): Where a decision is based exclusively on automated processing, individuals must be informed and may submit observations to have the decision reviewed by a natural person.
(e) Right to be Informed (s. 8): Individuals must be informed of the purposes, categories of persons having access, retention period, and rights of access and rectification at the time of collection.`,
  },
  breachNotification: {
    title: 'Confidentiality Incident Notification (Quebec Law 25, s. 3.5–3.8)',
    text: `In the event of a "confidentiality incident" (any unauthorised access, use, communication, loss, or other breach of personal information), the Processor shall:
(a) Notify the Controller without undue delay and in any case within 24 hours of becoming aware of the incident.
(b) Assist the Controller in assessing whether the incident presents a "risk of serious injury" taking into account the sensitivity of the information, anticipated consequences of its use, and the likelihood that it will be used for injurious purposes.
(c) Where a risk of serious injury exists, enable the Controller to notify (i) the Commission d'accès à l'information du Québec (CAI) and (ii) the affected individuals with "diligence."
(d) Maintain a register of confidentiality incidents and provide it to the CAI upon request, pursuant to section 3.8 of the Act.`,
  },
  crossBorderTransfers: {
    title: 'Communication Outside Quebec — Privacy Impact Assessment (s. 17)',
    text: `Before communicating personal information outside the Province of Quebec (including to other Canadian provinces and to foreign jurisdictions), the Controller must conduct a Privacy Impact Assessment (PIA) pursuant to section 17 of Quebec Law 25. The Processor shall assist the Controller by providing:
(a) The name and location of all recipients and sub-processors that will access the information outside Quebec.
(b) The legal regime applicable in each destination, including adequacy assessments.
(c) Technical, contractual, and organisational safeguards in place to protect the information during and after transfer.
(d) The means by which individuals may exercise their rights from outside Quebec.

The communication outside Quebec is permitted only if the PIA concludes that the information would receive adequate protection, in particular having regard to generally accepted data protection principles.`,
  },
  privacyByDesign: {
    title: 'Privacy by Default & Technological Product Configuration (s. 9.1)',
    text: `Where the Processor provides a technological product or service to the Controller that involves the collection of personal information, the Processor shall ensure that the default parameters provide the highest level of confidentiality, without any intervention by the individual (Privacy by Default — section 9.1 of Law 25). Any deviation from this default requires express, informed, and granular opt-in consent from the individual.`,
  },
}

// ── USA — CCPA/CPRA (California Consumer Privacy Act as amended by the California
// Privacy Rights Act) — the de facto baseline for US commercial privacy practice.
// Includes references to aligned state laws (Virginia VCDPA, Colorado CPA, Connecticut CTDPA,
// Utah UCPA, Texas TDPSA) where applicable. Enforced by the California Privacy Protection Agency (CPPA).
const CCPA_CPRA_CLAUSES = {
  dataSubjectRights: {
    title: 'Consumer Rights under the CCPA/CPRA (Cal. Civ. Code §§ 1798.100–1798.199.100)',
    text: `The Processor (acting as a "Service Provider" or "Contractor" as defined at Cal. Civ. Code § 1798.140) shall assist the Business (Controller) in fulfilling consumer rights under the CCPA as amended by the CPRA, including:
(a) Right to Know (§ 1798.100 / § 1798.110): The categories and specific pieces of personal information collected, categories of sources, business or commercial purpose, and categories of third parties with whom information is shared, for the preceding 12 months (and upon request, beyond 12 months where collected on or after January 1, 2022).
(b) Right to Delete (§ 1798.105): Deletion of personal information within 45 days of a verifiable consumer request, subject to statutory exceptions.
(c) Right to Correct (§ 1798.106, added by CPRA): Correction of inaccurate personal information maintained about the consumer.
(d) Right to Opt Out of Sale or Sharing (§ 1798.120): Including a conspicuous "Do Not Sell or Share My Personal Information" link and honouring the Global Privacy Control (GPC) signal.
(e) Right to Limit Use of Sensitive Personal Information (§ 1798.121): Including a "Limit the Use of My Sensitive Personal Information" link.
(f) Right to Non-Discrimination (§ 1798.125): The Business shall not discriminate against consumers for exercising their rights.
(g) Right to Data Portability (§ 1798.100(d)): Personal information provided in a portable and, to the extent technically feasible, readily usable format.

The Processor shall respond to Business-forwarded requests within 15 business days and shall not sell, share, or retain personal information outside the scope of the written contract required under § 1798.140(ag)(1).`,
  },
  breachNotification: {
    title: 'Security Breach Notification (Cal. Civ. Code § 1798.82; aligned state statutes)',
    text: `In the event of a breach of the security of the system involving unauthorised acquisition of unencrypted personal information (or encrypted personal information together with the encryption key), the Processor shall:
(a) Notify the Business (Controller) without undue delay and in any case within 24 hours of discovery to enable the Business to meet its obligation under Cal. Civ. Code § 1798.82 to notify affected California residents "in the most expedient time possible and without unreasonable delay."
(b) Provide all information required for the Business to satisfy the content requirements of § 1798.82(d), including: the date or estimated date of the breach, the types of personal information involved, toll-free telephone numbers and addresses of the major consumer credit reporting agencies (where Social Security numbers, driver's license numbers, or California identification card numbers are involved), and advice to report suspected identity theft.
(c) Where the breach affects more than 500 California residents, provide the Business with information necessary to submit the required electronic sample notification to the California Attorney General.
(d) Provide analogous cooperation for breaches affecting residents of other states with aligned breach-notification statutes (e.g., N.Y. Gen. Bus. Law § 899-aa, Tex. Bus. & Com. Code § 521.053, Va. Code § 18.2-186.6, Fla. Stat. § 501.171), which generally require notification within 30–60 days.`,
  },
  crossBorderAndVendor: {
    title: 'Service Provider / Contractor Obligations (Cal. Civ. Code § 1798.140 & CCPA Regs. § 7051)',
    text: `The Processor is engaged as a "Service Provider" (or "Contractor") within the meaning of Cal. Civ. Code § 1798.140 and California Code of Regulations § 7051. The Processor shall:
(a) Process personal information only for the limited and specified business purposes set out in this Agreement.
(b) NOT sell or share personal information (as those terms are defined by the CCPA/CPRA).
(c) NOT retain, use, or disclose personal information for any purpose other than the business purposes specified in the Agreement, including NOT retaining, using, or disclosing personal information for a "commercial purpose" outside the direct business relationship.
(d) NOT combine personal information received from the Business with personal information received from other sources, except as permitted by regulation.
(e) Comply with applicable CCPA/CPRA obligations and provide the same level of privacy protection as required of the Business.
(f) Notify the Business within 5 business days if it determines it can no longer meet its obligations under the CCPA/CPRA.
(g) Grant the Business the right, upon notice, to take reasonable and appropriate steps to stop and remediate unauthorised use of personal information.
(h) Certify in writing that it understands and will comply with the restrictions in this clause.`,
  },
  sensitiveInformation: {
    title: 'Sensitive Personal Information — Heightened Restrictions (§ 1798.121)',
    text: `Where the Processor handles "Sensitive Personal Information" as defined at Cal. Civ. Code § 1798.140(ae) — including Social Security numbers, driver's license numbers, financial account credentials, precise geolocation, racial or ethnic origin, religious or philosophical beliefs, union membership, contents of private communications, genetic data, biometric information for identification, health information, and sexual orientation/sex life information — the Processor shall:
(a) Process such information only for the purposes enumerated in § 1798.121(a) and CCPA Regulations § 7027 (providing the requested goods/services, preventing fraud, ensuring security and integrity, short-term transient use, performing services, verifying/maintaining quality, or as otherwise expressly permitted).
(b) Honour any consumer "Limit the Use of My Sensitive Personal Information" request forwarded by the Business.
(c) Apply heightened technical safeguards including encryption at rest and in transit, strict access controls, and audit logging.`,
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
  'Canada — PIPEDA': {
    regime: 'PIPEDA (Personal Information Protection and Electronic Documents Act)',
    regulator: 'Office of the Privacy Commissioner of Canada (OPC)',
    clauses: [
      PIPEDA_CLAUSES.consentAccountability,
      PIPEDA_CLAUSES.dataSubjectRights,
      PIPEDA_CLAUSES.breachNotification,
      PIPEDA_CLAUSES.crossBorderTransfers,
    ],
  },
  'Canada — Quebec Law 25': {
    regime: 'Quebec Law 25 (Act respecting the protection of personal information in the private sector, as amended)',
    regulator: "Commission d'accès à l'information du Québec (CAI)",
    clauses: [
      QUEBEC_LAW25_CLAUSES.dataSubjectRights,
      QUEBEC_LAW25_CLAUSES.breachNotification,
      QUEBEC_LAW25_CLAUSES.crossBorderTransfers,
      QUEBEC_LAW25_CLAUSES.privacyByDesign,
    ],
  },
  'United States — CCPA/CPRA': {
    regime: 'CCPA/CPRA (California Consumer Privacy Act, as amended by the California Privacy Rights Act)',
    regulator: 'California Privacy Protection Agency (CPPA) & California Attorney General',
    clauses: [
      CCPA_CPRA_CLAUSES.crossBorderAndVendor,
      CCPA_CPRA_CLAUSES.dataSubjectRights,
      CCPA_CPRA_CLAUSES.sensitiveInformation,
      CCPA_CPRA_CLAUSES.breachNotification,
    ],
  },
  // FIX 2 — Commonwealth fallback for jurisdictions without a dedicated
  // privacy statute library. Used when none of the explicit jurisdictions
  // above match. Generic baseline acknowledging there is no specific named
  // statute, with the universal data-protection principles every modern
  // regime shares.
  'Commonwealth common-law privacy baseline': {
    regime: 'Commonwealth common-law privacy baseline (no dedicated statute library)',
    regulator: 'the data-protection authority of the specified jurisdiction',
    clauses: [
      {
        title: 'Lawful basis for processing',
        text: 'The Processor shall only process Personal Data on the documented instructions of the Controller, and only on a lawful basis under the applicable data protection law of the governing jurisdiction (typically: consent, contract performance, legal obligation, vital interest, public task, or legitimate interest, subject to balancing against data-subject rights).',
      },
      {
        title: 'Security obligations',
        text: 'The Processor shall implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk, including encryption of Personal Data in transit and at rest, regular testing of security controls, and personnel training. The measures shall meet at minimum the recognised standards of the data-protection authority of the jurisdiction (typically aligned with ISO 27001 / NIST controls).',
      },
      {
        title: 'Breach notification',
        text: 'The Processor shall notify the Controller without undue delay (and in any case within 72 hours where the relevant law so requires, e.g. UK GDPR Art. 33 or NDPA 2023 s.41) after becoming aware of a Personal Data breach. The notification shall include the nature of the breach, categories and approximate number of data subjects and records affected, likely consequences, and measures taken or proposed to address the breach.',
      },
      {
        title: 'Cross-border transfers',
        text: 'The Processor shall not transfer Personal Data to any country or international organisation outside the originating jurisdiction without ensuring adequate safeguards, including (a) an adequacy determination by the data-protection authority where available, (b) appropriate transfer mechanisms (Standard Contractual Clauses, Binding Corporate Rules, or equivalent), (c) the data subject\'s explicit consent after being informed of the risks, or (d) other lawful exceptions narrowly construed.',
      },
      {
        title: 'Data subject rights',
        text: 'The Processor shall assist the Controller in fulfilling data subject requests for access, rectification, erasure, restriction, portability, and objection, as recognised by the applicable law of the governing jurisdiction. The Processor shall implement appropriate technical measures to enable the Controller to respond to such requests within statutory deadlines (typically 30 days, extendable to 60 or 90 in complex cases).',
      },
      {
        title: 'Sub-processors',
        text: 'The Processor shall not engage any sub-processor without the prior written authorisation of the Controller (general or specific). Where general authorisation is given, the Processor shall inform the Controller of intended changes and provide opportunity to object. Sub-processors shall be bound by written agreement to the same data-protection obligations.',
      },
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
