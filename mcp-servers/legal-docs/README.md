# @ebenova/legal-docs-mcp

[![MCPize](https://mcpize.com/badge/@dgtalquantumleap/ebenova-legal-docs)](https://mcpize.com/mcp/ebenova-legal-docs)

MCP server for the [Ebenova API](https://ebenova.dev). Generate legal documents (NDAs, contracts, tenancy agreements), invoices, and receipts — directly from Claude Desktop, Cursor, or any MCP-compatible AI assistant.

## What it looks like

**You say to Claude:**
> "Create a mutual NDA between Acme Inc. and John Smith, 2 years, governed by Nigerian law"

**Claude calls the tool and returns:**
```
NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of [DATE] by and between:

ACME INC., a company duly incorporated under the laws of Nigeria ("Disclosing Party")
and
JOHN SMITH, an individual ("Receiving Party")

WHEREAS, the parties wish to explore a potential business relationship and may disclose
certain confidential information to each other...

[Full 800-word document continues — jurisdiction-aware Nigerian law clauses included]
```

**Or paste a WhatsApp chat:**
> "Here's a WhatsApp conversation about a rent deal — generate the tenancy agreement"
```
Landlord: The 2-bed flat at 14 Park Lane is available. Rent is ₦1.2M/year.
Tenant: I'm James Okafor. Agreed. 1 year, 1 month deposit?
Landlord: Yes. Move in 1st of next month. No pets.
```
**Claude extracts:** landlord name, tenant name, address, rent, duration, deposit, restrictions — and generates the full tenancy agreement.

---

## Tools

| Tool | Description |
|------|-------------|
| `generate_legal_document` | Generate any of 27 legal document types in 18 jurisdictions |
| `generate_invoice` | Generate invoices, receipts, proforma invoices, or credit notes (12 currencies) |
| `extract_from_conversation` | Extract structured fields from a WhatsApp or email conversation |
| `analyze_scope_creep` | Detect scope violations in client messages, get 3 response drafts + change order pricing |
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