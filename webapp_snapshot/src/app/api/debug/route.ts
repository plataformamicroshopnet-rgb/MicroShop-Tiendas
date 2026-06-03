import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const diagnostics: any = {};
  let prisma;

  try {
    prisma = new PrismaClient();
    diagnostics.env = {
      DATABASE_URL: process.env.DATABASE_URL,
      SQLITE_VOLUME_PATH: process.env.SQLITE_VOLUME_PATH,
      PORT: process.env.PORT
    };

    // Attempt to manually resolve db path from DATABASE_URL
    let dbPath = path.join(process.cwd(), 'prisma', 'database.sqlite');
    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl.startsWith('file:')) {
      const p = dbUrl.replace('file:', '');
      if (path.isAbsolute(p)) {
        dbPath = p;
      } else {
        dbPath = path.join(process.cwd(), 'prisma', p);
      }
    }

    diagnostics.resolvedPath = dbPath;
    diagnostics.fileExists = fs.existsSync(dbPath);
    if (diagnostics.fileExists) {
      diagnostics.fileSize = fs.statSync(dbPath).size;
    }

    const start = Date.now();
    diagnostics.saleCount = await prisma.sale.count();
    diagnostics.queryTimeMs = Date.now() - start;
    diagnostics.success = true;
    
    return NextResponse.json(diagnostics);

  } catch (e: any) {
    diagnostics.success = false;
    diagnostics.error = String(e);
    diagnostics.stack = e.stack;
    return NextResponse.json(diagnostics, { status: 500 });
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
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
