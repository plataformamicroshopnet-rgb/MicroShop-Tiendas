import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tienda = searchParams.get('tienda');

    // Mapeo seguro del nombre de la tienda
    let queryTienda = tienda;
    if (tienda === 'O2') queryTienda = 'MovilFree';

    let whereClause = {};
    if (queryTienda) {
      whereClause = { tienda: queryTienda };
    }

    const entries = await prisma.cajaEntry.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Error GET caja:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tienda, fecha, concepto, detalle, importe, vendedor, estadoTrazabilidad } = body;

    let targetTienda = tienda;
    if (targetTienda === 'O2') targetTienda = 'MovilFree';

    const entry = await prisma.cajaEntry.create({
      data: {
        tienda: targetTienda,
        fecha,
        concepto,
        detalle,
        importe: Number(importe),
        vendedor,
        estadoTrazabilidad
      }
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Error POST caja:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    await prisma.cajaEntry.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error DELETE caja:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, estadoTrazabilidad } = body;
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const entry = await prisma.cajaEntry.update({
      where: { id },
      data: { estadoTrazabilidad }
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Error PATCH caja:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

