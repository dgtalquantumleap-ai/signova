# ebenova-legal-docs

Node.js SDK for the [Ebenova Legal Document API](https://ebenova.dev).

## Install

```bash
npm install ebenova-legal-docs
```

## Quick start

```js
import EbenovaClient from 'ebenova-legal-docs'

const client = new EbenovaClient({ apiKey: 'sk_live_your_key' })

// Generate an NDA
const result = await client.documents.generate({
  document_type: 'nda',
  fields: {
    disclosingParty: 'Acme Inc.',
    receivingParty:  'John Smith',
    purpose:         'Discussing a potential partnership',
    duration:        '2 years',
    mutual:          'Yes — mutual NDA',
  },
  jurisdiction: 'Nigeria',
})

console.log(result.document)
// NON-DISCLOSURE AGREEMENT
// This Non-Disclosure Agreement ("Agreement") is entered into...
```

## API

### `client.documents.generate(params)`

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `document_type` | string | ✅ | Document type slug — see list below |
| `fields` | object | ✅ | Document-specific fields |
| `jurisdiction` | string | | Governing law (e.g. `"Nigeria"`, `"United States — California"`) |

Returns: `{ document_type, document, usage, generated_at }`

### `client.documents.types()`

Returns all 27 supported document types, grouped by category.

### `client.extract.conversation(params)`

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `conversation` | string | ✅ | Raw chat / email text |
| `target_document` | string | | Document type to extract for |
| `auto_generate` | boolean | | Also generate the document (default: `false`) |

Returns: `{ suggested_document, confidence, extracted_fields, missing_fields, document? }`

### `client.keys.usage()`

Returns current month usage and 3-month history.

## Error handling

```js
import { EbenovaClient, EbenovaError } from '@ebenova/legal-docs'

try {
  const result = await client.documents.generate({ ... })
} catch (err) {
  if (err instanceof EbenovaError) {
    console.error(err.code, err.message, err.hint)
    // e.g. MONTHLY_LIMIT_REACHED  Monthly document limit reached  Upgrade at ebenova.dev/pricing
  }
}
```

## Supported document types

`nda`, `freelance-contract`, `service-agreement`, `consulting-agreement`, `independent-contractor`, `business-partnership`, `joint-venture`, `distribution-agreement`, `supply-agreement`, `business-proposal`, `purchase-agreement`, `employment-offer-letter`, `non-compete-agreement`, `loan-agreement`, `payment-terms-agreement`, `shareholder-agreement`, `hire-purchase`, `tenancy-agreement`, `quit-notice`, `deed-of-assignment`, `power-of-attorney`, `landlord-agent-agreement`, `facility-manager-agreement`, `privacy-policy`, `terms-of-service`, `mou`, `letter-of-intent`

## License

MIT
