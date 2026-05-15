import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSession } from '@/lib/auth';
import { canEdit } from '@/lib/permissions';

const prisma = new PrismaClient();



export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const queryPeriodKey = url.searchParams.get('periodKey');
    const legacyOnly = url.searchParams.get('legacyOnly') === '1';

    let data: any[] = [];
    let titulo: string | null = null;

    if (legacyOnly) {
      // Find the most recent records from ANY period as a template
      const lastRecord = await prisma.comisionFFVVTienda.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      if (lastRecord) {
        data = await prisma.comisionFFVVTienda.findMany({
          where: { periodKey: lastRecord.periodKey },
          orderBy: { createdAt: 'asc' }
        });
      }
    } else if (queryPeriodKey) {
      data = await prisma.comisionFFVVTienda.findMany({
        where: { periodKey: queryPeriodKey },
        orderBy: { createdAt: 'asc' }
      });
      const metadata = await prisma.comisionMetadata.findUnique({
        where: { periodKey: queryPeriodKey }
      });
      if (metadata) titulo = metadata.titulo;
    }

    return NextResponse.json({ success: true, data, titulo });
  } catch (error: any) {
    console.error('GET /api/comisiones-ffvv-v3 error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession()
    if (!session || !canEdit(session.user, 'MODULE_LIQUIDACION')) {
      return NextResponse.json({ success: false, error: 'No autorizado / Solo Lectura' }, { status: 403 })
    }

    const url = new URL(request.url);
    const periodKey = url.searchParams.get('periodKey');
    if (!periodKey) return NextResponse.json({ success: false, error: 'Falta periodKey' }, { status: 400 });

    const body = await request.json();

    if (!body || !body.operations || !Array.isArray(body.operations)) {
       return NextResponse.json({ success: false, error: 'Faltan datos' }, { status: 400 });
    }

    const deleteOperation = body.deletions && body.deletions.length > 0 
        ? [prisma.comisionFFVVTienda.deleteMany({ where: { id: { in: body.deletions } } })] 
        : []
        
    const metadataUpsert = prisma.comisionMetadata.upsert({
        where: { periodKey },
        update: { titulo: body.titulo },
        create: { periodKey, titulo: body.titulo }
    });

    const upsertOperations = body.operations.map((item: any) => {
        if (item.id && !item.id.startsWith('temp_')) {
            return prisma.comisionFFVVTienda.update({
                where: { id: item.id },
                data: {
                    nombre: item.nombre,
                    importe: item.importe !== null ? parseFloat(item.importe) : null,
                    aceleradores: item.aceleradores !== null ? parseFloat(item.aceleradores) : null,
                    descuentos: item.descuentos !== null ? parseFloat(item.descuentos) : null,
                    dietas: item.dietas !== null ? parseFloat(item.dietas) : null,
                    km: item.km !== null ? parseFloat(item.km) : null,
                    gasolina: item.gasolina !== null ? parseFloat(item.gasolina) : null,
                    incentivos: item.incentivos !== null ? parseFloat(item.incentivos) : null,
                    o2Varios: item.o2Varios !== null ? parseFloat(item.o2Varios) : null,
                    total: item.total !== null ? parseFloat(item.total) : null,
                }
            })
        } else {
            return prisma.comisionFFVVTienda.create({
                data: {
                    periodKey: periodKey,
                    tipo: item.tipo,
                    nombre: item.nombre || 'Nuevo Comercial',
                    importe: item.importe !== null && item.importe !== undefined ? parseFloat(item.importe) : null,
                    aceleradores: item.aceleradores !== null && item.aceleradores !== undefined ? parseFloat(item.aceleradores) : null,
                    descuentos: item.descuentos !== null && item.descuentos !== undefined ? parseFloat(item.descuentos) : null,
                    dietas: item.dietas !== null && item.dietas !== undefined ? parseFloat(item.dietas) : null,
                    km: item.km !== null && item.km !== undefined ? parseFloat(item.km) : null,
                    gasolina: item.gasolina !== null && item.gasolina !== undefined ? parseFloat(item.gasolina) : null,
                    incentivos: item.incentivos !== null && item.incentivos !== undefined ? parseFloat(item.incentivos) : null,
                    o2Varios: item.o2Varios !== null && item.o2Varios !== undefined ? parseFloat(item.o2Varios) : null,
                    total: item.total !== null && item.total !== undefined ? parseFloat(item.total) : null,
                }
            })
        }
    })

    await prisma.$transaction([...deleteOperation, metadataUpsert, ...upsertOperations])
    return NextResponse.json({ success: true, count: upsertOperations.length, deletedCount: body.deletions ? body.deletions.length : 0 });

  } catch (error: any) {
    console.error('PUT /api/comisiones-ffvv-v3 error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
