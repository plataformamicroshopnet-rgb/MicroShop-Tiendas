import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import { getSession } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const rules = await prisma.extraRule.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ success: true, rules })
  } catch (error: any) {
    console.error('[GET ExtraRules]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Debe iniciar sesión.' }, { status: 401 })
    }
    
    // Asegurarse de que solo roles con permiso editen (como medida extra en backend)
    // Asumimos que ADMIN o JEFE pueden (tienen MODULE_ADMIN o similares en frontend)

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

    // Validación Backend Estricta
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new Error('El campo "Descripción" es obligatorio.');
    }
    if (!channelType || !['PLUS', 'BASICO', 'AMBOS'].includes(channelType)) {
      throw new Error('El "Tipo" debe ser PLUS, BASICO o AMBOS.');
    }
    if (!combinationLabel || typeof combinationLabel !== 'string' || combinationLabel.trim() === '') {
      throw new Error('El campo "Combinación" es obligatorio.');
    }
    if (telecomRewardAmount === undefined || telecomRewardAmount === null) {
      throw new Error('El "Importe Telefónica" es obligatorio.');
    }
    if (sellerRewardAmount === undefined || sellerRewardAmount === null) {
      throw new Error('El "Importe Comercial" es obligatorio.');
    }

    // Default requiredGroups to essentially whatever the combination label splits to by default to satisfy schema
    const rawGroups = bod.requiredGroups;
    const derivedGroups = rawGroups
        ? (Array.isArray(rawGroups) ? rawGroups : JSON.parse(rawGroups))
        : combinationLabel.split('+').map((s: string) => s.trim()).filter(Boolean);

    const newRule = await prisma.extraRule.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        channelType,
        combinationLabel: combinationLabel.trim(),
        requiredGroups: JSON.stringify(derivedGroups),
        payoutMode: 'PER_VALID_COMBINATION', // Por defecto para esta versión
        sameClientRequired: true,
        sameSellerRequired: true,
        minOccurrences: 1,
        maxPayoutUnits: maxPayoutUnits ? parseInt(maxPayoutUnits, 10) : null,
        telecomRewardAmount: parseFloat(telecomRewardAmount),
        sellerRewardAmount: parseFloat(sellerRewardAmount),
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
        isActive: isActive !== false, // por defecto true
      }
    })

    return NextResponse.json({ success: true, rule: newRule })
  } catch (error: any) {
    console.error('[POST ExtraRule]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
}
