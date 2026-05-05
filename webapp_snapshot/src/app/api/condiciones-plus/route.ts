import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()
const BASE_SETTING_KEY = 'condiciones_plus_data'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const periodKey = url.searchParams.get('periodKey');
    const legacyOnly = url.searchParams.get('legacyOnly') === '1';
    const strictPeriod = url.searchParams.get('strictPeriod') === '1';

    let targetKey = BASE_SETTING_KEY;

    if (strictPeriod && periodKey) {
        targetKey = `${BASE_SETTING_KEY}_${periodKey}`;
    }

    const setting = await prisma.appSetting.findUnique({
      where: { key: targetKey }
    });
    
    if (setting && setting.value) {
      return NextResponse.json(JSON.parse(setting.value));
    }
    
    // Si no encontró nada y estábamos pidiendo strict, retornamos vacío (para clonar/llenar).
    // Si era legacy o fallback global y no ha sido inicializado antes, devolvemos vacío también.
    return NextResponse.json({ columns: [], rows: [] });
  } catch (error) {
    console.error('Error fetching condiciones plus:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const periodKey = url.searchParams.get('periodKey');
    
    if (!periodKey) {
       return NextResponse.json({ error: 'periodKey is required for saving configuration' }, { status: 400 });
    }

    // Verify it's not historic
    const wp = await prisma.workPeriod.findUnique({ where: { period_key: periodKey } });
    if (!wp) return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    if (wp.status === 'HISTORIC') return NextResponse.json({ error: 'Period is HISTORIC. Read-only.' }, { status: 403 });

    const payload = await request.json() // Expects { columns: [...], rows: [...] }
    const targetKey = `${BASE_SETTING_KEY}_${periodKey}`;

    await prisma.appSetting.upsert({
      where: { key: targetKey },
      update: { value: JSON.stringify(payload) },
      create: { key: targetKey, value: JSON.stringify(payload) }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving condiciones plus:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
