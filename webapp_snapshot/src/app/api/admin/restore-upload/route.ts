import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { getDbPaths } from '@/lib/dbPath'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized Access' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'Archivo no proporcionado.' }, { status: 400 })
    }

    if (!file.name.endsWith('.sqlite') && !file.name.endsWith('.db') && !file.name.endsWith('.zip')) {
      return NextResponse.json({ success: false, error: 'Extensión inválida. Usa .zip o .sqlite' }, { status: 400 })
    }

    // 50 MB limit
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'Archivo demasiado grande (Máx 50MB).' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Guardado en Cuarentena según formato
    const isZip = file.name.endsWith('.zip')
    
    if (isZip) {
      const AdmZip = (await import('adm-zip')).default
      const zip = new AdmZip(buffer)
      let foundMainDb = false
      
      for (const entry of zip.getEntries()) {
        const ext = entry.entryName
        const targetPath = ext === 'database.sqlite' ? 'temp_restore.sqlite' : 
                           ext === 'database.sqlite-wal' ? 'temp_restore.sqlite-wal' : 
                           ext === 'database.sqlite-shm' ? 'temp_restore.sqlite-shm' : null
        
        const { dbDir } = getDbPaths();
        if (targetPath) {
          await fs.promises.writeFile(path.join(dbDir, targetPath), entry.getData())
          if (ext === 'database.sqlite') foundMainDb = true
        }
      }
      
      if (!foundMainDb) {
        return NextResponse.json({ success: false, error: 'El archivo ZIP no contiene un database.sqlite válido.' }, { status: 400 })
      }
    } else {
      // Legacy sqlite file upload sin WAL
      const header = buffer.subarray(0, 16).toString('utf-8')
      if (!header.startsWith('SQLite format 3')) {
        return NextResponse.json({ success: false, error: 'El archivo está corrupto o no es una base SQLite real (Fallo de Cabecera Binaria).' }, { status: 400 })
      }
      const { tempPath, tempWalPath, tempShmPath } = getDbPaths();
      await fs.promises.writeFile(tempPath, buffer)
      // Purgar vestigios previos de WAL en la cuarentena para evitar colisiones
      await fs.promises.unlink(tempWalPath).catch(()=>{})
      await fs.promises.unlink(tempShmPath).catch(()=>{})
    }

    const { tempPath } = getDbPaths();

    // FASE 2: VALIDACIÓN TEMPRANA CON PRISMA
    // Inyectamos un string absoluto usando prisma:// o file:
    // CUIDADO: Prisma resuelve URLs relativas desde el esquema, por seguridad inyectamos con path absoluto convertido
    const absoluteTempPath = `file:${tempPath.replace(/\\/g, '/')}`
    const tempPrisma = new PrismaClient({
      datasources: { db: { url: absoluteTempPath } }
    })

    try {
      // Intentamos contar tablas clave para asegurar estrcuturas compatibles
      const salesCount = await tempPrisma.sale.count()
      const usersCount = await tempPrisma.user.count()
      const periodsCount = await tempPrisma.workPeriod.count()
      
      await tempPrisma.$disconnect()

      return NextResponse.json({ 
        success: true, 
        message: 'Backup subido correctamente, pendiente de aplicar',
        stats: { sales: salesCount, users: usersCount, periods: periodsCount }
      })

    } catch (e: any) {
      // Las tablas no cuadran o no se pudo abrir
      await tempPrisma.$disconnect()
      await fs.promises.unlink(tempPath).catch(()=>{}) // Cleanup fallido
      
      if (e.message.includes('Table') || e.code === 'P2021') {
         return NextResponse.json({ success: false, error: 'La base de datos subida no es compatible. Faltan tablas críticas como Sale o User.' }, { status: 400 })
      }
      return NextResponse.json({ success: false, error: `Error de compatibilidad Prisma: ${e.message}` }, { status: 400 })
    }

  } catch (err: any) {
    console.error('Error subiendo backup:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
