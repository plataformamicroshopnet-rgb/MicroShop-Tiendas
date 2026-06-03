import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const diagnostics: any = {};
  
  try {
    // 1. Run Linux system commands
    const runCmd = (cmd: string) => {
      try {
        return execSync(cmd, { encoding: 'utf8', timeout: 5000 });
      } catch (err: any) {
        return `Error running command "${cmd}": ${err.message}`;
      }
    };

    diagnostics.os = process.platform;
    diagnostics.arch = process.arch;
    diagnostics.memoryUsage = process.memoryUsage();
    diagnostics.uptime = process.uptime();

    if (process.platform === 'win32') {
      diagnostics.tasklist = runCmd('tasklist');
      diagnostics.systeminfo = runCmd('systeminfo');
    } else {
      diagnostics.cpuInfo = runCmd('cat /proc/cpuinfo | grep "model name" | head -n 1');
      diagnostics.memInfo = runCmd('free -m');
      diagnostics.diskSpace = runCmd('df -h');
      diagnostics.topProcesses = runCmd('ps aux --sort=-%cpu | head -n 15');
      diagnostics.allProcesses = runCmd('ps aux');
    }

    diagnostics.success = true;
    return NextResponse.json(diagnostics);

  } catch (e: any) {
    diagnostics.success = false;
    diagnostics.error = String(e);
    return NextResponse.json(diagnostics, { status: 500 });
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
