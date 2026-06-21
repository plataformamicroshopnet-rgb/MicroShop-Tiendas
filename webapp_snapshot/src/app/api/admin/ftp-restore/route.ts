import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import AdmZip from 'adm-zip'
import { downloadFromFTP } from '@/lib/ftpClient'
import { isB2Configured, downloadFromB2 } from '@/lib/b2Client'
import { getDbPaths } from '@/lib/dbPath'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized Access' }, { status: 401 })
    }

    const { fileId } = await req.json()
    if (!fileId) {
      return NextResponse.json({ success: false, error: 'FileId (nombre) no proporcionado.' }, { status: 400 })
    }

    const buffer = isB2Configured() ? await downloadFromB2(fileId) : await downloadFromFTP(fileId)
    
    // Descompresión a Cuarentena
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
      return NextResponse.json({ success: false, error: 'La cápsula ZIP bajada del QNAP no contiene una base de datos válida.' }, { status: 400 })
    }

    const { tempPath } = getDbPaths();

    // FASE 2: VALIDACIÓN PRISMA REPLICANDO EL SISTEMA LOCAL
    const absoluteTempPath = `file:${tempPath.replace(/\\/g, '/')}`
    const tempPrisma = new PrismaClient({
      datasources: { db: { url: absoluteTempPath } }
    })

    try {
      const salesCount = await tempPrisma.sale.count()
      const usersCount = await tempPrisma.user.count()
      const periodsCount = await tempPrisma.workPeriod.count()
      
      await tempPrisma.$disconnect()

      return NextResponse.json({ 
        success: true, 
        message: 'Backup desde QNAP descargado y validado en Cuarentena.',
        stats: { sales: salesCount, users: usersCount, periods: periodsCount }
      })

    } catch (e: any) {
      await tempPrisma.$disconnect()
      await fs.promises.unlink(tempPath).catch(()=>{}) 
      
      if (e.message.includes('Table') || e.code === 'P2021') {
         return NextResponse.json({ success: false, error: 'La base descartada del QNAP es incompatible (Faltan tablas).' }, { status: 400 })
      }
      return NextResponse.json({ success: false, error: `Error Prisma temporal: ${e.message}` }, { status: 400 })
    }

  } catch (err: any) {
    console.error('Error restaurando desde QNAP FTP:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
