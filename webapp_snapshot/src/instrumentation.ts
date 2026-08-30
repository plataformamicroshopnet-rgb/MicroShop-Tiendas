export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Parches de datos que corren una vez al arrancar (idempotentes).
    const { runO2AdicionalesFix } = await import('./lib/migrations/o2AdicionalesFix')
    await runO2AdicionalesFix()
    const { fixTerritorialJulio } = await import('./lib/migrations/territorialJulioFix')
    await fixTerritorialJulio()
    const { fixTorneoPctMin } = await import('./lib/migrations/torneoPctMinFix')
    await fixTorneoPctMin()
    const { fixTorneoGates } = await import('./lib/migrations/torneoGatesFix')
    await fixTorneoGates()
    const { fixTorneoLegacyPct } = await import('./lib/migrations/torneoLegacyPctFix')
    await fixTorneoLegacyPct()
    const { fixNetflixRename } = await import('./lib/migrations/netflixRenameFix')
    await fixNetflixRename()
    const { fixTiContratosListaLimpia } = await import('./lib/migrations/tiContratosListaLimpiaFix')
    await fixTiContratosListaLimpia()
    const { fixTiContratosRetag } = await import('./lib/migrations/tiContratosRetagFix')
    await fixTiContratosRetag()
    const { fixTiContratosOrden } = await import('./lib/migrations/tiContratosOrdenFix')
    await fixTiContratosOrden()
  }
}
