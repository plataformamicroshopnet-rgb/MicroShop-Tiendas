import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { getDbPaths } from '@/lib/dbPath';

const prisma = new PrismaClient();

export async function GET() {
  const diagnostics: any = {};
  
  try {
    // 1. Resolve the REAL database path using getDbPaths()
    const { dbPath, walPath, shmPath } = getDbPaths();

    diagnostics.env = {
      DATABASE_URL: process.env.DATABASE_URL,
      SQLITE_VOLUME_PATH: process.env.SQLITE_VOLUME_PATH
    };

    diagnostics.paths = {
      dbPath,
      walPath,
      shmPath
    };

    // 2. File size checks on the REAL database files
    diagnostics.files = {};
    if (fs.existsSync(dbPath)) {
      diagnostics.files.db = { exists: true, size: fs.statSync(dbPath).size };
    } else {
      diagnostics.files.db = { exists: false };
    }

    if (fs.existsSync(walPath)) {
      diagnostics.files.wal = { exists: true, size: fs.statSync(walPath).size };
    } else {
      diagnostics.files.wal = { exists: false };
    }

    if (fs.existsSync(shmPath)) {
      diagnostics.files.shm = { exists: true, size: fs.statSync(shmPath).size };
    } else {
      diagnostics.files.shm = { exists: false };
    }

    // 3. Database Connection and Performance Diagnostics on real DB
    const startCount = Date.now();
    const userCount = await prisma.user.count();
    const saleCount = await prisma.sale.count();
    const periodCount = await prisma.workPeriod.count();
    const catalogCount = await prisma.productCatalog.count();
    diagnostics.queryTimes = {
      basicCountsMs: Date.now() - startCount
    };

    diagnostics.counts = {
      users: userCount,
      sales: saleCount,
      periods: periodCount,
      catalogs: catalogCount
    };

    // 4. Check SQLite integrity and PRAGMA settings on the real DB
    const integrityRes = await prisma.$queryRawUnsafe('PRAGMA integrity_check');
    const journalModeRes = await prisma.$queryRawUnsafe('PRAGMA journal_mode');
    const walCheck = await prisma.$queryRawUnsafe('PRAGMA database_list');
    
    diagnostics.sqlite = {
      integrity: integrityRes,
      journalMode: journalModeRes,
      databaseList: walCheck
    };

    // 5. Try running checkpoint optimization if it is in WAL mode (or check output if it returns results)
    const journalMode = String((journalModeRes as any)[0]?.journal_mode || '').toLowerCase();
    if (journalMode === 'wal') {
      const startCheckpoint = Date.now();
      const cpRes = await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)');
      diagnostics.checkpoint = {
        result: cpRes,
        timeMs: Date.now() - startCheckpoint
      };
      
      // Check sizes again after checkpoint
      diagnostics.filesAfterCheckpoint = {};
      if (fs.existsSync(walPath)) {
        diagnostics.filesAfterCheckpoint.walSize = fs.statSync(walPath).size;
      }
      if (fs.existsSync(shmPath)) {
        diagnostics.filesAfterCheckpoint.shmSize = fs.statSync(shmPath).size;
      }
    }

    diagnostics.success = true;
    return NextResponse.json(diagnostics);

  } catch (e: any) {
    diagnostics.success = false;
    diagnostics.error = String(e);
    diagnostics.stack = e.stack;
    return NextResponse.json(diagnostics, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    fs.writeFileSync('c:/Proyecto Tiendas/MicroShop Tiendas/webapp_snapshot/debug_paste.txt', body.text);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
