# Solana Routing, Simulation, Fee, and Token-Effect Sources

**Retrieved:** 2026-08-27

This record is evidence for an **architecture-only** design. It contains no network configuration, provider choice, quote, address, transaction, signing material, or execution instruction.

## Transaction fee and priority-fee evidence

Solana’s published fee model separates a base fee from an optional prioritization fee. For legacy and v0 transactions, the prioritization fee is calculated from a compute-unit price and compute-unit limit; the current core-fee documentation expresses the resulting fee as `ceil(compute_unit_price × compute_unit_limit / 1,000,000)` lamports. The documentation also gives a 1,400,000 compute-unit transaction maximum and explains that a prioritization fee can increase scheduling likelihood, not guarantee inclusion or settlement. [1]

The `getRecentPrioritizationFees` RPC method returns historical samples containing a slot and an observed prioritization fee. A request may be restricted to transactions that lock selected addresses writable, and a node cache may cover up to 150 blocks. This makes the response contextual and short-lived evidence, rather than a cost guarantee or authority to alter a reviewed transaction. [2]

## Simulation and message-format evidence

`simulateTransaction` executes against chain data at the requested commitment without broadcasting. Its response may include an error, logs, consumed compute units, fee, pre/post SOL and token balances, loaded ALT addresses, and a replacement blockhash when configured. `replaceRecentBlockhash` conflicts with signature verification, so a replacement-blockhash simulation is pre-signing evidence and must not be represented as a verification of a future signed wire transaction. [3]

Solana currently documents legacy, v0, and v1 transaction formats. v0 introduces address lookup tables, resolved accounts are part of the effective account list at execution, and lookup-table addresses cannot be signers. The v1 activation note states it is not yet active on a cluster at the retrieval date. Its config places resource limits and total priority fee in the signed message instead of Compute Budget instructions. Therefore a production decoder must version-gate its parser and fail closed on an unsupported transaction version or config field. [4]

`getFeeForMessage` returns the fee for a supplied serialized legacy or v0 message at a requested commitment and returns `null` if the message blockhash is no longer valid. It is therefore an estimate bound to a specific message and validity window, not a standing approval to substitute fee payer, instructions, addresses, route, or recent blockhash. [9]

`sendTransaction` accepts a fully signed transaction and returns when the RPC service accepts the relay; it does not wait for a cluster confirmation. The official reference says its default preflight verifies signatures and simulates, and advises aligning preflight commitment with the desired commitment. A user-facing service must preserve distinct built, simulated, approval-pending, signed, submitted, confirmed, failed, expired, and unknown states. [10]

`getSignatureStatuses` can return a current processed, confirmed, or finalized status, an error, or no status. Unless the request enables transaction-history search, lookup is limited to the node’s recent status cache. `isBlockhashValid` returns whether a particular blockhash remains valid at the evaluated commitment. A routed request that crosses its blockhash/quote/review deadline must restart at route validation and simulation; it cannot reuse an old approval. [11] [12]

## Token effect evidence

Solana describes mint accounts as holding metadata including decimal precision, and token accounts as holding a mint, transfer authority, and integer token amount. Associated token accounts are deterministic token-account addresses derived from owner and mint, but their creation can require a payer-funded refundable account balance. A wallet review must therefore disclose any ATA creation and its payer rather than reducing it to an unexplained routing detail. [5]

Token-2022 extensions are optional and can change token behavior. The official extension list includes transfer-fee configuration, permanent delegate, transfer hooks, non-transferability, pausable behavior, and confidential transfer variants. Route validation must require explicit parser coverage and policy admission for every observed extension; otherwise it must refuse the route. [6]

The Token-2022 transfer-fee extension reduces a transfer by a configured fee and withholds that fee on the destination token account. A quoted gross amount must therefore not be presented as an expected net receive amount without independently validating the mint’s current applicable transfer-fee configuration. [7]

The Token-2022 transfer-hook extension causes the token program to invoke custom logic for each transfer. The transaction parser must resolve and disclose the hook program and extra accounts, and a policy should reject hooks without a specifically reviewed program and effect model. [8]

## Staking-interface evidence

Solana describes stake accounts as distinct from system accounts and identifies separate stake and withdraw authorities. The stake authority can delegate, deactivate, split, merge, or change stake authority; the withdraw authority can withdraw undelegated stake and change both authorities. Delegation/deactivation transitions are not immediate and their duration can vary with epoch-level network conditions. A safe interface must therefore model account authority, activation state, lockup, and delayed withdrawal rather than presenting stake as an immediately liquid wallet balance. [13]

The Solana staking reference explicitly does not recommend a particular validator and describes delegation as a shared-risk/shared-reward model. The portfolio interface must not rank or recommend validators, predict yield, or imply a certain reward. [14]

## References

[1]: https://solana.com/docs/core/fees "Solana — Fees"
[2]: https://solana.com/docs/rpc/http/getrecentprioritizationfees "Solana RPC — getRecentPrioritizationFees"
[3]: https://solana.com/docs/rpc/http/simulatetransaction "Solana RPC — simulateTransaction"
[4]: https://solana.com/docs/core/transactions/versioned-transactions "Solana — Versioned Transactions"
[5]: https://solana.com/docs/tokens "Solana — Assets on Solana"
[6]: https://solana.com/docs/tokens/extensions "Solana — Token Extensions"
[7]: https://solana.com/docs/tokens/extensions/transfer-fees "Solana — Transfer Fees"
[8]: https://solana.com/docs/tokens/extensions/transfer-hook "Solana — Transfer Hook"
[9]: https://solana.com/docs/rpc/http/getfeeformessage "Solana RPC — getFeeForMessage"
[10]: https://solana.com/docs/rpc/http/sendtransaction "Solana RPC — sendTransaction"
[11]: https://solana.com/docs/rpc/http/getsignaturestatuses "Solana RPC — getSignatureStatuses"
[12]: https://solana.com/docs/rpc/http/isblockhashvalid "Solana RPC — isBlockhashValid"
[13]: https://solana.com/docs/references/staking/stake-accounts "Solana — Stake Accounts"
[14]: https://solana.com/docs/references/staking "Solana — Staking"
