const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const volumePath = process.env.SQLITE_VOLUME_PATH; 

if (volumePath) {
    const dbSource = path.join(__dirname, '../prisma/database.sqlite');
    const dbDest = path.join(volumePath, 'database.sqlite');

    if (!fs.existsSync(volumePath)) {
        fs.mkdirSync(volumePath, { recursive: true });
    }

    if (!fs.existsSync(dbDest) || process.env.FORCE_DB_RESET === 'true') {
        console.log(`[Boot] Copiando base de datos inicial desde origen ${dbSource} al volumen persistente ${dbDest}...`);
        try {
            fs.copyFileSync(dbSource, dbDest);
            console.log(`[Boot] Base de datos copiada exitosamente.`);
        } catch (err) {
            console.error(`[Boot] Error al copiar la base de datos:`, err);
        }
    } else {
        console.log(`[Boot] Volumen persistente detectado correctamente en ${dbDest}. Usando datos conservados.`);
    }
} else {
    console.log("[Boot] No se ha detectado SQLITE_VOLUME_PATH de Railway. Usando la base de datos distribuida localmente en ./prisma");
}

// Nivelar la base de datos para que recoja las nuevas tablas (Ej: MonthlyCondition)
console.log('[Boot] Sincronizando modelo de datos (Prisma db push)...');
try {
    // Usamos el entorno actual, para que pille DATABASE_URL que apunte al volumen
    execSync('npx prisma db push --accept-data-loss --skip-generate', { stdio: 'inherit' });
    console.log('[Boot] Sincronización Prisma finalizada con éxito.');
    
    // Correr limpieza de stock cruzado en producción
    console.log('[Boot] Corriendo limpieza de stock cruzado...');
    execSync('node scripts/clean_cross_stock_prod.js', { stdio: 'inherit' });
    console.log('[Boot] Limpieza de stock cruzado finalizada con éxito.');
} catch (e) {
    console.error('[Boot] Error sincronizando bd o limpiando stock:', e.message);
}

const port = process.env.PORT || 3000;

// Configurar tareas Cron automatizadas
const cron = require('node-cron');
console.log('[Boot] Registrando automatizaciones en segundo plano (Cron)...');
// Ejecutar el script el día 1 de cada mes a las 03:00 de la madrugada
cron.schedule('0 3 1 * *', () => {
    console.log('[Cron] Iniciando purga automática y consolidación mensual de trazabilidad...');
    try {
        execSync('npx ts-node scripts/close_tracking.ts', { stdio: 'inherit' });
    } catch (e) {
        console.error('[Cron] Error masivo duranto cierre:', e.message);
    }
});
console.log(`[Boot] Arrancando aplicación Next.js en el puerto ${port} (host: 0.0.0.0)...`);
const nextProcess = spawn('node', ['./node_modules/next/dist/bin/next', 'start', '-p', port, '-H', '0.0.0.0'], { stdio: 'inherit', shell: true });
nextProcess.on('close', (code) => {
    process.exit(code);
});
