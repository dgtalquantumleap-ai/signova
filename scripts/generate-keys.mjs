#!/usr/bin/env node
// scripts/generate-keys.mjs
// One-time Ed25519 keypair generation for Signova document signing.
//
// Usage:
//   node scripts/generate-keys.mjs
//
// Outputs three env-var lines. Paste each into Vercel (Project → Settings →
// Environment Variables) for all environments. KEEP THE PRIVATE KEY SECRET.

import { generateKeyPairSync } from 'node:crypto'

const { publicKey, privateKey } = generateKeyPairSync('ed25519')

const pkPem = publicKey.export({ format: 'pem', type: 'spki' })
const skPem = privateKey.export({ format: 'pem', type: 'pkcs8' })

const pkB64 = Buffer.from(pkPem).toString('base64')
const skB64 = Buffer.from(skPem).toString('base64')

const kid = `sig-${new Date().toISOString().slice(0, 7)}` // e.g. sig-2026-04

process.stdout.write(`
# ─────────────────────────────────────────────────────────────────
# Signova Ed25519 signing keypair
# Generated: ${new Date().toISOString()}
# Key ID:    ${kid}
# ─────────────────────────────────────────────────────────────────

# Add these to Vercel env vars (all environments):

SIGNOVA_SIGNING_KID=${kid}
SIGNOVA_SIGNING_PK=${pkB64}
SIGNOVA_SIGNING_SK=${skB64}

# Public key (PEM, safe to publish):
${pkPem}
# Private key (PEM, KEEP SECRET):
${skPem}
`)
