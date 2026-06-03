import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  const diagnostics: any = {};
  
  try {
    const dbDir = path.join(process.cwd(), 'prisma');
    const dbPath = path.join(dbDir, 'database.sqlite');
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';

    diagnostics.paths = {
      dbPath,
      walPath,
      shmPath
    };

    // 1. File size checks
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

    // 2. Database Connection and Performance Diagnostics
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

    // 3. Check SQLite integrity and PRAGMA settings
    const integrityRes = await prisma.$queryRawUnsafe('PRAGMA integrity_check');
    const journalModeRes = await prisma.$queryRawUnsafe('PRAGMA journal_mode');
    
    diagnostics.sqlite = {
      integrity: integrityRes,
      journalMode: journalModeRes
    };

    // 4. Force Checkpoint & Clean WAL to resolve any deadlock or lock bloating
    const startCheckpoint = Date.now();
    await prisma.$executeRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)');
    diagnostics.checkpointTimeMs = Date.now() - startCheckpoint;
    
    // Check sizes again after checkpoint
    diagnostics.filesAfterCheckpoint = {};
    if (fs.existsSync(walPath)) {
      diagnostics.filesAfterCheckpoint.walSize = fs.statSync(walPath).size;
    }
    if (fs.existsSync(shmPath)) {
      diagnostics.filesAfterCheckpoint.shmSize = fs.statSync(shmPath).size;
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
