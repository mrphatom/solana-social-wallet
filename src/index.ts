/**
 * Runtime composition point for the local-only foundation. This entrypoint
 * deliberately fails closed: no provider adapter is constructed without secure,
 * separately approved platform configuration and a production persistence adapter.
 */
console.info(
  JSON.stringify({
    event: 'foundation_started',
    mode: 'local_only',
    liveDiscord: 'not_configured',
    liveTelegram: 'not_configured',
    walletSigning: 'not_implemented',
    financialCapabilities: 'disabled'
  })
)
