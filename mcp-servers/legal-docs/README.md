# @ebenova/legal-docs-mcp

[![MCPize](https://mcpize.com/badge/@dgtalquantumleap/ebenova-legal-docs)](https://mcpize.com/mcp/ebenova-legal-docs)

MCP server for the [Ebenova API](https://ebenova.dev). Generate legal documents (NDAs, contracts, tenancy agreements), invoices, and receipts — directly from Claude Desktop, Cursor, or any MCP-compatible AI assistant.

## Tools

| Tool | Description |
|------|-------------|
| `generate_legal_document` | Generate any of 27 legal document types in 18 jurisdictions |
| `generate_invoice` | Generate invoices, receipts, proforma invoices, or credit notes (12 currencies) |
| `extract_from_conversation` | Extract structured fields from a WhatsApp or email conversation |
| `list_document_types` | List all supported document types |
| `check_usage` | Check your monthly quota usage |

## Installation

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ebenova-legal": {
      "command": "npx",
      "args": ["-y", "@ebenova/legal-docs-mcp"],
      "env": {
        "EBENOVA_API_KEY": "sk_live_your_key_here"
      }
    }
  }
}
```

**Config file location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "ebenova-legal": {
      "command": "npx",
      "args": ["-y", "@ebenova/legal-docs-mcp"],
      "env": {
        "EBENOVA_API_KEY": "sk_live_your_key_here"
      }
    }
  }
}
```

## Connect via MCPize

Use this MCP server instantly with no local installation:

```bash
npx -y mcpize connect @dgtalquantumleap/ebenova-legal-docs --client claude
```

Or connect at: **https://mcpize.com/mcp/ebenova-legal-docs**

## Get an API Key

[ebenova.dev/dashboard](https://ebenova.dev/dashboard) — free tier includes 5 documents/month.

## Supported Document Types

**Business Contracts:** NDA, Freelance Contract, Service Agreement, Consulting Agreement, Independent Contractor, Partnership, Joint Venture, Distribution Agreement, Supply Agreement, Business Proposal, Purchase Agreement

**Employment & HR:** Employment Offer Letter, Non-Compete Agreement

**Financial:** Loan Agreement, Payment Terms Agreement, Shareholder Agreement, Hire Purchase

**Real Estate:** Tenancy Agreement, Quit Notice, Deed of Assignment, Power of Attorney, Landlord & Agent Agreement, Facility Manager Agreement

**Legal & Compliance:** Privacy Policy, Terms of Service, MOU, Letter of Intent

## Example prompts

Once connected, you can say things like:

- *"Create an NDA between Acme Inc. and John Smith for 2 years, mutual, governed by Nigerian law"*
- *"Generate a tenancy agreement for Flat 3B, 14 Admiralty Way, Lekki. Landlord is Chief Emeka Okafor, tenant is Mrs. Nwosu, rent is ₦1.2M per year"*
- *"Here's a WhatsApp chat about a rent deal — extract the terms and generate a tenancy agreement"*
- *"Draft a privacy policy for my app called TaskFlow that collects email addresses and uses Stripe"*
- *"Create an invoice for Acme Corp. 3 hours of consulting at $150/hour, due in 30 days"*
- *"Generate a receipt for the $500 payment I just received from John Smith"*
- *"How many documents have I generated this month?"*

## License

MIT