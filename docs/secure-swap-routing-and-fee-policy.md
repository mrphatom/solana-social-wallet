# Secure Solana Swap Routing Policy

**Status:** Architecture and inert policy contract only.  
**Scope:** Future token-swap requests.  
**Not in scope:** Quote retrieval, DEX aggregation, RPC access, transaction construction, wallet connection, signing, submission, confirmation tracking, or token movement.

## Purpose and non-authority rule

This specification defines how a future user-controlled client may decide whether an externally supplied Solana swap route is safe enough to present for **fresh user review**. It does not make a route trustworthy, executable, profitable, compliant, or appropriate for a user. The Discord/Telegram bot, social-wallet service, queue, logger, and directory resolver remain coordination components only; they cannot select a route, choose a fee, construct a transaction, request a signature, submit a transaction, or report settlement.

> A quote, a route plan, a simulation result, a fee estimate, and a wallet-control proof are **evidence with bounded meaning**. None is consent to spend.

## Trust zones

| Zone | May provide | Must not be trusted to decide | Required local control |
|---|---|---|---|
| User | Exact input mint, output mint, input amount, maximum slippage, and fee cap | Program/account safety or expected effects | Clear intent capture and fresh review |
| Quote or route provider | Candidate quote and route envelope | Asset safety, final instruction set, fee payer, price impact, or transaction validity | Schema validation, provenance, expiry, structural comparison |
| RPC provider | Account state, blockhash, simulation and fee observations | Correctness of an opaque transaction, safety of a program, or final inclusion | Commitment policy, bounded retry, independent validation, degradation on conflict |
| Local policy evaluator | Accept/reject decision and bounded recommendation | Wallet approval or authorization to spend | Pure, deterministic, side-effect-free evaluation |
| User-controlled wallet | Exact decoded message review and user signature | Quote discovery, identity authority, or social-bot command interpretation | Signature after current fingerprint and local authentication |

Solana’s versioned transaction rules mean that a v0 message may include Address Lookup Tables, whose resolved writable and read-only accounts influence the effective account list. A safe route review must resolve and inspect those accounts before a user sees an approval request. [1]

## Route-envelope requirements

The future `SWAP_ROUTE_REQUEST_V1` envelope is valid for policy evaluation only when all fields below are present, canonical, and mutually consistent. Monetary values use unsigned decimal strings that are parsed to `bigint`; JavaScript `number` is forbidden for tokens, lamports, slots, compute units, and block heights.

| Evidence element | Required constraint | Failure result |
|---|---|---|
| Intent binding | Exact input/output mint addresses, input base-unit amount, explicit minimum output, user slippage ceiling, target cluster, and request ID | `INTENT_MISMATCH` |
| Quote freshness | Provider identity, issuance and expiry timestamps, slot/context evidence, route fingerprint, and finite policy TTL | `QUOTE_STALE` or `QUOTE_PROVENANCE_MISSING` |
| Price and output | Positive input and min-output base-unit values; quoted expected output must not be less than min output; declared price impact must be bounded or rejected | `OUTPUT_OR_SLIPPAGE_INVALID` |
| Transaction transparency | Fully decoded legacy/v0 message; all instructions, static accounts, ALT-resolved accounts, signer flags, writable flags, and instruction roles available | `TRANSACTION_NOT_FULLY_DECODED` |
| Program and mint control | Every invoked program, Token/Token-2022 program, mint, transfer hook, and custom extension must be in a versioned, independently reviewed allowlist | `PROGRAM_OR_EXTENSION_NOT_ALLOWED` |
| Asset effects | Source amount, destination amount, token fees, rent, ATA creation, fee payer, delegate/transfer authority, and all external recipients explicitly summarized | `HIDDEN_OR_UNEXPECTED_EFFECT` |
| Message immutability | The complete decoded-message fingerprint must equal the route envelope fingerprint at simulation, human review, wallet approval, and immediately before signature | `ROUTE_FINGERPRINT_MISMATCH` |
| Simulation | Matching current message succeeds at the required commitment and does not produce parser-unknown inner instructions or unaccounted balance changes | `SIMULATION_REVIEW_REQUIRED` |

An Associated Token Account can require a payer-funded account balance when it is created. Its creation, the receiving owner, the mint, and payer cost are therefore user-visible effects, not a hidden routing convenience. [2]

## Deterministic selection policy

The system must never accept an opaque prebuilt transaction simply because a route provider labels it “best.” A future local evaluator compares only route envelopes that each pass full structural validation. It uses deterministic, user-specified constraints rather than an unbounded profitability objective.

| Selection step | Rule |
|---|---|
| 1. Reject first | Reject every candidate with a stale/missing provenance, unknown program, unknown instruction/account effect, unexpected signer, unexpected fee payer, unexpected transfer authority, or unsupported Token-2022 extension. |
| 2. Verify intent | Require exact match for cluster, input mint, output mint, input amount, user minimum output, and request ID. An output-mint or amount substitution is a hard refusal. |
| 3. Verify economics | Reject a candidate if net expected output, including known token transfer fees, is less than the requested minimum output, if declared price impact is outside the chosen cap, or if rent/ATA cost is unbounded or undisclosed. |
| 4. Bound execution shape | Require an independently reviewed protocol profile defining programs, instruction schemas, expected account roles, Token program variants, ALT policy, writable-account bounds, and disallowed delegated authority. |
| 5. Rank only validated peers | If more than one candidate remains, rank using a stable tuple: highest **minimum** output, then lowest disclosed non-network protocol/ATA cost, then lowest bounded priority-fee cap, then lexical route fingerprint. The ranking never changes a user-selected maximum. |
| 6. Refuse unresolved disagreement | Provider disagreement, duplicate provider identities, shared failure domains, or multiple materially different valid envelopes result in `ROUTE_CONFLICT_REQUIRES_USER_SELECTION`, not silent selection. |

The local policy should require at least two independently operated quote/route sources for high-value use once concrete providers exist. This is a future operational gate, not an implemented service. A single source may be displayed as **unverified discovery information** but may not progress to a signing-ready state.

## Token-program and extension boundaries

Mint decimal precision belongs to the mint account, while token-account ownership and transferable amount are held by token accounts. The renderer must display both base-unit quantities and human-readable decimal amounts derived from independently read mint metadata; it must never trust provider-formatted values alone. [2]

Token-2022 can add transfer fees, transfer hooks, permanent delegates, non-transferability, pause behavior, confidential transfer features, and other extension-driven effects. The base policy treats every extension as `UNSUPPORTED` unless a protocol profile contains version-pinned parser coverage, an effect model, formal test cases, and a security review. [3] A transfer-fee mint can reduce net received amount and retain a fee in the destination token account; expected gross and expected net must be separately disclosed. [4] A transfer hook can invoke custom logic on transfers, so it requires hook-program allowlisting plus complete extra-account/effect disclosure. [5]

## Freshness, mutation, and restart rules

The following events invalidate a route package and require a return to candidate validation, simulation, review, and wallet approval: quote expiry; route fingerprint change; mint metadata or extension evidence change; ALT resolution change; compute-budget change; priority-fee recommendation change; blockhash replacement; simulation context/commitment downgrade; provider conflict; parser/profile version change; or any newly discovered writable account, signer, authority, recipient, or transfer effect.

This rule is intentionally strict: a request may be safely cancelled, but it must not be silently “refreshed” behind a previously obtained review. Solana’s `simulateTransaction` can return a replacement blockhash and is explicitly non-broadcasting; such a result is pre-signing evidence only and requires a new exact-message fingerprint before signing. [6]

## Review payload

Before the wallet is asked to sign, the client must show the user the exact transaction fingerprint, input/output mint addresses and decimal metadata, maximum input, minimum and expected net output, price-impact disclosure, token/ATA/rent/protocol costs, base fee, priority-fee cap, fee payer, all additional signers, writable accounts grouped by role, every invoked program, Token-2022 extensions, all external recipients, route expiry, blockhash expiry, and the explicit statement that **submitted is not confirmed**.

## References

[1]: https://solana.com/docs/core/transactions/versioned-transactions "Solana — Versioned Transactions"
[2]: https://solana.com/docs/tokens "Solana — Assets on Solana"
[3]: https://solana.com/docs/tokens/extensions "Solana — Token Extensions"
[4]: https://solana.com/docs/tokens/extensions/transfer-fees "Solana — Transfer Fees"
[5]: https://solana.com/docs/tokens/extensions/transfer-hook "Solana — Transfer Hook"
[6]: https://solana.com/docs/rpc/http/simulatetransaction "Solana RPC — simulateTransaction"
