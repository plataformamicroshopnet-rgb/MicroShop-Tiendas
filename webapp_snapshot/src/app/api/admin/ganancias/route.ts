import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    
    if (!yearParam) {
      return NextResponse.json({ error: 'Year parameter is required' }, { status: 400 });
    }

    const year = parseInt(yearParam, 10);

    const records = await prisma.macroFinanceRecord.findMany({
      where: { year },
      orderBy: { month: 'asc' }
    });

    return NextResponse.json(records);
  } catch (error: any) {
    console.error('Error fetching macro finance records:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { year, month, field, value } = data;

    if (!year || !month || !field) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Upsert the record for that month and year
    const numValue = parseFloat(value) || 0;

    const record = await prisma.macroFinanceRecord.upsert({
      where: {
        year_month: {
          year: parseInt(year, 10),
          month: parseInt(month, 10)
        }
      },
      update: {
        [field]: numValue
      },
      create: {
        year: parseInt(year, 10),
        month: parseInt(month, 10),
        [field]: numValue
      }
    });

    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    console.error('Error updating macro finance record:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
