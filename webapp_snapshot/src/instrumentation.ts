export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Parches de datos que corren una vez al arrancar (idempotentes).
    const { runO2AdicionalesFix } = await import('./lib/migrations/o2AdicionalesFix')
    await runO2AdicionalesFix()
  }
}
