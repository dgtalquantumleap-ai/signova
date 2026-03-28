# Ebenova Legal Documents MCP Server

[![Smithery](https://smithery.ai/badge/@ebenova/legal-docs-mcp)](https://smithery.ai/server/@ebenova/legal-docs-mcp)
[![npm](https://img.shields.io/npm/v/@ebenova/legal-docs-mcp)](https://www.npmjs.com/package/@ebenova/legal-docs-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Generate professional legal documents via API directly from Claude Desktop, Cursor, or any MCP-compatible AI agent.

## Features

- **27 Document Types**: NDAs, freelance contracts, tenancy agreements, privacy policies, and more
- **18 Jurisdictions**: Nigeria, Canada, UK, US, India, Kenya, Ghana, UAE, and more
- **AI-Powered**: Powered by Anthropic Claude for accurate legal drafting
- **Conversation Extraction**: Paste WhatsApp/email chats → auto-fill contract fields
- **Free Tier**: 5 documents/month free, no credit card required

## Installation

### Claude Desktop

1. Open Claude Desktop settings
2. Go to "Developer" → "Edit Config"
3. Add this configuration:

```json
{
  "mcpServers": {
    "ebenova-legal": {
      "command": "npx",
      "args": ["-y", "@ebenova/legal-docs-mcp"],
      "env": {
        "EBENOVA_API_KEY": "sk_live_your_api_key_here"
      }
    }
  }
}
```

4. Save and restart Claude Desktop
5. Get your API key at [ebenova.dev/docs](https://ebenova.dev/docs)

### Cursor IDE

1. Open Cursor settings
2. Go to "Features" → "MCP Servers"
3. Click "Add New Server"
4. Enter:
   - Name: `ebenova-legal`
   - Type: `command`
   - Command: `npx -y @ebenova/legal-docs-mcp`
   - Environment: `EBENOVA_API_KEY=sk_live_your_key`

### npm (Node.js 18+)

```bash
npx -y @ebenova/legal-docs-mcp
```

### Docker

```bash
docker run -e EBENOVA_API_KEY=sk_live_your_key ebenova/legal-docs-mcp
```

## Available Tools

### 1. `generate_legal_document`

Generate a professionally drafted legal document.

**Parameters:**
- `document_type` (required): Type of document (e.g., 'nda', 'freelance-contract', 'tenancy-agreement')
- `fields` (required): Document-specific fields as key-value pairs
- `jurisdiction` (optional): Governing law (e.g., "Nigeria", "Canada", "UK")

**Example:**
```
Generate an NDA between Acme Inc. and John Smith for a partnership discussion, 
2 years, mutual, under Nigerian law.
```

### 2. `extract_from_conversation`

Extract structured fields from a WhatsApp, email, or chat conversation.

**Parameters:**
- `conversation` (required): Raw conversation text
- `target_document` (optional): Document type to extract for
- `auto_generate` (optional): Also generate the document (default: false)

**Example:**
```
Extract the key terms from this WhatsApp chat and create a tenancy agreement:

[3/20/26] Landlord: Rent is ₦1.2m per year, 1 year tenancy.
[3/20/26] Tenant: Agreed. I'm Amaka Nwosu. When do I move in?
[3/20/26] Landlord: 1st April. 6 months caution deposit.
```

### 3. `list_document_types`

List all 27 supported document types, grouped by category.

**Example:**
```
What types of legal documents can you generate?
```

### 4. `check_usage`

Check your API usage and remaining quota.

**Example:**
```
How many documents have I generated this month?
```

## Supported Document Types

### Business Contracts
- NDA (Non-Disclosure Agreement)
- Freelance Contract
- Service Agreement
- Consulting Agreement
- Independent Contractor Agreement
- Business Partnership Agreement
- Joint Venture Agreement
- Distribution Agreement
- Supply Agreement
- Business Proposal
- Purchase Agreement

### Employment & HR
- Employment Offer Letter
- Non-Compete Agreement

### Financial
- Loan Agreement
- Payment Terms Agreement
- Shareholder Agreement
- Hire Purchase Agreement

### Real Estate
- Tenancy Agreement
- Quit Notice
- Deed of Assignment
- Power of Attorney
- Landlord-Agent Agreement
- Facility Manager Agreement

### Legal & Compliance
- Privacy Policy
- Terms of Service
- MOU (Memorandum of Understanding)
- Letter of Intent

## Supported Jurisdictions

### Africa
- Nigeria (Lagos State Tenancy Law)
- Kenya
- Ghana
- South Africa
- Tanzania, Uganda, Ethiopia, Senegal, Ivory Coast, Cameroon

### North America
- United States (California Labor Code)
- Canada (Alberta Contract Law)

### Europe
- United Kingdom
- Germany, France, Italy, Spain, Netherlands, Portugal

### Middle East & Asia
- UAE
- Saudi Arabia
- India, Singapore, Philippines, Indonesia, Malaysia

## Pricing

| Tier | Price | Documents/Month | Features |
|------|-------|-----------------|----------|
| Free | $0 | 5 | All document types, all jurisdictions |
| Starter | $29 | 100 | Email support, usage analytics |
| Pro | $19.99 | 500 | Scope Guard, priority support |
| Scale | $79 | 2,000 | Custom integrations, SLA |

Get your free API key at [ebenova.dev/docs](https://ebenova.dev/docs)

## Example Conversations

### Example 1: Generate NDA
```
User: Create an NDA for me.
Assistant: I can help with that! I'll need a few details:
- Who is the disclosing party?
- Who is the receiving party?
- What's the purpose of the NDA?
- How long should it last?
- Should it be mutual (both parties disclose) or one-way?
- Which jurisdiction's law should apply?

User: Disclosing party is TechCorp Ltd, receiving party is John Smith. 
Purpose is discussing a potential software licensing deal. 2 years. 
Mutual NDA. Nigerian law.

Assistant: [Generates complete NDA document]
```

### Example 2: Extract from Chat
```
User: I have this WhatsApp conversation, can you create a contract from it?

[Pastes conversation]

Assistant: I've extracted the following terms:
- Landlord: Chief Emeka Okafor
- Tenant: Mrs. Amaka Nwosu
- Property: Flat 3B, No. 14 Admiralty Way, Lekki Phase 1, Lagos
- Rent: ₦1,200,000 per annum
- Duration: 1 year

This looks like a tenancy agreement. Would you like me to generate the full document?

User: Yes, please.

Assistant: [Generates complete tenancy agreement]
```

## Troubleshooting

### "EBENOVA_API_KEY is not set"
Make sure you've set the environment variable in your MCP configuration:
```json
{
  "env": {
    "EBENOVA_API_KEY": "sk_live_your_key"
  }
}
```

### "Monthly limit reached"
You've exceeded your tier's document limit. Upgrade at [ebenova.dev/pricing](https://ebenova.dev/pricing)

### "Unsupported document type"
Check the list of supported types with the `list_document_types` tool.

## API Documentation

Full API documentation: [ebenova.dev/docs](https://ebenova.dev/docs)

## Support

- **Email**: api@ebenova.dev
- **Documentation**: [ebenova.dev/docs](https://ebenova.dev/docs)
- **Status**: [status.ebenova.dev](https://status.ebenova.dev)
- **GitHub**: [github.com/ebenova/legal-docs-mcp](https://github.com/ebenova/legal-docs-mcp)

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

Built by [Ebenova Solutions](https://ebenova.dev) — Legal infrastructure for informal commerce.
