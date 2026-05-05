import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import { getSession } from '@/lib/auth'

export async function PUT(request: Request, props: any) {
  try {
    const session = await getSession()
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await props.params;
    const id = resolvedParams.id;
    const bod = await request.json()
    const { 
      name, 
      description,
      channelType, 
      combinationLabel, 
      telecomRewardAmount, 
      sellerRewardAmount, 
      maxPayoutUnits,
      validFrom,
      validTo,
      isActive 
    } = bod;

    if (!name || name.trim() === '') throw new Error('Descripción obligatoria');
    if (!combinationLabel || combinationLabel.trim() === '') throw new Error('Combinación obligatoria');
    if (channelType && !['PLUS', 'BASICO', 'AMBOS'].includes(channelType)) throw new Error('Tipo inválido');

    const rawGroups = bod.requiredGroups;
    const derivedGroups = rawGroups
        ? (Array.isArray(rawGroups) ? rawGroups : JSON.parse(rawGroups))
        : combinationLabel.split('+').map((s: string) => s.trim()).filter(Boolean);


    const updatedRule = await prisma.extraRule.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        channelType,
        combinationLabel: combinationLabel.trim(),
        requiredGroups: JSON.stringify(derivedGroups),
        maxPayoutUnits: maxPayoutUnits ? parseInt(maxPayoutUnits, 10) : null,
        telecomRewardAmount: parseFloat(telecomRewardAmount),
        sellerRewardAmount: parseFloat(sellerRewardAmount),
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
        isActive: isActive,
      }
    });

    return NextResponse.json({ success: true, rule: updatedRule });
  } catch (error: any) {
    console.error('[PUT ExtraRule]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request, props: any) {
  try {
    const session = await getSession()
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await props.params;
    const id = resolvedParams.id;

    const rule = await prisma.extraRule.findUnique({ where: { id } });
    if (!rule) {
      return NextResponse.json({ success: false, error: 'Regla no encontrada' }, { status: 404 });
    }

    const assignmentCount = await prisma.extraAssignment.count({
      where: { ruleId: id }
    });

    if (assignmentCount > 0 && rule.isActive) {
      // Soft Delete
      await prisma.extraRule.update({
        where: { id },
        data: { isActive: false }
      })
      return NextResponse.json({ success: true, message: 'Regla desactivada. Presiona borrar de nuevo si deseas eliminarla permanentemente junto a su historial de pagos.' });
    } else {
      // Hard Delete (borramos asignaciones primero para evitar problemas de clave foránea, aunque haya onCascade, es más seguro)
      if (assignmentCount > 0) {
          await prisma.extraAssignment.deleteMany({ where: { ruleId: id } });
      }
      
      await prisma.extraRule.delete({
        where: { id }
      });
      return NextResponse.json({ success: true, message: 'Regla y su historial eliminados permanentemente.' });
    }

  } catch (error: any) {
    console.error('[DELETE ExtraRule]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
