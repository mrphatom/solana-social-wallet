# Secure Solana Transaction Simulation and Human-Readable Parsing

**Status:** Future-only specification.  
**Current implementation:** No wire decoder, RPC client, simulation client, transaction builder, signer, or broadcaster exists in this repository.

## Goal

The future parser converts an exact, candidate Solana transaction message into a verifiable human review package. It is not a transaction “explainer” that guesses intent from known labels. If the parser cannot fully establish an instruction, account role, authority, asset movement, fee, lookup-table address, Token-2022 extension, or expected inner-instruction effect, it returns `PARSER_UNAVAILABLE` and blocks approval.

Solana messages carry the header, account keys, recent blockhash, and compiled instructions. The header partitions keys into signer/writable categories, and compiled instructions reference program and account keys by index. A parser must therefore resolve the whole message before summarizing one instruction. [1]

## Decoder acceptance boundary

| Layer | Required parser output | Hard refusal condition |
|---|---|---|
| Wire format | Exact version, byte length, canonical decode, raw-message hash, and format support status | Unsupported version, invalid compact lengths/indexes, trailing/truncated bytes, non-canonical decode |
| Header and accounts | Fee payer, all signer/writable/read-only roles, static accounts, duplicate detection, account owner/type evidence | Invalid header partitions, unavailable account facts, unknown writable/signer role |
| v0 lookup tables | Lookup-table address, requested indexes, fully resolved writable/readonly accounts, resolved-account hash | ALT unavailable, stale/unmatched resolution, unknown resolved account role |
| Instructions | Program ID, ordered account roles, schema/profile version, discriminator/arguments, user-visible effect | Unknown program, unknown schema, opaque data, unmodelled remaining account, unsupported CPI possibility |
| Token behavior | Mint, decimals, Token or Token-2022 program, account owner, authority/delegate, extensions, gross/net amounts and transfer fee | Mint mismatch, unresolved extension, transfer hook without reviewed effect model, unknown delegate/authority |
| Economic effects | SOL deltas, token deltas, rent/ATA accounts, protocol recipients, protocol fees, base and priority-fee maximum | Any unaccounted debit/credit, fee payer mismatch, fee/recipient unknown |
| Simulation | Matching raw-message hash, cluster, commitment, context slot, logs, compute use, base fee, loaded addresses, pre/post balances, error status | Simulation error, unsupported/unknown inner instruction, unexpected balance effect, stale evidence |

## Message-profile model

The implementation must select one versioned **protocol profile** before parsing. A profile identifies an immutable set of allowed program IDs, program build/IDL or equivalent schema hashes, instruction discriminators, account ordering, signer rules, expected CPI/effect graph, mint/Token-program/extension support, maximum writable accounts, fee recipient rules, unit bounds, and regression vectors. Profiles are additive and versioned. A generic “decode arbitrary Solana transaction” feature is prohibited.

Address lookup tables reduce on-wire address size but the validator resolves them into the effective account list before execution; lookup-table-resolved addresses cannot be signers. The parser must include them in the same review record as static accounts. [2]

## Simulation protocol

1. Build or receive the candidate message only through an approved future client after its route/provider evidence has passed local validation.
2. Decode and hash the exact message. Resolve accounts, Token-program metadata, extensions, and lookup tables at the policy commitment.
3. Simulate the exact current message at the declared commitment. A future implementation may use a replacement blockhash for a **pre-signing analysis**, but it must re-decode/re-fingerprint the new message before any user review.
4. Compare all reported top-level and inner instruction effects, logs, loaded addresses, pre/post SOL balances, pre/post token balances, compute units, and fees against the profile’s bounded expected-effect model.
5. Render the plaintext review payload and bind it to the exact fingerprint, route/provider evidence, simulation slot/commitment, fee recommendation, quote/blockhash expiry, and profile version.
6. Require a user-controlled wallet to independently show and sign only the current exact message. Any change restarts at step 2.
7. After user-initiated submission, observe status until the chosen commitment. Preserve `SUBMITTED`, `FAILED`, `EXPIRED`, and `UNKNOWN` separately from `CONFIRMED`/`FINALIZED`.

`simulateTransaction` is non-broadcasting and can return errors, logs, units consumed, fee, pre/post balances, loaded ALT addresses, and a replacement blockhash. It may return partial/decoded instruction information, so an unparsed response is not sufficient human-review evidence. [3]

## Plain-language review contract

The client should present a short summary first, then full technical disclosure. The summary cannot omit material downside merely because a wallet also displays a signature prompt.

| Review section | Required content |
|---|---|
| Intent | Action class; chain; immutable request ID; exact message and route fingerprint |
| Assets | Input/collateral asset, base-unit and decimal amount, output asset, minimum net receive where applicable, and maximum loss where contingent |
| Costs | Network base fee, priority-fee cap, rent/ATA funding, token transfer fee, protocol fee, tip, and the final fee payer |
| Authorities | Every signer, transfer authority/delegate, program authority, escrow/PDA, account ownership, and additional wallet approval request |
| Program effects | Every invoked program, instruction, writable account grouped by role, CPI/inner effect, recipient, and mint extension/hook |
| Time and validity | Quote expiry, simulation context/commitment, blockhash/last-valid height, profile version, and approval expiry |
| Status warning | “Signing approves this exact message once. Submission is not confirmation. A successful transaction does not guarantee a market outcome, price, or external provider settlement.” |

## Parser safety tests required before any implementation

| Category | Minimum adversarial cases |
|---|---|
| Binary decoding | Truncated/oversized data, non-canonical compact lengths, invalid indices, unknown format/config bits, duplicate accounts, size limits |
| Account roles | Header partition edge cases, fee payer not first signer, unexpected signer, unknown writable account, malformed ALT indexes/resolution |
| Instructions | Program substitution, discriminator collision, unrecognized instruction data, reordered accounts, excess/remaining account, unexpected CPI |
| Tokens | Input/output mint substitution, decimal mismatch, gross/net fee mismatch, permanent delegate, transfer fee, transfer hook, non-transferable/pause/confidential extensions |
| Simulation | Error with misleading logs, missing data, changed blockhash, changed loaded ALT address, mismatched fingerprint, commitment downgrade, unexpected balance delta |
| Lifecycle | Expired quote/blockhash, user rejection, relay acknowledgement without confirmation, `null` status, duplicate submission/retry, status conflict |

## References

[1]: https://solana.com/docs/core/transactions/transaction-structure "Solana — Transaction Structure"
[2]: https://solana.com/docs/core/transactions/versioned-transactions "Solana — Versioned Transactions"
[3]: https://solana.com/docs/rpc/http/simulatetransaction "Solana RPC — simulateTransaction"
