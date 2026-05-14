import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    
    let where = {};
    if (search) {
      where = {
        OR: [
          { nombreApellidos: { contains: search } },
          { imei: { contains: search } },
          { modelo: { contains: search } },
          { dniNif: { contains: search } },
          { telefono: { contains: search } },
        ]
      };
    }

    const reparaciones = await prisma.movilFreeReparacion.findMany({
      where,
      orderBy: {
        numero: 'desc',
      },
    });
    
    return NextResponse.json(reparaciones);
  } catch (error) {
    console.error('Error fetching reparaciones:', error);
    return NextResponse.json({ error: 'Failed to fetch reparaciones' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Bulk import handling
    if (body.bulk && Array.isArray(body.reparaciones)) {
      const result = await prisma.movilFreeReparacion.createMany({
        data: body.reparaciones.map((rep: any) => ({
          numero: Number(rep.numero) || 0,
          nombreApellidos: rep.nombreApellidos || 'Sin nombre',
          direccion: rep.direccion,
          dniNif: rep.dniNif,
          telefono: rep.telefono,
          marca: rep.marca,
          modelo: rep.modelo,
          imei: rep.imei,
          fechaRecepcion: rep.fechaRecepcion,
          observaciones: rep.observaciones,
          motivo: rep.motivo,
          fechaEntrega: rep.fechaEntrega,
          garantia: rep.garantia,
          informe: rep.informe,
          repara: rep.repara,
          costePvd: !isNaN(Number(rep.costePvd)) && rep.costePvd !== null ? Number(rep.costePvd) : null,
          pvp: !isNaN(Number(rep.pvp)) && rep.pvp !== null ? Number(rep.pvp) : null,
        })),
      });
      return NextResponse.json({ success: true, count: result.count });
    }

    // Individual create
    const nuevaReparacion = await prisma.movilFreeReparacion.create({
      data: {
        numero: Number(body.numero) || 0,
        nombreApellidos: body.nombreApellidos,
        direccion: body.direccion,
        dniNif: body.dniNif,
        telefono: body.telefono,
        marca: body.marca,
        modelo: body.modelo,
        imei: body.imei,
        fechaRecepcion: body.fechaRecepcion,
        observaciones: body.observaciones,
        motivo: body.motivo,
        fechaEntrega: body.fechaEntrega,
        garantia: body.garantia,
        informe: body.informe,
        repara: body.repara,
        costePvd: body.costePvd ? Number(body.costePvd) : null,
        pvp: body.pvp ? Number(body.pvp) : null,
      },
    });

    return NextResponse.json(nuevaReparacion);
  } catch (error) {
    console.error('Error creating reparacion:', error);
    return NextResponse.json({ error: 'Failed to create reparacion' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    if (data.numero) data.numero = Number(data.numero);
    if (data.costePvd !== undefined) data.costePvd = data.costePvd ? Number(data.costePvd) : null;
    if (data.pvp !== undefined) data.pvp = data.pvp ? Number(data.pvp) : null;

    const actualizada = await prisma.movilFreeReparacion.update({
      where: { id },
      data,
    });

    return NextResponse.json(actualizada);
  } catch (error) {
    console.error('Error updating reparacion:', error);
    return NextResponse.json({ error: 'Failed to update reparacion' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.movilFreeReparacion.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting reparacion:', error);
    return NextResponse.json({ error: 'Failed to delete reparacion' }, { status: 500 });
  }
}
