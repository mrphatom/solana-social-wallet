/**
 * Runtime composition point for the local-only foundation.
 * Live platform adapters, wallet execution, and financial providers are intentionally absent.
 */
console.info(JSON.stringify({ event: 'foundation_started', mode: 'local_only' }))
