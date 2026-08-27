# Non-Custodial Solana Key Architecture

## Decision summary

Solana Social Wallet must operate as a **chat control plane**, not as a key custodian. Discord, Telegram, the bot service, the shared-account database, audit logs, support tooling, queue workers, and analytics must be unable to generate, receive, derive, persist, transmit, log, export, or use a user's Solana private key, seed, mnemonic, recovery phrase, or signing capability.

The supported production path is an **external user-controlled wallet** that owns the Solana key and approves each request. A first-party companion signer is a future, separately authorized product. It may be introduced only as a native client with its own reviewed recovery, encrypted storage, device-management, and independent security-assessment program. A browser/PWA software vault is not approved for real-value custody.

> **Hard boundary:** A chat identity proves that a user may access a shared social account. It does not prove authority to spend from a Solana address. Wallet control is proven separately, through a short-lived, audience-bound signing challenge and verified by the service. A wallet-control proof never authorizes a transfer.

## Trust zones

| Zone | Holds private key or recovery material? | May create an intent? | May sign a transaction? | May submit a signed transaction? |
| --- | --- | --- | --- | --- |
| Discord / Telegram client and platform | Never. | Can express bounded user commands. | Never. | Never. |
| Social-wallet bot service and database | Never. | Yes, after identity/recipient policy. | Never. | Never by default. |
| Bot operator, logs, support tools, queues, analytics | Never. | No direct authority. | Never. | Never. |
| External Solana wallet | Owns the user's key under its own policy. | Can receive an immutable request. | Yes, after wallet-user approval. | Yes, directly to an allowlisted RPC under user control. |
| Future native companion signer | Owns a user key only on the local device. | Can fetch a user-authorized request. | Yes, after local review/unlock. | Yes, directly to an allowlisted RPC. |
| Service-owned fee/treasury key, if ever approved | Not part of the user-wallet design. | Not applicable. | Only from dedicated HSM/KMS/managed-signing infrastructure. | Only under a separately reviewed service policy. |

Solana describes browser wallets as an end-user per-transaction signing approach, while KMS/HSM and managed signing are distinct options for server-owned operations.[1] This architecture keeps those ownership models separate. A social bot is never upgraded into a signing service merely by adding an environment variable or a chat command.

## Key lifecycle

### External-wallet path — accepted production default

The user selects a compatible wallet they already control. The social-wallet product does not create, import, export, back up, or recover the user's key. At account attachment, the service issues a single-use wallet-control challenge. The wallet signs the authentication challenge only after the wallet's own user interface describes it as an off-chain proof. The service verifies the returned public address, signed bytes, signature, nonce, domain/audience, issued time, expiration, request ID, and account binding before recording only the public address and verification metadata.

The Sign In With Solana specification provides an interoperable model for a wallet-control message with domain, address, nonce, issue/expiry time, and request ID, and specifies server-side verification against the original input.[2] The challenge must be unrelated to an asset transfer and must contain a clear statement such as **“Prove control of this wallet for Solana Social Wallet. This does not approve a transaction or cost network fees.”**

| Lifecycle event | User-controlled wallet behavior | Service behavior | Prohibited behavior |
| --- | --- | --- | --- |
| Attach wallet | User selects account and approves a wallet-control challenge. | Records address, challenge ID hash, verification time, issuer, expiry, and protocol version. | Storing signature bytes as a reusable login token; accepting an address without proof. |
| Spend request | User opens a trusted wallet/deep-link/companion view. | Returns immutable, recipient-bound intent details. | Asking Discord/Telegram to sign arbitrary bytes; using the prior auth signature as spend authority. |
| Rotate/revoke | User proves control from the active wallet or a separately reviewed recovery path. | Revokes the old binding and invalidates active wallet sessions. | Silent address replacement from chat input. |
| Disconnect | User confirms removal in the wallet channel and chat account channel. | Makes binding unavailable for new intents and audits the event. | Deleting evidence needed for a security review. |

### Future companion-wallet path — deferred and gated

A first-party signer must be a dedicated, independently versioned native client. It must not be implemented inside a Discord/Telegram bot, a web worker, a generic browser extension, or a server process. It must use an audited Solana wallet library and the operating system's cryptographically secure random-number generator to create local Ed25519 seed material. Solana's documentation notes that a raw keypair contains private key material and must never be embedded in client code or committed to source control.[3]

The companion product must use one versioned, interoperable recovery standard selected in its own ADR. It must never invent a proprietary phrase format, derivation path, checksum, seed serialization, or random-number routine. The candidate recovery format, account derivation rules, account-index UX, and migration policy remain deliberate future decisions because they determine user recovery compatibility and cannot be changed safely after assets are stored.

## Local secret-storage model for a future companion signer

The companion signer needs two independent protections: a **portable recovery route** controlled by the user and a **device-local encrypted envelope** used for everyday signing. The recovery route exists because local device storage can be deleted, corrupted, or unavailable; the device envelope exists because users should not repeatedly type a recovery phrase into a device they use daily.

| Material | Generation / source | Storage location | Export policy | Use policy |
| --- | --- | --- | --- | --- |
| Solana Ed25519 seed/private material | Audited local wallet library backed by the platform CSPRNG. | Only transiently in the native signer process; then inside encrypted local envelope. | Never through bot, logs, analytics, URLs, clipboard defaults, or cloud backup. | Sign only a reviewed Solana message after explicit local approval. |
| Recovery phrase or equivalent recovery secret | Same local creation ceremony. | User-owned offline backup; never sent to service. | Shown once in a protected creation/recovery flow; require acknowledgement and optional offline verification. | Used only in isolated local restore flow. |
| Data-encryption key (DEK) | Fresh random symmetric key per vault envelope. | Encrypted/wrapped locally; never uploaded. | Non-exportable where platform supports it. | Encrypt/decrypt local secret envelope only. |
| Device wrapping key | Native keystore/keychain generated or password-derived key-encryption key. | Android Keystore / iOS Keychain, with device-attestation metadata when applicable. | Never export from hardware-backed store; a software fallback must be labeled clearly. | Wrap/unwrap the DEK after local user authentication. |
| Wallet-control challenge nonce | Service CSPRNG; single use. | Hashed server-side record with expiry. | No need to expose after verification. | Bind one proof to one account, audience, and session creation. |
| Public address and device metadata | Derived public data. | Service database and client. | Public address can be displayed; device metadata is minimized. | Recipient display and authorization binding only. |

### Envelope construction requirements

The native signer creates a fresh random symmetric DEK and encrypts the seed/private material with an authenticated-encryption construction from a maintained, audited cryptographic library. It then wraps the DEK through the platform's protected key facility, preferably after local user authentication. A device password may be used to derive a second wrapping key through a memory-hard, parameterized KDF, but the KDF parameters must be calibrated and versioned per client release; never hard-code a guess as a security claim.

The persisted record must include only versioned non-secret envelope metadata: envelope format version, KDF/wrapping algorithm identifier, salt/nonce, ciphertext, authenticated metadata, creation/update timestamps, and device/key-protection classification. It must omit private material, recovery words, passwords, plaintext account derivation path, and signing history. Authenticated metadata must bind the envelope to a wallet identifier, application identifier, and format version so that a ciphertext cannot be swapped across an account or product context.

Native device facilities can meaningfully improve protection but do not eliminate compromise risk. Android Keystore keys are non-exportable and can constrain use to an authenticated user; the security level must be checked rather than assumed.[4] Apple documents that Secure Enclave keys are isolated but are limited to P-256, so the design must **not** claim that Secure Enclave directly stores a Solana Ed25519 key.[5] On iOS, use Keychain access controls to protect an encrypted Solana seed envelope, or an externally controlled signer, until a separately validated Ed25519-compatible approach is selected. On the web, a non-extractable Web Crypto `CryptoKey` blocks Web Crypto export operations but is not evidence of secure-hardware isolation or safety against browser/process compromise.[6]

### Device-level policy

The companion must require fresh local user presence for every value-moving signature. Biometric or device-passcode checks can unlock a wrapping key but do not replace transaction review. A successful biometric prompt must authorize at most one explicit signing operation or a short, documented session for non-financial reads; it must never silently authorize arbitrary future signing.

If the user adds a device, that device must independently establish wallet control or complete an existing recovery flow; copying the encrypted envelope through chat, cloud sync, email, QR, clipboard, or an unencrypted export is forbidden. If the old device is available, device transfer must encrypt end-to-end using a short-lived, user-visible pairing ceremony and receive a separate security design and audit. It is not part of this architecture release.

## Recovery and loss policy

Recovery is a user-controlled, high-risk ceremony. A recovery phrase cannot be “reset” by the bot, Discord, Telegram, support staff, or an email/account-recovery flow. Account recovery can restore social-account access but must not create authority over a linked wallet. Wallet recovery restores a wallet from user-held recovery material but must not silently rebind the wallet to a different social account.

| Situation | Safe behavior | Unsafe behavior |
| --- | --- | --- |
| User loses chat account | Use platform and social-account recovery; suspend new bot intents while the account link is disputed. | Treat chat access alone as wallet ownership. |
| User loses device but has recovery material | Restore only in a locally protected signer, prove wallet control again, and require explicit reattachment. | Ask user to send recovery words to a bot, support agent, form, or email. |
| User forgets wallet password but has no recovery material | Explain that no service recovery route exists for a non-custodial wallet. | Create a backdoor, custody copy, or password escrow. |
| User suspects key/device compromise | Immediately revoke bot wallet sessions/bindings, stop new intents, and route the user to an external-wallet or companion emergency-move procedure. | Claim that unlinking the bot secures on-chain assets. |

## Security invariants

1. **No bot-held key authority.** No social-wallet process can call a signing API with user seed material or a user signing key handle.
2. **Control proof is not spend consent.** SIWS-style proofs authenticate wallet control only; every transaction needs its own fresh local approval.
3. **Exact message binding.** A signer must approve bytes generated from the same immutable intent version and transaction fingerprint shown to the user. Any recipient, amount, program, fee payer, instruction, network, blockhash lifetime, or writable-account change invalidates approval and requires a new review.
4. **User-visible provenance.** The approval UI shows the verified social recipient context and full destination address, but treats the address as the cryptographic target.
5. **No arbitrary signing.** The client permits only allowlisted message types: a domain-bound wallet-control proof and a narrowly parsed Solana transfer transaction. Blind `signMessage`, blind `signAllTransactions`, arbitrary program IDs, serialized blobs, and undisclosed token approvals remain disabled.
6. **Freshness and replay resistance.** Authentication challenges and transaction approval requests are single-use, bounded by expiry, audience, device/session, account, and intent version. Wallet sessions are short-lived and revocable.
7. **Fail closed.** Missing recipient verification, stale/mismatched intent hash, unsupported wallet capability, expired blockhash, unavailable simulation, unclear fee payer, unexpected writable account, or uncertain network status prevents signing.
8. **Data minimization.** The service persists public address bindings and minimal security metadata only; it never persists recovery material, keys, decrypted transaction payloads, wallet signatures as sessions, or raw bot message contents.

## Approved implementation gates

No code may generate a user key, parse a recovery phrase, derive a wallet, link Wallet Standard/MWA, invoke a local signing API, or transmit a signed transaction until all gates below are satisfied.

| Gate | Evidence required |
| --- | --- |
| Product choice | A user decision identifies whether the product uses external wallets only or funds an independently reviewed native companion signer. |
| Threat model | Updated abuse cases cover device theft, malware, social-platform takeover, transaction substitution, recovery phishing, replay, deep-link hijack, malicious RPC, and supply-chain compromise. |
| Cryptography | Independent cryptography/security review confirms selected audited libraries, seed/recovery standard, KDF/envelope parameters, key lifecycle, and secure-deletion limits. |
| Platform | Supported iOS/Android/browser matrix explicitly labels hardware-backed, protected software, unavailable, and external-wallet paths. |
| Transaction policy | Allowed program IDs, network, instruction set, token model, recipient classification, fee policy, simulation commitment, confirmation commitment, and retry behavior are signed off. |
| Operations | Verified build provenance, dependency policy, secret store, device-revocation model, incident process, logging exclusions, rate limits, monitoring, and rollback plan are approved. |
| Validation | Security-focused tests, tamper/replay cases, static scans, adversarial review, and testnet usability checks pass before any funded or production environment. |

## References

[1]: https://solana.com/docs/core/transactions/signing-in-production "Solana: Signing in Production"
[2]: https://github.com/phantom/sign-in-with-solana "Sign In With Solana specification"
[3]: https://solana.com/developers/cookbook/wallets/create-keypair "Solana Cookbook: How to Create a Keypair"
[4]: https://developer.android.com/privacy-and-security/keystore "Android Developers: Android Keystore system"
[5]: https://developer.apple.com/documentation/security/protecting-keys-with-the-secure-enclave "Apple: Protecting keys with the Secure Enclave"
[6]: https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey/extractable "MDN: CryptoKey extractable"
