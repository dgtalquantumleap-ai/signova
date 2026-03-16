import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import './Generator.css'

const SEO_META = {
  'privacy-policy': {
    title: 'Free Privacy Policy Generator | Create a Privacy Policy in 2 Minutes — Signova',
    description: 'Generate a professional privacy policy for your website or app instantly. GDPR, NDPR, PIPEDA and CCPA compliant. Free preview, download for $4.99.',
    keywords: 'privacy policy generator, free privacy policy, GDPR privacy policy, NDPR privacy policy, website privacy policy template, app privacy policy',
  },
  'terms-of-service': {
    title: 'Free Terms of Service Generator | Terms & Conditions Template — Signova',
    description: 'Create professional terms of service for your website, app or SaaS in minutes. Covers subscriptions, user conduct, disclaimers and governing law. Free preview.',
    keywords: 'terms of service generator, terms and conditions template, website terms of service, SaaS terms of service, free terms of service',
  },
  'nda': {
    title: 'Free NDA Generator | Non-Disclosure Agreement Template — Signova',
    description: 'Generate a legally sound Non-Disclosure Agreement (NDA) in under 3 minutes. Mutual and one-way NDA templates. Free preview, download for $4.99.',
    keywords: 'NDA generator, non-disclosure agreement template, free NDA, mutual NDA, confidentiality agreement, NDA Nigeria, NDA template',
  },
  'freelance-contract': {
    title: 'Free Freelance Contract Generator | Client Contract Template — Signova',
    description: 'Create a professional freelance contract with deliverables, payment terms, IP ownership and dispute resolution. Used by freelancers in Nigeria, UK, US and Canada.',
    keywords: 'freelance contract template, freelance contract generator, client contract, freelancer agreement, freelance payment terms, Nigeria freelance contract',
  },
  'independent-contractor': {
    title: 'Independent Contractor Agreement Template | Free Generator — Signova',
    description: 'Generate an independent contractor agreement that clearly defines the working relationship, compensation, IP rights and termination terms. Free preview.',
    keywords: 'independent contractor agreement, contractor agreement template, 1099 contractor agreement, contractor vs employee, Nigeria contractor agreement',
  },
  'hire-purchase': {
    title: 'Hire Purchase Agreement Template Nigeria | Asset Finance Contract — Signova',
    description: 'Generate a hire purchase or asset financing agreement for vehicles, equipment and machinery. Covers instalments, interest, ownership transfer and default. Nigeria, Ghana, Kenya.',
    keywords: 'hire purchase agreement Nigeria, asset finance agreement, hire purchase template, equipment financing agreement, vehicle hire purchase Nigeria',
  },
  'tenancy-agreement': {
    title: 'Tenancy Agreement Template Nigeria | Rental Contract Generator — Signova',
    description: 'Generate a professional tenancy agreement for residential or commercial property in Nigeria, Ghana, Kenya and the UK. Covers rent, deposit, utilities and restrictions.',
    keywords: 'tenancy agreement Nigeria, rental agreement template, tenancy agreement Lagos, tenancy agreement Ghana, landlord tenant agreement, rent agreement template',
  },
  'quit-notice': {
    title: 'Quit Notice Template Nigeria | Notice to Vacate Generator — Signova',
    description: 'Generate a legally valid quit notice to vacate property in Nigeria. Covers expired tenancy, non-payment of rent and breach of terms. Instant download.',
    keywords: 'quit notice Nigeria, notice to vacate template, quit notice Lagos, tenant eviction notice Nigeria, quit notice letter',
  },
  'deed-of-assignment': {
    title: 'Deed of Assignment Nigeria | Property Transfer Document — Signova',
    description: 'Generate a Deed of Assignment for property transfer in Nigeria. Covers C of O, purchase price, title documents and parties. Important: must be stamped at Stamp Duties Office.',
    keywords: 'deed of assignment Nigeria, deed of assignment Lagos, property transfer Nigeria, deed of assignment template, Lagos land registry',
  },
  'power-of-attorney': {
    title: 'Power of Attorney Template | Free Generator Nigeria & Global — Signova',
    description: 'Generate a Power of Attorney authorising someone to act on your behalf for property, financial or legal matters. Covers Nigeria, UK, Canada, UAE and more.',
    keywords: 'power of attorney Nigeria, power of attorney template, POA generator, general power of attorney, property power of attorney Nigeria',
  },
  'landlord-agent-agreement': {
    title: 'Landlord and Agent Agreement Nigeria | Property Management Contract — Signova',
    description: 'Generate a landlord and estate agent agreement covering commission, tenant sourcing, rent collection and property management duties. Nigeria, Ghana, Kenya.',
    keywords: 'landlord agent agreement Nigeria, estate agent agreement, property management agreement Nigeria, real estate agent contract Nigeria',
  },
  'facility-manager-agreement': {
    title: 'Facility Management Agreement Template | FM Contract Generator — Signova',
    description: 'Create a facility manager agreement covering maintenance, security, cleaning, HVAC and vendor management. For commercial property owners in Nigeria and across Africa.',
    keywords: 'facility management agreement, facility manager contract, FM agreement Nigeria, property maintenance contract, facility management Nigeria',
  },
  'service-agreement': {
    title: 'Service Agreement Template | Free Service Contract Generator — Signova',
    description: 'Generate a professional service agreement defining scope, fees, IP ownership and payment terms. For service providers in Nigeria, India, Philippines, UAE and globally.',
    keywords: 'service agreement template, service contract generator, service agreement Nigeria, service agreement India, business service contract, service provider agreement',
  },
  'consulting-agreement': {
    title: 'Consulting Agreement Template | Free Consultant Contract — Signova',
    description: 'Generate a consulting agreement covering scope, rate, exclusivity and IP rights. Used by consultants and advisory firms across Africa, Asia and North America.',
    keywords: 'consulting agreement template, consultant contract, consulting agreement Nigeria, consulting agreement India, advisory agreement, management consulting contract',
  },
  'employment-offer-letter': {
    title: 'Employment Offer Letter Template | Free Job Offer Letter Generator — Signova',
    description: 'Generate a professional employment offer letter with salary, benefits, start date and notice period. For employers in Nigeria, Ghana, India, UK, Canada and globally.',
    keywords: 'employment offer letter template, job offer letter, offer letter generator, employment letter Nigeria, job offer letter India, offer letter template',
  },
  'non-compete-agreement': {
    title: 'Non-Compete Agreement Template | Free Non-Compete Generator — Signova',
    description: 'Generate a non-compete agreement restricting employees from working with competitors. Covers restricted activities, duration and geographic scope. Globally applicable.',
    keywords: 'non-compete agreement template, non-compete clause, non-compete agreement Nigeria, employee non-compete, non-solicitation agreement, non-compete generator',
  },
  'payment-terms-agreement': {
    title: 'Payment Terms Agreement Template | Debt Repayment Schedule — Signova',
    description: 'Generate a payment terms agreement documenting repayment schedules, late penalties and due dates between buyer and seller. For businesses in Nigeria, Africa and globally.',
    keywords: 'payment terms agreement, payment schedule template, debt repayment agreement, payment plan agreement Nigeria, invoice payment terms, payment agreement template',
  },
  'business-partnership': {
    title: 'Business Partnership Agreement Nigeria | Partner Contract Generator — Signova',
    description: 'Generate a business partnership agreement covering capital contribution, profit sharing, decision-making and exit terms. For Nigerian and African business partners.',
    keywords: 'business partnership agreement Nigeria, partnership agreement template, partner agreement, profit sharing agreement Nigeria, small business partnership agreement',
  },
  'joint-venture': {
    title: 'Joint Venture Agreement Template | JV Contract Generator — Signova',
    description: 'Generate a joint venture agreement for two companies collaborating on a specific project. Covers ownership, management, profit sharing and duration. Nigeria, Africa, globally.',
    keywords: 'joint venture agreement template, JV agreement Nigeria, joint venture contract, joint venture Africa, business collaboration agreement',
  },
  'loan-agreement': {
    title: 'Loan Agreement Template Nigeria | Personal & Business Loan Contract — Signova',
    description: 'Generate a loan agreement for personal or business lending. Covers loan amount, interest rate, repayment schedule and collateral. Nigeria, India, Philippines and globally.',
    keywords: 'loan agreement template Nigeria, personal loan agreement, business loan contract, loan repayment agreement, loan agreement India, money lending agreement Nigeria',
  },
  'shareholder-agreement': {
    title: 'Shareholder Agreement Template | Startup Equity Contract — Signova',
    description: 'Generate a shareholder agreement covering dividends, voting rights, share transfers, drag-along and tag-along rights. For startups and companies in Nigeria and globally.',
    keywords: 'shareholder agreement template, shareholder agreement Nigeria, startup shareholder agreement, equity agreement, share subscription agreement, investor rights agreement',
  },
  'mou': {
    title: 'MOU Template | Memorandum of Understanding Generator — Signova',
    description: 'Generate a Memorandum of Understanding (MOU) for government, NGO, business and academic partnerships. Binding and non-binding options. Global coverage.',
    keywords: 'MOU template, memorandum of understanding template, MOU Nigeria, MOU India, MOU generator, partnership MOU, non-binding MOU, MOU agreement',
  },
  'letter-of-intent': {
    title: 'Letter of Intent Template | LOI Generator for Business & Property — Signova',
    description: 'Generate a Letter of Intent (LOI) for acquisitions, investments, partnerships and property leases. Covers proposed value, exclusivity and timeline. Global.',
    keywords: 'letter of intent template, LOI template, letter of intent acquisition, letter of intent investment, LOI real estate, letter of intent Nigeria, LOI generator',
  },
  'distribution-agreement': {
    title: 'Distribution Agreement Template | Reseller Contract Generator — Signova',
    description: 'Generate a distribution or reseller agreement covering territory, exclusivity, margins and minimum purchase commitments. For Africa, Asia and global supply chains.',
    keywords: 'distribution agreement template, reseller agreement, distributor contract Nigeria, distribution agreement Africa, exclusive distribution agreement, reseller contract',
  },
  'supply-agreement': {
    title: 'Supply Agreement Template | Supplier Contract Generator — Signova',
    description: 'Generate a supply agreement between supplier and buyer covering pricing, delivery schedule, quality standards and volume commitments. Nigeria, India, Asia, global.',
    keywords: 'supply agreement template, supplier contract, supply agreement Nigeria, goods supply agreement, supply chain contract, procurement agreement, supplier agreement India',
  },
  'business-proposal': {
    title: 'Business Proposal Template | Professional Proposal Generator — Signova',
    description: 'Generate a winning business proposal with problem statement, solution, deliverables, timeline and pricing. Used by consultants and businesses across Africa and globally.',
    keywords: 'business proposal template, proposal generator, business proposal Nigeria, consulting proposal template, project proposal, business proposal Africa, RFP response template',
  },
  'purchase-agreement': {
    title: 'Purchase Agreement Template | Sale of Goods Contract Generator — Signova',
    description: 'Generate a purchase agreement for buying or selling goods, assets or property. Covers price, delivery, warranty and condition. Global coverage.',
    keywords: 'purchase agreement template, sale of goods contract, purchase and sale agreement, asset purchase agreement, goods sale contract Nigeria, bill of sale template',
  },
}

const DOC_CONFIG = {
  'privacy-policy': {
    name: 'Privacy Policy',
    icon: '🔒',
    fields: [
      { id: 'company', label: 'Company / App name', type: 'text', placeholder: 'e.g. Acme Inc.' },
      { id: 'website', label: 'Website or app URL', type: 'text', placeholder: 'e.g. https://acme.com' },
      { id: 'country', label: 'Country of operation', type: 'select', options: ['United States', 'Canada', 'United Kingdom', 'Australia', 'European Union', 'Nigeria', 'South Africa', 'Kenya', 'Ghana', 'Egypt', 'Brazil', 'Colombia', 'Mexico', 'Argentina', 'India', 'Singapore', 'UAE', 'Other'] },
      { id: 'dataCollected', label: 'What data do you collect?', type: 'checkbox', options: ['Name', 'Email address', 'Phone number', 'Location data', 'Payment information', 'Usage analytics', 'Cookies', 'Device identifiers'] },
      { id: 'thirdParties', label: 'Third-party services used', type: 'checkbox', options: ['Google Analytics', 'Stripe / payments', 'Facebook / Meta', 'Apple / iOS', 'Supabase', 'Firebase', 'Mailchimp', 'RevenueCat'] },
      { id: 'contact', label: 'Contact email for privacy queries', type: 'text', placeholder: 'e.g. privacy@acme.com' },
    ],
  },
  'terms-of-service': {
    name: 'Terms of Service',
    icon: '📋',
    fields: [
      { id: 'company', label: 'Company / App name', type: 'text', placeholder: 'e.g. Acme Inc.' },
      { id: 'website', label: 'Website or app URL', type: 'text', placeholder: 'e.g. https://acme.com' },
      { id: 'country', label: 'Governing law (country/state)', type: 'select', options: ['United States — California', 'United States — Delaware', 'United States — New York', 'Canada — Ontario', 'United Kingdom', 'Australia', 'European Union', 'Nigeria', 'South Africa', 'Kenya', 'Ghana', 'Egypt', 'Brazil', 'Colombia', 'Mexico', 'Argentina', 'India', 'Singapore', 'UAE', 'Other'] },
      { id: 'serviceType', label: 'What does your service do?', type: 'textarea', placeholder: 'e.g. A mobile app for household management that helps families track tasks, meals and expenses.' },
      { id: 'hasSubscription', label: 'Do you offer paid subscriptions?', type: 'radio', options: ['Yes', 'No'] },
      { id: 'contact', label: 'Contact email', type: 'text', placeholder: 'e.g. legal@acme.com' },
    ],
  },
  'nda': {
    name: 'Non-Disclosure Agreement',
    icon: '🤝',
    fields: [
      { id: 'disclosingParty', label: 'Disclosing party (your company)', type: 'text', placeholder: 'e.g. Acme Inc.' },
      { id: 'receivingParty', label: 'Receiving party (who you\'re sharing with)', type: 'text', placeholder: 'e.g. John Smith / XYZ Consulting' },
      { id: 'purpose', label: 'Purpose of disclosure', type: 'textarea', placeholder: 'e.g. Discussing a potential partnership to develop a mobile application.' },
      { id: 'duration', label: 'Duration of confidentiality', type: 'select', options: ['1 year', '2 years', '3 years', '5 years', 'Indefinite'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['United States — California', 'United States — New York', 'Canada — Ontario', 'United Kingdom', 'Australia', 'Nigeria', 'South Africa', 'Kenya', 'Ghana', 'Egypt', 'Brazil', 'Colombia', 'Mexico', 'Argentina', 'India', 'Singapore', 'UAE', 'Other'] },
      { id: 'mutual', label: 'Is this mutual (both parties bound)?', type: 'radio', options: ['Yes — mutual NDA', 'No — one-way only'] },
    ],
  },
  'freelance-contract': {
    name: 'Freelance Contract',
    icon: '✍️',
    fields: [
      { id: 'freelancer', label: 'Your name / company', type: 'text', placeholder: 'e.g. Jane Smith / Jane Smith Design' },
      { id: 'client', label: 'Client name / company', type: 'text', placeholder: 'e.g. Acme Inc.' },
      { id: 'services', label: 'Services you are providing', type: 'textarea', placeholder: 'e.g. UI/UX design for a mobile app, including wireframes, prototypes and final design assets.' },
      { id: 'rate', label: 'Payment rate', type: 'text', placeholder: 'e.g. $75/hour or $2,500 flat fee' },
      { id: 'paymentTerms', label: 'Payment terms', type: 'select', options: ['Net 7 (7 days)', 'Net 14 (14 days)', 'Net 30 (30 days)', '50% upfront, 50% on completion', '100% upfront'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['United States — California', 'United States — New York', 'Canada — Ontario', 'United Kingdom', 'Australia', 'Nigeria', 'South Africa', 'Kenya', 'Ghana', 'Egypt', 'Brazil', 'Colombia', 'Mexico', 'Argentina', 'India', 'Singapore', 'UAE', 'Other'] },
      { id: 'ipOwnership', label: 'Who owns the work product?', type: 'radio', options: ['Client owns all work product', 'Freelancer retains ownership until paid in full', 'Shared ownership'] },
    ],
  },
  'service-agreement': {
    name: 'Service Agreement',
    icon: '📝',
    fields: [
      { id: 'provider', label: 'Service provider name / company', type: 'text', placeholder: 'e.g. Bright Solutions Ltd. / Amara Consulting' },
      { id: 'client', label: 'Client name / company', type: 'text', placeholder: 'e.g. Zenith Corp / Mr. Kwame Mensah' },
      { id: 'services', label: 'Description of services', type: 'textarea', placeholder: 'e.g. Website design, development and launch for a 5-page business website including hosting setup.' },
      { id: 'fee', label: 'Service fee / rate', type: 'text', placeholder: 'e.g. $2,000 flat fee or ₦150,000/month' },
      { id: 'paymentTerms', label: 'Payment terms', type: 'select', options: ['100% upfront', '50% upfront, 50% on completion', 'Monthly retainer', 'Net 14 (14 days after invoice)', 'Net 30 (30 days after invoice)', 'Milestone-based payments'] },
      { id: 'duration', label: 'Agreement duration', type: 'select', options: ['One-time project', '1 month', '3 months', '6 months', '1 year', 'Ongoing — 30 days notice to terminate'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'India', 'Philippines', 'Indonesia', 'UAE', 'Singapore', 'Malaysia', 'Canada — Ontario', 'United Kingdom', 'United States — New York', 'Australia', 'Other'] },
      { id: 'ipOwnership', label: 'Who owns work created under this agreement?', type: 'radio', options: ['Client owns all deliverables', 'Provider retains ownership until paid in full', 'Joint ownership'] },
      { id: 'confidentiality', label: 'Include confidentiality clause?', type: 'radio', options: ['Yes — both parties keep information confidential', 'No — not required'] },
    ],
  },
  'consulting-agreement': {
    name: 'Consulting Agreement',
    icon: '💼',
    fields: [
      { id: 'consultant', label: 'Consultant name / company', type: 'text', placeholder: 'e.g. Dr. Adebayo Okonkwo / Okonkwo Advisory Ltd.' },
      { id: 'client', label: 'Client / company name', type: 'text', placeholder: 'e.g. Pinnacle Group Nigeria' },
      { id: 'scope', label: 'Scope of consulting services', type: 'textarea', placeholder: 'e.g. Strategic business advisory including market entry analysis, financial modelling, and board-level presentations for Q3 2025 expansion into West Africa.' },
      { id: 'rate', label: 'Consulting rate', type: 'text', placeholder: 'e.g. $500/day, ₦200,000/month, or $5,000 project flat fee' },
      { id: 'paymentTerms', label: 'Payment terms', type: 'select', options: ['Monthly retainer', 'Per diem (daily rate)', 'Fixed project fee', 'Milestone-based', 'Net 30 on invoice'] },
      { id: 'duration', label: 'Engagement duration', type: 'select', options: ['1 month', '3 months', '6 months', '1 year', 'Project-based', 'Ongoing — 30 days notice'] },
      { id: 'exclusivity', label: 'Is the consultant exclusive to this client?', type: 'radio', options: ['No — consultant may work with other clients', 'Yes — exclusive during engagement', 'Yes — exclusive in same industry only'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'India', 'UAE', 'Singapore', 'Canada — Ontario', 'United Kingdom', 'United States — New York', 'Australia', 'Other'] },
    ],
  },
  'employment-offer-letter': {
    name: 'Employment Offer Letter',
    icon: '👔',
    fields: [
      { id: 'employer', label: 'Employer / company name', type: 'text', placeholder: 'e.g. TechBridge Nigeria Ltd.' },
      { id: 'employee', label: 'Employee full name', type: 'text', placeholder: 'e.g. Miss Fatima Al-Hassan' },
      { id: 'jobTitle', label: 'Job title / role', type: 'text', placeholder: 'e.g. Senior Software Engineer' },
      { id: 'department', label: 'Department', type: 'text', placeholder: 'e.g. Engineering / Sales / Operations' },
      { id: 'startDate', label: 'Proposed start date', type: 'text', placeholder: 'e.g. 1st April 2025' },
      { id: 'salary', label: 'Salary / compensation', type: 'text', placeholder: 'e.g. ₦3,600,000 per annum or $60,000/year' },
      { id: 'employmentType', label: 'Employment type', type: 'radio', options: ['Full-time permanent', 'Full-time fixed-term contract', 'Part-time', 'Probationary (3 months)', 'Remote'] },
      { id: 'benefits', label: 'Benefits included', type: 'checkbox', options: ['Health insurance', 'Pension / retirement contribution', 'Annual leave (paid)', 'Transportation allowance', 'Housing allowance', 'Performance bonus', 'Stock options / equity', 'Remote work allowance'] },
      { id: 'noticePeriod', label: 'Notice period to resign or terminate', type: 'select', options: ['1 week', '2 weeks', '1 month', '2 months', '3 months'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'India', 'Philippines', 'Indonesia', 'UAE', 'Canada — Ontario', 'United Kingdom', 'United States — California', 'Australia', 'Singapore', 'Other'] },
    ],
  },
  'non-compete-agreement': {
    name: 'Non-Compete Agreement',
    icon: '🚫',
    fields: [
      { id: 'employer', label: 'Employer / company enforcing the agreement', type: 'text', placeholder: 'e.g. Apex Solutions Ltd.' },
      { id: 'employee', label: 'Employee / contractor name', type: 'text', placeholder: 'e.g. Mr. Daniel Osei' },
      { id: 'role', label: 'Role / position held', type: 'text', placeholder: 'e.g. Head of Sales, Software Developer, Business Development Manager' },
      { id: 'restrictedActivities', label: 'What is restricted?', type: 'checkbox', options: ['Working for direct competitors', 'Starting a competing business', 'Soliciting company clients', 'Poaching company employees', 'Using proprietary information for personal gain'] },
      { id: 'duration', label: 'Restriction period after leaving', type: 'select', options: ['6 months', '1 year', '2 years', '3 years'] },
      { id: 'geography', label: 'Geographic scope of restriction', type: 'radio', options: ['Same city only', 'Same country only', 'Entire continent (e.g. Africa)', 'Worldwide'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'India', 'UAE', 'Canada — Ontario', 'United Kingdom', 'United States — California', 'Singapore', 'Australia', 'Other'] },
    ],
  },
  'payment-terms-agreement': {
    name: 'Payment Terms Agreement',
    icon: '💳',
    fields: [
      { id: 'creditor', label: 'Creditor / seller name (who is owed money)', type: 'text', placeholder: 'e.g. Zenith Supplies Ltd.' },
      { id: 'debtor', label: 'Debtor / buyer name (who owes money)', type: 'text', placeholder: 'e.g. Global Traders Inc.' },
      { id: 'amountOwed', label: 'Total amount owed', type: 'text', placeholder: 'e.g. ₦2,500,000 or $15,000' },
      { id: 'reason', label: 'Reason for the debt / what was supplied', type: 'textarea', placeholder: 'e.g. Supply of 500 units of industrial-grade motor oil delivered on 15 March 2025, Invoice No. INV-00234.' },
      { id: 'paymentSchedule', label: 'Payment schedule', type: 'radio', options: ['Single lump sum on agreed date', 'Weekly instalments', 'Monthly instalments', 'Milestone-based payments', 'Custom schedule'] },
      { id: 'dueDate', label: 'Payment due date or first instalment date', type: 'text', placeholder: 'e.g. 30th April 2025' },
      { id: 'latePenalty', label: 'Late payment penalty', type: 'radio', options: ['No penalty', '5% per month on overdue balance', '10% per month on overdue balance', 'Flat fee of 2% of total per week late'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'India', 'Philippines', 'UAE', 'Canada — Ontario', 'United Kingdom', 'United States — New York', 'Australia', 'Other'] },
    ],
  },
  'business-partnership': {
    name: 'Business Partnership Agreement',
    icon: '🤝',
    fields: [
      { id: 'partner1', label: 'Partner 1 full name', type: 'text', placeholder: 'e.g. Mr. Chidi Okafor' },
      { id: 'partner2', label: 'Partner 2 full name', type: 'text', placeholder: 'e.g. Mrs. Amina Bello' },
      { id: 'businessName', label: 'Business / partnership name', type: 'text', placeholder: 'e.g. Okafor & Bello Trading Co.' },
      { id: 'businessType', label: 'Nature of the business', type: 'textarea', placeholder: 'e.g. Import and distribution of consumer electronics across Lagos and Abuja.' },
      { id: 'capitalContribution', label: 'Capital contribution split', type: 'radio', options: ['50/50 — equal contribution', '60/40 split', '70/30 split', 'Unequal — specify in notes', 'Partners contribute different assets (cash vs. expertise)'] },
      { id: 'profitSplit', label: 'Profit and loss sharing', type: 'radio', options: ['Equal (50/50)', 'Proportional to capital contributed', 'As agreed separately in writing', 'One partner takes salary, remainder split equally'] },
      { id: 'decisionMaking', label: 'Major decisions require', type: 'radio', options: ['Unanimous agreement of all partners', 'Simple majority vote', 'Designated managing partner decides'] },
      { id: 'duration', label: 'Partnership duration', type: 'select', options: ['Indefinite — until dissolved', '1 year (renewable)', '2 years', '5 years', 'Until project completion'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'India', 'UAE', 'Canada — Ontario', 'United Kingdom', 'United States — New York', 'Australia', 'Singapore', 'Other'] },
    ],
  },
  'joint-venture': {
    name: 'Joint Venture Agreement',
    icon: '🏗️',
    fields: [
      { id: 'party1', label: 'Party 1 name / company', type: 'text', placeholder: 'e.g. Skybridge Construction Ltd.' },
      { id: 'party2', label: 'Party 2 name / company', type: 'text', placeholder: 'e.g. Delta Engineering Co.' },
      { id: 'jvName', label: 'Joint venture name (if applicable)', type: 'text', placeholder: 'e.g. Skybridge-Delta JV or leave blank if unnamed' },
      { id: 'purpose', label: 'Purpose and scope of the joint venture', type: 'textarea', placeholder: 'e.g. Jointly bid for, win and execute the construction of the Abuja Waterfront development project valued at ₦2.5 billion.' },
      { id: 'equitySplit', label: 'Equity / ownership split', type: 'radio', options: ['50/50 equal', '60/40', '70/30', '51/49 (majority control to Party 1)', 'As agreed separately'] },
      { id: 'management', label: 'Management structure', type: 'radio', options: ['Joint management committee — equal representation', 'Party 1 leads day-to-day operations', 'Party 2 leads day-to-day operations', 'Independent project manager appointed'] },
      { id: 'duration', label: 'Duration of joint venture', type: 'select', options: ['Until project completion', '1 year', '2 years', '5 years', 'Indefinite'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'India', 'UAE', 'China', 'Indonesia', 'Singapore', 'Canada — Ontario', 'United Kingdom', 'United States — New York', 'Australia', 'Other'] },
    ],
  },
  'loan-agreement': {
    name: 'Loan Agreement',
    icon: '💰',
    fields: [
      { id: 'lender', label: 'Lender name / company', type: 'text', placeholder: 'e.g. Mr. Emeka Eze (individual) or Capital Finance Ltd.' },
      { id: 'borrower', label: 'Borrower name / company', type: 'text', placeholder: 'e.g. Mrs. Ngozi Adeyemi or Sunrise Ventures Ltd.' },
      { id: 'loanAmount', label: 'Loan amount', type: 'text', placeholder: 'e.g. ₦5,000,000 or $10,000' },
      { id: 'purpose', label: 'Purpose of the loan', type: 'text', placeholder: 'e.g. Working capital for business expansion, school fees payment, purchase of vehicle' },
      { id: 'interestRate', label: 'Interest rate', type: 'text', placeholder: 'e.g. 10% per annum, 2% per month, or 0% (interest-free)' },
      { id: 'repaymentPeriod', label: 'Repayment period', type: 'select', options: ['1 month', '3 months', '6 months', '12 months', '18 months', '24 months', '36 months', '60 months'] },
      { id: 'repaymentSchedule', label: 'Repayment schedule', type: 'radio', options: ['Single lump sum at end of term', 'Monthly instalments', 'Weekly instalments', 'Quarterly instalments'] },
      { id: 'collateral', label: 'Is collateral / security provided?', type: 'radio', options: ['No collateral — unsecured loan', 'Yes — property as collateral', 'Yes — vehicle as collateral', 'Yes — other asset as collateral'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'India', 'Philippines', 'Indonesia', 'UAE', 'Canada — Ontario', 'United Kingdom', 'United States — New York', 'Australia', 'Other'] },
    ],
  },
  'shareholder-agreement': {
    name: 'Shareholder Agreement',
    icon: '📊',
    fields: [
      { id: 'companyName', label: 'Company name', type: 'text', placeholder: 'e.g. Nexus Fintech Limited' },
      { id: 'shareholders', label: 'Shareholders (list all names)', type: 'textarea', placeholder: 'e.g. Shareholder 1: James Obi — 40%\nShareholder 2: Priya Sharma — 35%\nShareholder 3: TechFund Capital Ltd — 25%' },
      { id: 'businessDescription', label: 'Business description', type: 'textarea', placeholder: 'e.g. A fintech company providing digital payment solutions across West Africa.' },
      { id: 'dividendPolicy', label: 'Dividend policy', type: 'radio', options: ['Dividends paid annually based on profit', 'Dividends reinvested — no distribution until exit', 'Dividends paid at board discretion', 'Fixed dividend percentage agreed upfront'] },
      { id: 'transferRestrictions', label: 'Share transfer restrictions', type: 'checkbox', options: ['Right of first refusal — existing shareholders get first offer', 'Drag-along rights — majority can force minority to sell', 'Tag-along rights — minority can join majority sale', 'Lock-up period — no transfer for first 2 years', 'Board approval required for any transfer'] },
      { id: 'antiDilution', label: 'Anti-dilution protection for early investors?', type: 'radio', options: ['Yes — pro-rata rights to maintain ownership %', 'No — no anti-dilution protection'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'India', 'UAE', 'Singapore', 'Canada — Ontario', 'United Kingdom', 'United States — Delaware', 'Cayman Islands', 'Other'] },
    ],
  },
  'mou': {
    name: 'Memorandum of Understanding (MOU)',
    icon: '🗒️',
    fields: [
      { id: 'party1', label: 'Party 1 name / organisation', type: 'text', placeholder: 'e.g. Lagos State Ministry of Education or Alibaba Group Ltd.' },
      { id: 'party2', label: 'Party 2 name / organisation', type: 'text', placeholder: 'e.g. EduTech Africa Ltd.' },
      { id: 'purpose', label: 'Purpose of the MOU — what are the parties agreeing to explore or do?', type: 'textarea', placeholder: 'e.g. Both parties agree to explore a partnership for deploying digital learning tools in 500 public secondary schools across Lagos State over a 3-year period.' },
      { id: 'obligations1', label: 'Party 1 obligations / contributions', type: 'textarea', placeholder: 'e.g. Provide access to school facilities, coordinate with school administrators, and fund infrastructure upgrades.' },
      { id: 'obligations2', label: 'Party 2 obligations / contributions', type: 'textarea', placeholder: 'e.g. Provide software platform, train teachers, and provide technical support for the duration of the programme.' },
      { id: 'binding', label: 'Is this MOU legally binding?', type: 'radio', options: ['Non-binding — statement of intent only', 'Binding — both parties are legally committed', 'Partially binding — specific clauses are binding (confidentiality, exclusivity)'] },
      { id: 'duration', label: 'Duration of MOU', type: 'select', options: ['6 months', '1 year', '2 years', '3 years', 'Until formal agreement is signed'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'India', 'China', 'Indonesia', 'Philippines', 'Malaysia', 'UAE', 'Singapore', 'Canada — Ontario', 'United Kingdom', 'United States — New York', 'Australia', 'Other'] },
    ],
  },
  'letter-of-intent': {
    name: 'Letter of Intent (LOI)',
    icon: '✉️',
    fields: [
      { id: 'sender', label: 'Sender name / company (issuing the LOI)', type: 'text', placeholder: 'e.g. Mr. David Mensah / Horizon Capital Ltd.' },
      { id: 'recipient', label: 'Recipient name / company', type: 'text', placeholder: 'e.g. Mrs. Amaka Obi / Target Acquisitions Ltd.' },
      { id: 'intentType', label: 'What is the intent for?', type: 'radio', options: ['Acquisition of a company or business', 'Purchase of property or real estate', 'Investment / funding', 'Business partnership or joint venture', 'Employment offer (executive level)', 'Commercial lease of property'] },
      { id: 'description', label: 'Brief description of the proposed transaction', type: 'textarea', placeholder: 'e.g. Sender intends to acquire 60% stake in Recipient company at a pre-money valuation of ₦500,000,000, subject to due diligence and board approval.' },
      { id: 'proposedValue', label: 'Proposed value / consideration (if applicable)', type: 'text', placeholder: 'e.g. $2,000,000 or ₦800,000,000 — subject to due diligence' },
      { id: 'exclusivity', label: 'Exclusivity period', type: 'select', options: ['No exclusivity requested', '30-day exclusivity', '60-day exclusivity', '90-day exclusivity', '6-month exclusivity'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'India', 'UAE', 'Singapore', 'Canada — Ontario', 'United Kingdom', 'United States — New York', 'Australia', 'Other'] },
    ],
  },
  'distribution-agreement': {
    name: 'Distribution / Reseller Agreement',
    icon: '📦',
    fields: [
      { id: 'supplier', label: 'Supplier / manufacturer name', type: 'text', placeholder: 'e.g. NovaTech Electronics Co., Shenzhen or AgriPure Foods Ltd., Lagos' },
      { id: 'distributor', label: 'Distributor / reseller name', type: 'text', placeholder: 'e.g. Pan-Africa Distribution Ltd.' },
      { id: 'products', label: 'Products being distributed', type: 'textarea', placeholder: 'e.g. Full range of NovaTech consumer electronics including smartphones, earphones, and smart watches (all current and future SKUs).' },
      { id: 'territory', label: 'Distribution territory', type: 'text', placeholder: 'e.g. All of Nigeria, or West Africa — Nigeria, Ghana, Ivory Coast, Senegal, or Southeast Asia' },
      { id: 'exclusivity', label: 'Is the distribution exclusive?', type: 'radio', options: ['Exclusive — distributor is the only authorised seller in territory', 'Non-exclusive — supplier can appoint other distributors', 'Semi-exclusive — max 2 distributors in territory'] },
      { id: 'minimumPurchase', label: 'Minimum purchase commitment', type: 'text', placeholder: 'e.g. $50,000 per quarter or 1,000 units per month or no minimum required' },
      { id: 'margin', label: 'Distributor margin / discount from RRP', type: 'text', placeholder: 'e.g. 25% discount from recommended retail price or cost + 30% markup' },
      { id: 'duration', label: 'Agreement duration', type: 'select', options: ['1 year', '2 years', '3 years', '5 years', 'Ongoing — 90 days notice to terminate'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'South Africa', 'Kenya', 'India', 'China', 'Indonesia', 'Philippines', 'Malaysia', 'Singapore', 'UAE', 'United Kingdom', 'United States — New York', 'Other'] },
    ],
  },
  'supply-agreement': {
    name: 'Supply Agreement',
    icon: '🏭',
    fields: [
      { id: 'supplier', label: 'Supplier name / company', type: 'text', placeholder: 'e.g. Agro-Fresh Produce Ltd., Kano or Shenzhen Components Co., Ltd.' },
      { id: 'buyer', label: 'Buyer / purchaser name / company', type: 'text', placeholder: 'e.g. Nestco Foods Nigeria Ltd.' },
      { id: 'goods', label: 'Goods / materials to be supplied', type: 'textarea', placeholder: 'e.g. 10 metric tonnes of grade A fresh tomatoes per week, delivered to buyer warehouse in Lagos. Quality specification: minimum 90% Grade 1, maximum 5% defects.' },
      { id: 'priceStructure', label: 'Pricing structure', type: 'radio', options: ['Fixed price per unit for duration of contract', 'Market-indexed price (reviewed quarterly)', 'Volume-tiered pricing', 'Price negotiated per order'] },
      { id: 'unitPrice', label: 'Price per unit / tonne / kg (if fixed)', type: 'text', placeholder: 'e.g. ₦120,000 per metric tonne or $0.80 per kg' },
      { id: 'minimumOrder', label: 'Minimum order quantity', type: 'text', placeholder: 'e.g. 5 metric tonnes per order or 500 units minimum' },
      { id: 'deliverySchedule', label: 'Delivery schedule', type: 'select', options: ['Weekly delivery', 'Bi-weekly delivery', 'Monthly delivery', 'On-demand — buyer places orders as needed', 'Custom schedule agreed separately'] },
      { id: 'qualityStandards', label: 'Quality control / inspection rights', type: 'radio', options: ['Buyer has right to inspect before acceptance', 'Supplier provides quality certificate with each delivery', 'Third-party inspection at buyer cost', 'No formal inspection — buyer accepts on delivery'] },
      { id: 'duration', label: 'Contract duration', type: 'select', options: ['6 months', '1 year', '2 years', '3 years', 'Ongoing — 60 days notice to terminate'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'India', 'China', 'Indonesia', 'Philippines', 'UAE', 'Canada — Ontario', 'United Kingdom', 'United States — New York', 'Australia', 'Other'] },
    ],
  },
  'business-proposal': {
    name: 'Business Proposal',
    icon: '🚀',
    fields: [
      { id: 'proposingCompany', label: 'Your company / name (proposing party)', type: 'text', placeholder: 'e.g. Ebenova Solutions or Bright Consulting Ltd.' },
      { id: 'prospectName', label: 'Prospect / client name (who you are pitching to)', type: 'text', placeholder: 'e.g. Mr. Emeka Eze, CEO, Zenith Manufacturing Ltd.' },
      { id: 'projectTitle', label: 'Project / proposal title', type: 'text', placeholder: 'e.g. Digital Transformation Strategy for Zenith Manufacturing — 2025' },
      { id: 'problemStatement', label: 'Problem or need you are solving for the client', type: 'textarea', placeholder: 'e.g. Zenith Manufacturing currently manages inventory manually across 3 warehouses, leading to an estimated 15% shrinkage and frequent stockouts costing ₦30M+ annually.' },
      { id: 'proposedSolution', label: 'Your proposed solution', type: 'textarea', placeholder: 'e.g. We will deploy a cloud-based inventory management system with real-time tracking across all 3 facilities, integrated with existing accounting software, and train all warehouse staff.' },
      { id: 'deliverables', label: 'Key deliverables', type: 'textarea', placeholder: 'e.g. 1. Needs assessment and system design (Week 1-2)\n2. System configuration and integration (Week 3-5)\n3. Staff training (Week 6)\n4. Go-live and 30-day post-deployment support (Week 7-10)' },
      { id: 'timeline', label: 'Proposed timeline', type: 'select', options: ['2 weeks', '1 month', '2 months', '3 months', '6 months', '1 year', 'To be discussed'] },
      { id: 'investment', label: 'Total investment / fee', type: 'text', placeholder: 'e.g. ₦4,500,000 total (30% upfront, 70% on completion) or $12,000 flat fee' },
      { id: 'whyUs', label: 'Why choose you? Your unique value', type: 'textarea', placeholder: 'e.g. 8 years experience in ERP deployments across Nigeria and Ghana, certified SAP partner, and over 40 successful implementations in the manufacturing sector.' },
      { id: 'country', label: 'Governing law / location', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'India', 'UAE', 'Canada — Ontario', 'United Kingdom', 'United States — New York', 'Australia', 'Singapore', 'Other'] },
      { id: 'validityPeriod', label: 'Proposal validity period', type: 'select', options: ['15 days', '30 days', '60 days', '90 days'] },
    ],
  },
  'tenancy-agreement': {
    name: 'Tenancy Agreement',
    icon: '🏠',
    fields: [
      { id: 'landlord', label: 'Landlord full name / company', type: 'text', placeholder: 'e.g. Chief Emeka Okafor / Okafor Properties Ltd.' },
      { id: 'tenant', label: 'Tenant full name', type: 'text', placeholder: 'e.g. Mrs. Amaka Nwosu' },
      { id: 'property', label: 'Property address', type: 'textarea', placeholder: 'e.g. Flat 3B, No. 14 Admiralty Way, Lekki Phase 1, Lagos State.' },
      { id: 'rentAmount', label: 'Annual rent amount', type: 'text', placeholder: 'e.g. ₦1,200,000 per annum or $8,400 per year' },
      { id: 'duration', label: 'Tenancy duration', type: 'select', options: ['6 months', '1 year', '2 years', '3 years'] },
      { id: 'paymentSchedule', label: 'Rent payment schedule', type: 'radio', options: ['Annually (paid once a year)', 'Bi-annually (twice a year)', 'Quarterly (every 3 months)', 'Monthly'] },
      { id: 'cautionDeposit', label: 'Caution / security deposit', type: 'text', placeholder: 'e.g. ₦600,000 (equivalent to 6 months rent)' },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'United Kingdom', 'Canada — Ontario', 'Other'] },
      { id: 'utilities', label: 'Who pays utilities?', type: 'radio', options: ['Tenant pays all utilities', 'Landlord pays all utilities', 'Shared — as agreed'] },
      { id: 'restrictions', label: 'Any restrictions on the property?', type: 'checkbox', options: ['No subletting', 'No pets', 'No business use', 'No structural alterations', 'No loud noise after 10pm'] },
    ],
  },
  'quit-notice': {
    name: 'Quit Notice',
    icon: '📮',
    fields: [
      { id: 'landlord', label: 'Landlord / issuing party name', type: 'text', placeholder: 'e.g. Chief Emeka Okafor' },
      { id: 'tenant', label: 'Tenant name (receiving party)', type: 'text', placeholder: 'e.g. Mrs. Amaka Nwosu' },
      { id: 'property', label: 'Property address', type: 'textarea', placeholder: 'e.g. Flat 3B, No. 14 Admiralty Way, Lekki Phase 1, Lagos State.' },
      { id: 'noticeType', label: 'Reason for quit notice', type: 'radio', options: ['Expiration of tenancy — not renewing', 'Non-payment of rent', 'Breach of tenancy terms', 'Owner requires personal use of property', 'Redevelopment / demolition of property'] },
      { id: 'noticePeriod', label: 'Notice period given', type: 'select', options: ['7 days', '1 month', '3 months', '6 months'] },
      { id: 'vacateDate', label: 'Date tenant must vacate by', type: 'text', placeholder: 'e.g. 31st May 2025' },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'United Kingdom', 'Other'] },
    ],
  },
  'deed-of-assignment': {
    name: 'Deed of Assignment',
    icon: '📜',
    fields: [
      { id: 'assignor', label: 'Assignor (current owner / seller)', type: 'text', placeholder: 'e.g. Mr. Biodun Adeleke' },
      { id: 'assignee', label: 'Assignee (new owner / buyer)', type: 'text', placeholder: 'e.g. Dr. Chukwuemeka Eze' },
      { id: 'property', label: 'Full property description', type: 'textarea', placeholder: 'e.g. All that piece of land known as Plot 7, Block C, Lekki Phase 2 Layout, covered by Certificate of Occupancy No. LAG/CofO/001234.' },
      { id: 'consideration', label: 'Purchase price / consideration', type: 'text', placeholder: 'e.g. ₦45,000,000 (Forty-five million naira)' },
      { id: 'titleDocument', label: 'Existing title document', type: 'radio', options: ['Certificate of Occupancy (C of O)', 'Deed of Assignment (from previous owner)', 'Governor\u2019s Consent', 'Gazette', 'Survey Plan only'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Other'] },
    ],
  },
  'power-of-attorney': {
    name: 'Power of Attorney',
    icon: '⚖️',
    fields: [
      { id: 'donor', label: 'Donor (person granting authority)', type: 'text', placeholder: 'e.g. Mr. Tunde Fashola' },
      { id: 'attorney', label: 'Attorney (person receiving authority)', type: 'text', placeholder: 'e.g. Mrs. Ngozi Fashola / ABC Law Firm' },
      { id: 'scope', label: 'Scope of authority granted', type: 'checkbox', options: ['Sell or transfer property', 'Sign contracts on my behalf', 'Collect rent and manage property', 'Operate bank accounts', 'Appear in court proceedings', 'Manage business affairs generally'] },
      { id: 'propertyDetails', label: 'Specific property or assets (if applicable)', type: 'textarea', placeholder: 'e.g. All property situated at No. 5 Victoria Island, Lagos. Leave blank if authority is general.' },
      { id: 'duration', label: 'Duration of power of attorney', type: 'radio', options: ['Until revoked by donor', 'Fixed period — specify below', 'Until specific transaction is completed'] },
      { id: 'durationNote', label: 'Specify period (if fixed)', type: 'text', placeholder: 'e.g. 12 months from date of signing. Leave blank if not applicable.' },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'United Kingdom', 'Canada — Ontario', 'Other'] },
    ],
  },
  'landlord-agent-agreement': {
    name: 'Landlord & Agent Agreement',
    icon: '🤝',
    fields: [
      { id: 'landlord', label: 'Landlord name / company', type: 'text', placeholder: 'e.g. Chief Emeka Okafor' },
      { id: 'agent', label: 'Agent / estate firm name', type: 'text', placeholder: 'e.g. Lagos Realty Ltd. / Femi Adeyemi' },
      { id: 'property', label: 'Property to be managed', type: 'textarea', placeholder: 'e.g. No. 14 Admiralty Way, Lekki Phase 1, Lagos — 4-unit apartment building.' },
      { id: 'agentScope', label: 'Agent responsibilities', type: 'checkbox', options: ['Find and screen tenants', 'Collect rent on landlord behalf', 'Handle maintenance and repairs', 'Serve quit notices when required', 'Conduct property inspections', 'Handle renewals and negotiations'] },
      { id: 'commission', label: 'Agent commission', type: 'text', placeholder: 'e.g. 10% of annual rent per new tenant, 5% for renewals' },
      { id: 'duration', label: 'Agreement duration', type: 'select', options: ['6 months', '1 year', '2 years', 'Ongoing — 30 days notice to terminate'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'United Kingdom', 'Other'] },
    ],
  },
  'facility-manager-agreement': {
    name: 'Facility Manager Agreement',
    icon: '🏢',
    fields: [
      { id: 'propertyOwner', label: 'Property owner / client name', type: 'text', placeholder: 'e.g. Skyline Towers Ltd.' },
      { id: 'facilityManager', label: 'Facility manager / company name', type: 'text', placeholder: 'e.g. ProManage Services Ltd.' },
      { id: 'property', label: 'Property / facility to be managed', type: 'textarea', placeholder: 'e.g. Skyline Commercial Complex, 12 floors, No. 3 Central Business District, Abuja — includes offices, carpark, and lobby.' },
      { id: 'services', label: 'Services included', type: 'checkbox', options: ['Routine maintenance and repairs', 'Cleaning and sanitation', 'Security management', 'Electrical and plumbing systems', 'HVAC / generator management', 'Vendor and contractor coordination', 'Emergency response'] },
      { id: 'fee', label: 'Management fee', type: 'text', placeholder: 'e.g. ₦500,000/month or 8% of annual rental income' },
      { id: 'duration', label: 'Contract duration', type: 'select', options: ['6 months', '1 year', '2 years', '3 years', 'Ongoing — 30 days notice to terminate'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'United Kingdom', 'Other'] },
      { id: 'liability', label: 'Liability cap for facility manager', type: 'radio', options: ['Limited to 3 months management fee', 'Limited to 1 month management fee', 'Unlimited liability', 'As determined by insurance policy'] },
    ],
  },
  'hire-purchase': {
    name: 'Hire Purchase Agreement',
    icon: '🚗',
    fields: [
      { id: 'seller', label: 'Seller / Finance company name', type: 'text', placeholder: 'e.g. Acme Equipment Ltd.' },
      { id: 'buyer', label: 'Buyer name / company', type: 'text', placeholder: 'e.g. John Smith / Smith Logistics' },
      { id: 'asset', label: 'Asset / item being financed', type: 'textarea', placeholder: 'e.g. 2023 Toyota Hilux pickup truck, VIN: XXXXXXXX. OR Industrial generator, Model: Mikano 100KVA.' },
      { id: 'assetValue', label: 'Total asset value / purchase price', type: 'text', placeholder: 'e.g. ₦4,500,000 or $12,000' },
      { id: 'deposit', label: 'Initial deposit / down payment', type: 'text', placeholder: 'e.g. ₦900,000 (20%) or $2,400' },
      { id: 'installments', label: 'Number of monthly instalments', type: 'select', options: ['6 months', '12 months', '18 months', '24 months', '36 months', '48 months', '60 months'] },
      { id: 'interestRate', label: 'Interest rate (if any)', type: 'text', placeholder: 'e.g. 5% per annum or 0% (interest-free)' },
      { id: 'country', label: 'Governing law', type: 'select', options: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Canada — Ontario', 'United Kingdom', 'United States — New York', 'Australia', 'UAE', 'Other'] },
      { id: 'ownershipTransfer', label: 'When does ownership transfer to buyer?', type: 'radio', options: ['After final instalment is paid', 'Immediately upon signing', 'After 50% of payments made'] },
      { id: 'defaultClause', label: 'What happens if buyer defaults?', type: 'radio', options: ['Seller repossesses asset immediately', 'Seller gives 30-day notice before repossession', 'Matter goes to arbitration first'] },
    ],
  },
  'independent-contractor': {
    name: 'Independent Contractor Agreement',
    icon: '📋',
    fields: [
      { id: 'company', label: 'Company / hiring party', type: 'text', placeholder: 'e.g. Acme Inc.' },
      { id: 'contractor', label: 'Contractor name / company', type: 'text', placeholder: 'e.g. John Smith / Smith Consulting' },
      { id: 'services', label: 'Services to be performed', type: 'textarea', placeholder: 'e.g. Software development services including backend API development and database architecture.' },
      { id: 'compensation', label: 'Compensation', type: 'text', placeholder: 'e.g. $120/hour or $8,000/month' },
      { id: 'term', label: 'Contract duration', type: 'select', options: ['3 months', '6 months', '1 year', 'Ongoing — 30 days notice to terminate', 'Project-based'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['United States — California', 'United States — New York', 'Canada — Ontario', 'United Kingdom', 'Australia', 'Nigeria', 'South Africa', 'Kenya', 'Ghana', 'Egypt', 'Brazil', 'Colombia', 'Mexico', 'Argentina', 'India', 'Singapore', 'UAE', 'Other'] },
      { id: 'nonCompete', label: 'Include non-compete clause?', type: 'radio', options: ['Yes — restrict working with competitors', 'No — no restrictions'] },
    ],
  },
  'purchase-agreement': {
    name: 'Basic Purchase Agreement',
    icon: '🛒',
    fields: [
      { id: 'seller', label: 'Seller name / company', type: 'text', placeholder: 'e.g. Jane Smith / Acme Trading Ltd.' },
      { id: 'buyer', label: 'Buyer name / company', type: 'text', placeholder: 'e.g. John Doe / XYZ Enterprises' },
      { id: 'goods', label: 'Description of goods / assets being sold', type: 'textarea', placeholder: 'e.g. One (1) used MacBook Pro 16-inch, 2022, serial number XXXXX. OR 500 units of Product SKU-001.' },
      { id: 'purchasePrice', label: 'Total purchase price', type: 'text', placeholder: 'e.g. $1,500 or ₦750,000' },
      { id: 'paymentMethod', label: 'Payment method', type: 'select', options: ['Full payment upfront', 'Bank transfer', 'Cash', 'Cheque', 'Escrow', 'Other'] },
      { id: 'deliveryTerms', label: 'Delivery / handover terms', type: 'select', options: ['Buyer collects in person', 'Seller delivers to buyer', 'Shipped via courier (buyer pays shipping)', 'Shipped via courier (seller pays shipping)', 'Digital delivery'] },
      { id: 'condition', label: 'Condition of goods', type: 'radio', options: ['Brand new', 'Used — as described', 'Refurbished'] },
      { id: 'warranty', label: 'Warranty / guarantee', type: 'radio', options: ['No warranty — sold as-is', '30-day warranty', '90-day warranty', '1-year warranty'] },
      { id: 'country', label: 'Governing law', type: 'select', options: ['United States — California', 'United States — New York', 'Canada — Ontario', 'United Kingdom', 'Australia', 'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Egypt', 'Brazil', 'Colombia', 'Mexico', 'Argentina', 'India', 'Singapore', 'UAE', 'Other'] },
    ],
  },
}

export default function Generator() {
  const { docType } = useParams()
  const navigate = useNavigate()
  const config = DOC_CONFIG[docType]
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showEmailGate, setShowEmailGate] = useState(false)
  const [leadEmail, setLeadEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [currentStep, setCurrentStep] = useState(0)

  // Redirect during render is a React anti-pattern — use useEffect
  useEffect(() => {
    if (!config) navigate('/')
  }, [config, navigate])

  if (!config) return null

  const update = (id, val) => setAnswers(p => ({ ...p, [id]: val }))

  const toggleCheckbox = (id, option) => {
    const current = answers[id] || []
    if (current.includes(option)) {
      update(id, current.filter(x => x !== option))
    } else {
      update(id, [...current, option])
    }
  }

  const isValid = () => {
    const required = config.fields.filter(f => f.type === 'text' || f.type === 'textarea' || f.type === 'select')
    return required.every(f => answers[f.id] && answers[f.id].trim && answers[f.id].trim() !== '')
  }

  const requiredFields = config.fields.filter(f => f.type === 'text' || f.type === 'textarea' || f.type === 'select')
  const filledCount = requiredFields.filter(f => answers[f.id] && answers[f.id].trim && answers[f.id].trim() !== '').length
  const progressPct = requiredFields.length > 0 ? Math.round((filledCount / requiredFields.length) * 100) : 0

  const totalSteps = config.fields.length
  const currentField = config.fields[currentStep]
  const isLastStep = currentStep >= totalSteps - 1

  const canAdvance = () => {
    if (!currentField) return false
    const val = answers[currentField.id]
    if (currentField.type === 'checkbox') return true // optional
    if (currentField.type === 'radio') return !!val
    if (currentField.type === 'select') return !!val
    return val && val.trim && val.trim() !== ''
  }

  const handleNext = () => {
    if (isLastStep) {
      handleGenerateClick()
    } else {
      setCurrentStep(s => s + 1)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && canAdvance() && currentField?.type !== 'textarea') {
      e.preventDefault()
      handleNext()
    }
  }

  const handleGenerateClick = () => {
    if (!isValid()) { setError('Please fill in all required fields.'); return }
    setError('')
    // Go straight to generation — email captured post-purchase on preview page
    handleGenerate('')
  }

  const handleEmailGateSubmit = async () => {
    if (!leadEmail || !leadEmail.includes('@')) {
      setEmailError('Please enter a valid email address.')
      return
    }
    setEmailError('')
    sessionStorage.setItem('signova_lead_email', leadEmail)
    // Fire and forget — capture lead async, don't block generation
    fetch('/api/capture-buyer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: leadEmail, docName: config?.name, source: 'pre-generate' }),
    }).catch(() => {})
    setShowEmailGate(false)
    handleGenerate(leadEmail)
  }

  const handleGenerate = async (email) => {
    if (!isValid()) { setError('Please fill in all required fields.'); return }
    setError('')
    setLoading(true)
    try {
      // Build the prompt
      const fieldSummary = config.fields.map(f => {
        const val = answers[f.id]
        if (!val || (Array.isArray(val) && val.length === 0)) return null
        const display = Array.isArray(val) ? val.join(', ') : val
        return `${f.label}: ${display}`
      }).filter(Boolean).join('\n')

      const prompt = `Generate a professional, comprehensive ${config.name} document for the following business:

${fieldSummary}

Requirements:
- Write in formal legal language appropriate for the document type
- Be specific and detailed, not generic
- Structure with clear numbered sections and subsections
- Include all standard clauses expected in a ${config.name}
- Tailor the content to the specific business details provided
- Do not include any placeholder text like [INSERT NAME] — use the actual values provided
- End with a signature block
- Do NOT add any disclaimers, footnotes, notes, or suggestions to seek legal advice at the end of the document. The document should end cleanly after the signature block.

Output the complete document only, no preamble, explanation, or closing notes.`

      const response = await fetch('/api/generate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      if (!response.ok) {
        const err = await response.json()
        // Handle rate limiting gracefully
        if (response.status === 429) {
          throw new Error('You have used your 3 free previews this hour. Pay $4.99 to generate and download your document directly.')
        }
        throw new Error(err.error || 'Generation failed')
      }

      const data = await response.json()
      const text = data.text || ''

      // Store and navigate to preview
      sessionStorage.setItem('signova_doc', JSON.stringify({
        docType,
        docName: config.name,
        content: text,
        answers,
        prompt, // stored for premium regeneration after payment
        generatedAt: new Date().toISOString(),
      }))
      navigate('/preview')
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const seo = SEO_META[docType] || {
    title: `${config.name} Template | Free Generator — Signova`,
    description: `Generate a professional ${config.name} in minutes. Free preview, download for $4.99. Used by businesses globally.`,
    keywords: `${config.name.toLowerCase()} template, ${config.name.toLowerCase()} generator, legal document generator`,
  }

  return (
    <div className="gen-page">
      <Helmet>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <meta name="keywords" content={seo.keywords} />
        <link rel="canonical" href={`https://www.getsignova.com/generate/${docType}`} />
        <meta property="og:title" content={seo.title} />
        <meta property="og:description" content={seo.description} />
        <meta property="og:url" content={`https://www.getsignova.com/generate/${docType}`} />
        <meta name="twitter:title" content={seo.title} />
        <meta name="twitter:description" content={seo.description} />
      </Helmet>
      <div className="gen-nav">
        <button className="gen-back" onClick={() => navigate('/')}>← Back</button>
        <div className="logo">
          <span className="logo-mark">S</span>
          <span className="logo-text">Signova</span>
        </div>
      </div>

      <div className="gen-inner">
        <div className="gen-header">
          <span className="gen-icon">{config.icon}</span>
          <h1 className="gen-title">{config.name}</h1>
          <p className="gen-sub">Answer the questions below. Your document will be generated instantly.</p>
        </div>

        <div className="gen-form">
          {/* Progress dots */}
          <div className="gen-steps-dots">
            {config.fields.map((_, i) => (
              <span key={i} className={`step-dot ${i < currentStep ? 'done' : i === currentStep ? 'active' : ''}`} onClick={() => i < currentStep && setCurrentStep(i)} />
            ))}
          </div>

          {/* Answered questions (chat history) */}
          <div className="gen-chat-history">
            {config.fields.slice(0, currentStep).map(field => (
              <div key={field.id} className="chat-answered" onClick={() => setCurrentStep(config.fields.indexOf(field))}>
                <span className="chat-q">{field.label}</span>
                <span className="chat-a">{Array.isArray(answers[field.id]) ? answers[field.id].join(', ') : answers[field.id] || '—'}</span>
              </div>
            ))}
          </div>

          {/* Current question */}
          {currentField && !loading && (
            <div className="gen-chat-current" onKeyDown={handleKeyDown}>
              <label className="chat-question">{currentField.label}</label>

              {currentField.type === 'text' && (
                <input
                  className="chat-input"
                  type="text"
                  placeholder={currentField.placeholder}
                  value={answers[currentField.id] || ''}
                  onChange={e => update(currentField.id, e.target.value)}
                  autoFocus
                />
              )}

              {currentField.type === 'textarea' && (
                <textarea
                  className="chat-textarea"
                  placeholder={currentField.placeholder}
                  value={answers[currentField.id] || ''}
                  onChange={e => update(currentField.id, e.target.value)}
                  rows={3}
                  autoFocus
                />
              )}

              {currentField.type === 'select' && (
                <div className="chat-options">
                  {currentField.options.map(o => (
                    <button key={o} className={`chat-option ${answers[currentField.id] === o ? 'selected' : ''}`} onClick={() => { update(currentField.id, o); if (!isLastStep) setTimeout(() => setCurrentStep(s => s + 1), 200) }}>
                      {o}
                    </button>
                  ))}
                </div>
              )}

              {currentField.type === 'radio' && (
                <div className="chat-options">
                  {currentField.options.map(o => (
                    <button key={o} className={`chat-option ${answers[currentField.id] === o ? 'selected' : ''}`} onClick={() => { update(currentField.id, o); if (!isLastStep) setTimeout(() => setCurrentStep(s => s + 1), 200) }}>
                      {o}
                    </button>
                  ))}
                </div>
              )}

              {currentField.type === 'checkbox' && (
                <div className="chat-options chat-options-multi">
                  {currentField.options.map(o => (
                    <button key={o} className={`chat-option ${(answers[currentField.id] || []).includes(o) ? 'selected' : ''}`} onClick={() => toggleCheckbox(currentField.id, o)}>
                      {(answers[currentField.id] || []).includes(o) ? '✓ ' : ''}{o}
                    </button>
                  ))}
                </div>
              )}

              <div className="chat-actions">
                {currentStep > 0 && (
                  <button className="chat-back" onClick={() => setCurrentStep(s => s - 1)}>← Back</button>
                )}
                <button className={`chat-next ${!canAdvance() ? 'disabled' : ''}`} onClick={handleNext} disabled={!canAdvance()}>
                  {isLastStep ? 'Generate →' : 'Next →'}
                </button>
              </div>
            </div>
          )}

          {error && <div className="gen-error">{error}</div>}

          {loading && (
            <div className="gen-loading">
              <span className="spinner" />
              <p>Generating your {config.name}…</p>
            </div>
          )}
        </div>
      </div>

      {/* Email captured post-purchase on /preview instead */}
    </div>
  )
}
