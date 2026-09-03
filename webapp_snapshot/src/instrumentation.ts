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
    // Los «X» de la pestaña Repos (Arpu) de septiembre venían clonados de agosto
    // (×2 / ×1,5); la tabla del mes es ×1,25 desde 35 € y ×1 por debajo. Va
    // después de septiembre2026Fix porque lee la tabla que aquella guarda.
    const { fixReposArpuSeptiembre2026 } = await import('./lib/migrations/reposArpuSeptiembre2026Fix')
    await fixReposArpuSeptiembre2026()
    // Los objetivos del mes en curso se re-derivan de los objetivos por tienda
    // en CADA arranque: así un despliegue de Tiendas no depende de que el ERP
    // vuelva a publicar para que el Dashboard y el Territorial estén al día.
    const { fixObjetivosAlDia } = await import('./lib/migrations/objetivosAlDiaFix')
    await fixObjetivosAlDia()
    // Las PROMO VODAFONE de junio y julio, como las pidió el dueño el 03-sep-2026
    // para que Gabriel pueda rectificar esas ventas: corrige la fila mal tecleada
    // del 01/09 y añade las que faltan, sin borrar nada (meses cerrados).
    const { fixPromosVodafoneJunioJulio } = await import('./lib/migrations/promosVodafoneJunioJulioFix')
    await fixPromosVodafoneJunioJulio()
  }
}
