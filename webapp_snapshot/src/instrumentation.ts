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
    const { fixTorneosJulioRescate } = await import('./lib/migrations/torneosJulioRescateFix')
    await fixTorneosJulioRescate()
    const { fixRentColumnas } = await import('./lib/migrations/rentColumnasFix')
    await fixRentColumnas()
    const { fixSeptiembre2026 } = await import('./lib/migrations/septiembre2026Fix')
    await fixSeptiembre2026()
    // El extra del fútbol a 20 €, en la fila que de verdad lee la API de Nueva
    // Venta (la de la mañana era una fila retirada). Va DESPUÉS de septiembre2026Fix
    // a propósito: deshace su paso 1.
    const { fixFutbolSeptiembre2026 } = await import('./lib/migrations/futbolSeptiembre2026Fix')
    await fixFutbolSeptiembre2026()
    // Los objetivos del mes en curso se re-derivan de los objetivos por tienda
    // en CADA arranque: así un despliegue de Tiendas no depende de que el ERP
    // vuelva a publicar para que el Dashboard y el Territorial estén al día.
    const { fixObjetivosAlDia } = await import('./lib/migrations/objetivosAlDiaFix')
    await fixObjetivosAlDia()
  }
}
