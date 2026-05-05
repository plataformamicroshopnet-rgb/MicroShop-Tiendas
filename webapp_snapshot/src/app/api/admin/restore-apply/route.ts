import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { getDbPaths } from '@/lib/dbPath'

export async function POST(req: Request) {
  const prisma = new PrismaClient()
  try {
    const session = await getSession()
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized Access' }, { status: 401 })
    }

    const body = await req.json()
    if (body.confirm !== 'RESTAURAR') {
      return NextResponse.json({ success: false, error: 'Confirmación inválida o ausente' }, { status: 400 })
    }

    const { dbPath, tempPath, backupPath } = getDbPaths();

    if (!fs.existsSync(tempPath)) {
      return NextResponse.json({ success: false, error: 'No hay ningún backup en cuarentena (temp_restore.sqlite) preparado.' }, { status: 400 })
    }

    // APLICACIÓN NUCLEAR (FASE 3)
    // 1. Matamos los conectores Rust corriendo debajo de prisma y vaciamos el pool 
    await prisma.$disconnect()
    
    // Forzar muerte del singleton global de Prisma en entorno de Desarrollo (Evita error EBUSY en Windows)
    const globalForPrisma = global as any
    if (globalForPrisma.prisma) {
       await globalForPrisma.prisma.$disconnect()
    }

    // Manejador blindado para Windows y Hot-Reloads: Prisma JAMÁS suelta el file desc. en Win
    // por lo que rename() peta. Escribir bytes sobre el fichero no peta.
    const safeOverwrite = async (sourcePath: string, targetPath: string, backupPath: string, isWal = false) => {
      if (fs.existsSync(targetPath)) {
        if (!isWal) {
          // Copiamos el de prod al backup para retener old bytes
          const dBase = await fs.promises.readFile(targetPath)
          await fs.promises.writeFile(backupPath, dBase)
        } else {
          // Para wal/shm de la bd anterior, intentamos borrarlos si Next/Prisma nos deja
          await fs.promises.unlink(targetPath).catch(() => {})
        }
      }
      // Reemplazamos leyendo la cuarentena e inyectando binariamente en destino (salta EBUSY Windows)
      if (fs.existsSync(sourcePath)) {
         const newBytes = await fs.promises.readFile(sourcePath)
         await fs.promises.writeFile(targetPath, newBytes)
         await fs.promises.unlink(sourcePath).catch(()=>{}) // Limpiamos la cuarentena
      }
    }

    // 2. Rotamos y sobrescribimos con los bytes
    await safeOverwrite(tempPath, dbPath, backupPath, false);
    await safeOverwrite(tempPath + '-wal', dbPath + '-wal', '', true);
    await safeOverwrite(tempPath + '-shm', dbPath + '-shm', '', true);

    // 4. Forzar que Node y Prisma repiolte el motor de nuevo
    const reconnectPrisma = new PrismaClient()
    await reconnectPrisma.user.findFirst() // Llamada dummy que reinicializa el pool

    return NextResponse.json({ 
      success: true, 
      message: 'Restauración completada estelarmente. La base de datos ha sido purgada.',
      instructions: 'Es extremadamente recomendable reiniciar el servidor de Node (PM2 / Vercel / Railway) para asegurar limpieza de memoria.'
    })

  } catch (err: any) {
    console.error('CRITICAL RESTORE ERROR:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
