import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSession } from '@/lib/auth';
import { canEdit } from '@/lib/permissions';

const prisma = new PrismaClient();

// Helper to validate and return WorkPeriod
async function getValidatedPeriod(request: Request, requireActive = false) {
  const url = new URL(request.url);
  const periodKey = url.searchParams.get('periodKey');
  if (!periodKey) return { error: 'periodKey is required', status: 400 };

  const wp = await prisma.workPeriod.findUnique({ where: { period_key: periodKey } });
  if (!wp) return { error: 'Period not found', status: 404 };

  if (requireActive && wp.status === 'HISTORIC') {
    return { error: 'Period is HISTORIC. Read-only.', status: 403 };
  }
  return { wp };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const queryPeriodKey = url.searchParams.get('periodKey');
    const legacyOnly = url.searchParams.get('legacyOnly') === '1';
    const strictPeriod = url.searchParams.get('strictPeriod') === '1';

    let importes: any[] = [];

    if (legacyOnly) {
      importes = await prisma.importePyme.findMany({
        where: { periodId: null },
        orderBy: { createdAt: 'asc' }
      });
    } else if (queryPeriodKey && strictPeriod) {
      const wp = await prisma.workPeriod.findUnique({ where: { period_key: queryPeriodKey } });
      if (wp) {
        importes = await prisma.importePyme.findMany({
          where: { periodId: wp.id },
          orderBy: { createdAt: 'asc' }
        });
      }
    } else {
      // Fallback para las dashboards viejas
      importes = await prisma.importePyme.findMany({
        where: { periodId: null },
        orderBy: { createdAt: 'asc' }
      });
    }

    return NextResponse.json({ success: true, data: importes });
  } catch (error: any) {
    console.error('GET /api/importes-pyme error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session || !canEdit(session.user, 'MODULE_LIQUIDACION')) {
      return NextResponse.json({ success: false, error: 'No autorizado / Solo Lectura' }, { status: 403 })
    }

    const { wp, error, status } = await getValidatedPeriod(request, true);
    if (error) return NextResponse.json({ success: false, error }, { status: status as number });

    const body = await request.json();
    if (!body || !body.concepto) {
      return NextResponse.json({ success: false, error: 'Falta el concepto del bloque de cobro' }, { status: 400 });
    }

    const nuevoImporte = await prisma.importePyme.create({
      data: {
        concepto: body.concepto,
        objetivoUds: body.objetivoUds ? parseFloat(body.objetivoUds) : null,
        totalObjetivos: body.totalObjetivos ? parseFloat(body.totalObjetivos) : null,
        objetivoPlus100: body.objetivoPlus100 ? parseFloat(body.objetivoPlus100) : null,
        comisionNacionalMenos50: body.comisionNacionalMenos50 ? parseFloat(body.comisionNacionalMenos50) : null,
        comisionNacionalEntre50Y80: body.comisionNacionalEntre50Y80 ? parseFloat(body.comisionNacionalEntre50Y80) : null,
        comisionNacionalEntre80Y100: body.comisionNacionalEntre80Y100 ? parseFloat(body.comisionNacionalEntre80Y100) : null,
        comisionNacionalMas100: body.comisionNacionalMas100 ? parseFloat(body.comisionNacionalMas100) : null,
        operacionesAsignadas: body.operacionesAsignadas !== undefined ? body.operacionesAsignadas : null,
        grupo: body.grupo !== undefined ? body.grupo : null,
        isPercentage: body.isPercentage === true,
        periodId: wp!.id
      },
    });

    return NextResponse.json({ success: true, data: nuevoImporte });
  } catch (error: any) {
    console.error('POST /api/importes-pyme error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession()
    if (!session || !canEdit(session.user, 'MODULE_LIQUIDACION')) {
      return NextResponse.json({ success: false, error: 'No autorizado / Solo Lectura' }, { status: 403 })
    }

    const { wp, error, status } = await getValidatedPeriod(request, true);
    if (error) return NextResponse.json({ success: false, error }, { status: status as number });

    const body = await request.json();

    if (!body) {
       return NextResponse.json({ success: false, error: 'Faltan datos' }, { status: 400 });
    }

    // --- Bulk Update Support ---
    if (body.operations && Array.isArray(body.operations)) {
       const deleteOperation = body.deletions && body.deletions.length > 0 
           ? [prisma.importePyme.deleteMany({ where: { id: { in: body.deletions } } })] 
           : []

       const upsertOperations = body.operations.map((item: any) => {
           if (item.id) {
               const updateData: any = {};
               if (item.concepto !== undefined) updateData.concepto = item.concepto;
               if (item.objetivoUds !== undefined) updateData.objetivoUds = item.objetivoUds === null ? null : parseFloat(item.objetivoUds);
               if (item.totalObjetivos !== undefined) updateData.totalObjetivos = item.totalObjetivos === null ? null : parseFloat(item.totalObjetivos);
               if (item.objetivoPlus100 !== undefined) updateData.objetivoPlus100 = item.objetivoPlus100 === null ? null : parseFloat(item.objetivoPlus100);
               if (item.comisionNacionalMenos50 !== undefined) updateData.comisionNacionalMenos50 = item.comisionNacionalMenos50 === null ? null : parseFloat(item.comisionNacionalMenos50);
               if (item.comisionNacionalEntre50Y80 !== undefined) updateData.comisionNacionalEntre50Y80 = item.comisionNacionalEntre50Y80 === null ? null : parseFloat(item.comisionNacionalEntre50Y80);
               if (item.comisionNacionalEntre80Y100 !== undefined) updateData.comisionNacionalEntre80Y100 = item.comisionNacionalEntre80Y100 === null ? null : parseFloat(item.comisionNacionalEntre80Y100);
               if (item.comisionNacionalMas100 !== undefined) updateData.comisionNacionalMas100 = item.comisionNacionalMas100 === null ? null : parseFloat(item.comisionNacionalMas100);
               if (item.operacionesAsignadas !== undefined) updateData.operacionesAsignadas = item.operacionesAsignadas === null ? null : String(item.operacionesAsignadas);
               if (item.grupo !== undefined) updateData.grupo = item.grupo === null ? null : String(item.grupo);
               if (item.isPercentage !== undefined) updateData.isPercentage = item.isPercentage === true;
    
               return prisma.importePyme.update({
                   where: { id: item.id },
                   data: updateData
               })
           } else {
               return prisma.importePyme.create({
                   data: {
                       concepto: item.concepto || 'Nuevo Bloque',
                       objetivoUds: item.objetivoUds === null || item.objetivoUds === undefined ? null : parseFloat(item.objetivoUds),
                       totalObjetivos: item.totalObjetivos === null || item.totalObjetivos === undefined ? null : parseFloat(item.totalObjetivos),
                       objetivoPlus100: item.objetivoPlus100 === null || item.objetivoPlus100 === undefined ? null : parseFloat(item.objetivoPlus100),
                       comisionNacionalMenos50: item.comisionNacionalMenos50 === null || item.comisionNacionalMenos50 === undefined ? null : parseFloat(item.comisionNacionalMenos50),
                       comisionNacionalEntre50Y80: item.comisionNacionalEntre50Y80 === null || item.comisionNacionalEntre50Y80 === undefined ? null : parseFloat(item.comisionNacionalEntre50Y80),
                       comisionNacionalEntre80Y100: item.comisionNacionalEntre80Y100 === null || item.comisionNacionalEntre80Y100 === undefined ? null : parseFloat(item.comisionNacionalEntre80Y100),
                       comisionNacionalMas100: item.comisionNacionalMas100 === null || item.comisionNacionalMas100 === undefined ? null : parseFloat(item.comisionNacionalMas100),
                       operacionesAsignadas: item.operacionesAsignadas === null || item.operacionesAsignadas === undefined ? null : String(item.operacionesAsignadas),
                       grupo: item.grupo === null || item.grupo === undefined ? null : String(item.grupo),
                       isPercentage: item.isPercentage === true,
                       periodId: wp!.id
                   }
               })
           }
       })

       await prisma.$transaction([...deleteOperation, ...upsertOperations])
       return NextResponse.json({ success: true, count: upsertOperations.length, deletedCount: body.deletions ? body.deletions.length : 0 });
    }

    // --- Single Update Support ---
    if (!body.id) {
       return NextResponse.json({ success: false, error: 'Se requiere el ID para actualizar' }, { status: 400 });
    }

    const { id, ...dataToUpdate } = body;

    const updateData: any = {};
    if (dataToUpdate.concepto !== undefined) updateData.concepto = dataToUpdate.concepto;
    if (dataToUpdate.objetivoUds !== undefined) updateData.objetivoUds = dataToUpdate.objetivoUds === null ? null : parseFloat(dataToUpdate.objetivoUds);
    if (dataToUpdate.totalObjetivos !== undefined) updateData.totalObjetivos = dataToUpdate.totalObjetivos === null ? null : parseFloat(dataToUpdate.totalObjetivos);
    if (dataToUpdate.objetivoPlus100 !== undefined) updateData.objetivoPlus100 = dataToUpdate.objetivoPlus100 === null ? null : parseFloat(dataToUpdate.objetivoPlus100);
    if (dataToUpdate.comisionNacionalMenos50 !== undefined) updateData.comisionNacionalMenos50 = dataToUpdate.comisionNacionalMenos50 === null ? null : parseFloat(dataToUpdate.comisionNacionalMenos50);
    if (dataToUpdate.comisionNacionalEntre50Y80 !== undefined) updateData.comisionNacionalEntre50Y80 = dataToUpdate.comisionNacionalEntre50Y80 === null ? null : parseFloat(dataToUpdate.comisionNacionalEntre50Y80);
    if (dataToUpdate.comisionNacionalEntre80Y100 !== undefined) updateData.comisionNacionalEntre80Y100 = dataToUpdate.comisionNacionalEntre80Y100 === null ? null : parseFloat(dataToUpdate.comisionNacionalEntre80Y100);
    if (dataToUpdate.comisionNacionalMas100 !== undefined) updateData.comisionNacionalMas100 = dataToUpdate.comisionNacionalMas100 === null ? null : parseFloat(dataToUpdate.comisionNacionalMas100);
    if (dataToUpdate.isPercentage !== undefined) updateData.isPercentage = dataToUpdate.isPercentage === true;


    const importeActualizado = await prisma.importePyme.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: importeActualizado });
  } catch (error: any) {
    console.error('PUT /api/importes-pyme error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession()
    if (!session || !canEdit(session.user, 'MODULE_LIQUIDACION')) {
      return NextResponse.json({ success: false, error: 'No autorizado / Solo Lectura' }, { status: 403 })
    }

    const { wp, error, status } = await getValidatedPeriod(request, true);
    if (error) return NextResponse.json({ success: false, error }, { status: status as number });

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Falta el parámetro ID' }, { status: 400 });
    }

    await prisma.importePyme.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/importes-pyme error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
