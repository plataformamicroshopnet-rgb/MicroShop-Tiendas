import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const res = await prisma.movilFreeClient.deleteMany({
      where: {
        nif: {
          startsWith: 'SIN_NIF'
        }
      }
    });

    return NextResponse.json({ success: true, message: `Borrados ${res.count} clientes sin NIF.` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
