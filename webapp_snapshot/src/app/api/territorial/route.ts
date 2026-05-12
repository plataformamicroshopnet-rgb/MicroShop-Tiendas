import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const periodKey = searchParams.get('periodKey');

  if (!periodKey) {
    return NextResponse.json({ success: false, error: 'Falta periodKey' }, { status: 400 });
  }

  try {
    const keyTiendas = `territorial_tiendas_${periodKey}`;
    const keyO2 = `territorial_o2_${periodKey}`;

    const [settingTiendas, settingO2] = await Promise.all([
      prisma.appSetting.findUnique({ where: { key: keyTiendas } }),
      prisma.appSetting.findUnique({ where: { key: keyO2 } })
    ]);

    const tiendasRows = settingTiendas && settingTiendas.value ? JSON.parse(settingTiendas.value) : [];
    const o2Rows = settingO2 && settingO2.value ? JSON.parse(settingO2.value) : [];

    return NextResponse.json({ success: true, tiendas: tiendasRows, o2: o2Rows });
  } catch (error: any) {
    console.error('Error fetching territorial config:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { periodKey, tiendas, o2 } = await request.json();

    if (!periodKey) {
      return NextResponse.json({ success: false, error: 'Falta periodKey' }, { status: 400 });
    }

    const keyTiendas = `territorial_tiendas_${periodKey}`;
    const keyO2 = `territorial_o2_${periodKey}`;

    await prisma.$transaction([
      prisma.appSetting.upsert({
        where: { key: keyTiendas },
        update: { value: JSON.stringify(tiendas) },
        create: { key: keyTiendas, value: JSON.stringify(tiendas) }
      }),
      prisma.appSetting.upsert({
        where: { key: keyO2 },
        update: { value: JSON.stringify(o2) },
        create: { key: keyO2, value: JSON.stringify(o2) }
      })
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error saving territorial config:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
