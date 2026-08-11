import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'
import { JEFE_PCT_KEYS_BASE } from '@/lib/comisionJefeTiendas'
import { exigeAdmin } from '@/lib/apiGuard'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const periods = await prisma.workPeriod.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ success: true, periods })
  } catch (error) {
    console.error('Error fetching periods:', error)
    return NextResponse.json({ success: false, error: 'DB Error' })
  }
}

export async function POST(req: Request) {
  try {
    // Crear / clonar / borrar meses: solo el administrador (antes cualquiera
    // con la URL podía crear, clonar o BORRAR un mes entero).
    const no = await exigeAdmin(req); if (no) return no
    const body = await req.json()
    const { action, periodId } = body

    if (action === 'CREATE_NEXT') {
      // Create the next logical month based on the latest one
      const latest = await prisma.workPeriod.findFirst({
        orderBy: [{ year: 'desc' }, { month: 'desc' }]
      })

      let nextMonth = new Date().getMonth() + 1
      let nextYear = new Date().getFullYear()

      if (latest) {
        nextMonth = latest.month === 12 ? 1 : latest.month + 1
        nextYear = latest.month === 12 ? latest.year + 1 : latest.year
      }

      const periodKey = `${nextYear}_${nextMonth.toString().padStart(2, '0')}`
      
      const newPeriod = await prisma.workPeriod.create({
        data: {
          period_key: periodKey,
          year: nextYear,
          month: nextMonth,
          status: 'DRAFT',
        }
      })
      return NextResponse.json({ success: true, period: newPeriod })

    } else if (action === 'DUPLICATE' && periodId) {
      // Fase C2: Clonado Profundo - Copiamos el siguiente mes y arrastramos la configuración
      const source = await prisma.workPeriod.findUnique({ 
        where: { id: periodId },
        include: {
          importePyme: true,
          importePlus: true,
          catalogs: true,
          objectives: true,
          extraRules: true
        }
      })
      if (!source) return NextResponse.json({ success: false, error: 'Not found' })

      let nextMonth = source.month === 12 ? 1 : source.month + 1
      let nextYear = source.month === 12 ? source.year + 1 : source.year

      const periodKey = `${nextYear}_${nextMonth.toString().padStart(2, '0')}`

      // Idempotente: si el mes destino ya existe como BORRADOR, se limpia entero y se regenera.
      // (Las tablas por clave de periodo y los ajustes no tienen cascade, hay que borrarlos a mano.)
      const existingTarget = await prisma.workPeriod.findUnique({ where: { period_key: periodKey } })
      if (existingTarget) {
        if (existingTarget.status !== 'DRAFT') {
          return NextResponse.json({ success: false, error: `El mes ${periodKey} ya existe y no es un borrador (${existingTarget.status}); no se puede regenerar.` })
        }
        await prisma.monthlyCondition.deleteMany({ where: { periodKey } })
        await prisma.tiendaCommissionRule.deleteMany({ where: { periodKey } })
        await prisma.tiendaStoreObjective.deleteMany({ where: { periodKey } })
        await prisma.tiendaComercialHour.deleteMany({ where: { periodKey } })
        await prisma.appSetting.deleteMany({ where: { key: { in: [
          `territorial_tiendas_${periodKey}`, `territorial_o2_${periodKey}`, `o2_rules_v2_${periodKey}`,
          // Config por mes que también se clona: si no se borran al regenerar un
          // borrador, quedan restos de la tanda anterior justo en las claves
          // que el clonado vuelve a escribir.
          `condiciones_plus_data_${periodKey}`, `fttr_discount_${periodKey}`,
          // Los 9 % del Jefe de Tiendas de ESE mes: si no se borran, un borrador
          // re-clonado se queda con los porcentajes de la tanda anterior.
          ...JEFE_PCT_KEYS_BASE.map(k => `${k}_${periodKey}`)
        ] } } })
        // Borra el periodo (cascade: catálogos, ventas, objetivos, importes, reglas extra y asignaciones)
        await prisma.workPeriod.delete({ where: { id: existingTarget.id } })
      }

      const newPeriod = await prisma.workPeriod.create({
        data: {
          period_key: periodKey,
          year: nextYear,
          month: nextMonth,
          status: 'DRAFT',
          
          pymeMultiplier: source.pymeMultiplier,
          tramo1Limit: source.tramo1Limit,
          tramo2Limit: source.tramo2Limit,
          tramo3Limit: source.tramo3Limit,
          visitasM1Contactos: source.visitasM1Contactos,
          visitasM1Visitas: source.visitasM1Visitas,
          visitasM2Contactos: source.visitasM2Contactos,
          visitasM2Visitas: source.visitasM2Visitas,
          visitasM3Contactos: source.visitasM3Contactos,
          visitasM3Visitas: source.visitasM3Visitas,

          importePyme: {
              create: source.importePyme.map(i => ({
                  concepto: i.concepto,
                  objetivoUds: i.objetivoUds,
                  totalObjetivos: i.totalObjetivos,
                  objetivoPlus100: i.objetivoPlus100,
                  comisionNacionalMenos50: i.comisionNacionalMenos50,
                  comisionNacionalEntre50Y80: i.comisionNacionalEntre50Y80,
                  comisionNacionalEntre80Y100: i.comisionNacionalEntre80Y100,
                  comisionNacionalMas100: i.comisionNacionalMas100,
                  operacionesAsignadas: i.operacionesAsignadas,
                  grupo: i.grupo,
                  isPercentage: i.isPercentage
              }))
          },
          importePlus: {
              create: source.importePlus.map(i => ({
                  concepto: i.concepto,
                  objetivoUds: i.objetivoUds,
                  totalObjetivos: i.totalObjetivos,
                  objetivoPlus100: i.objetivoPlus100,
                  comisionNacionalMenos50: i.comisionNacionalMenos50,
                  comisionNacionalEntre50Y80: i.comisionNacionalEntre50Y80,
                  comisionNacionalEntre80Y100: i.comisionNacionalEntre80Y100,
                  comisionNacionalMas100: i.comisionNacionalMas100,
                  operacionesAsignadas: i.operacionesAsignadas,
                  grupo: i.grupo,
                  isPercentage: i.isPercentage
              }))
          },
          catalogs: {
              create: source.catalogs.map(c => ({
                  categoria: c.categoria,
                  producto: c.producto,
                  mensual: c.mensual,
                  anual: c.anual,
                  validFrom: c.validFrom,
                  validTo: c.validTo,
                  fabricante: c.fabricante,
                  gama: c.gama,
                  subcategoria: c.subcategoria,
                  comision: c.comision,
                  comisionConCoste: c.comisionConCoste
              }))
          },
          objectives: {
              create: source.objectives.map(o => ({
                  profile: o.profile,
                  month: `${nextYear}${nextMonth.toString().padStart(2, '0')}`,
                  objKey: o.objKey,
                  value: o.value,
                  grupo: o.grupo
              }))
          }
          // OJO: las ExtraRules NO se clonan A PROPÓSITO (la bomba del pago doble):
          // los lectores de reglas y bonos son GLOBALES (no filtran por periodo) y
          // la clave de idempotencia del bono lleva el id de la regla, así que cada
          // copia clonada PAGARÍA OTRA VEZ el mismo KPI. Las reglas de extras se
          // gestionan en su propia pantalla y no viajan con el clonado del mes.
        }
      })
      
      // Duplicate TiendaCommissionRule
      const sourceRules = await prisma.tiendaCommissionRule.findMany({ where: { periodKey: source.period_key } });
      if (sourceRules.length > 0) {
        await prisma.tiendaCommissionRule.createMany({
          data: sourceRules.map(r => ({
            periodKey: periodKey,
            nombre: r.nombre,
            productosCuentan: r.productosCuentan,
            objPrimerTramo: r.objPrimerTramo,
            importePrimerTramo: r.importePrimerTramo,
            objSegundoTramo: r.objSegundoTramo,
            importeSegundoTramo: r.importeSegundoTramo,
            // El 3er tramo y el ORDEN de las palancas se perdían al clonar: el
            // mes nuevo nacía sin tercer tramo y con las palancas desordenadas.
            objTercerTramo: r.objTercerTramo,
            importeTercerTramo: r.importeTercerTramo,
            order: r.order,
            condicionantes: r.condicionantes,
            totalHoras: r.totalHoras
          }))
        });
      }

      // Duplicate TiendaComercialHour
      const sourceHours = await prisma.tiendaComercialHour.findMany({ where: { periodKey: source.period_key } });
      if (sourceHours.length > 0) {
        await prisma.tiendaComercialHour.createMany({
          data: sourceHours.map(h => ({
            periodKey: periodKey,
            comercial: h.comercial,
            horario: h.horario,
            // La TIENDA del comercial se perdía al clonar → el territorial del
            // mes nuevo salía a 0 € porque no sabía a qué tienda va cada uno.
            tienda: h.tienda
          }))
        });
      }

      // Duplicate AppSettings for Territorial & O2
      const keysToCopy = [
        `territorial_tiendas_${source.period_key}`,
        `territorial_o2_${source.period_key}`,
        `o2_rules_v2_${source.period_key}`,
        // Config por mes que se perdía al clonar: las condiciones plus del mes y
        // el descuento FTTR. Sin ellas el mes nuevo caía a valores a fuego
        // (el FTTR a 910 €) y a los candados del 2º tramo les faltaba su base.
        `condiciones_plus_data_${source.period_key}`,
        `fttr_discount_${source.period_key}`,
        // Los 9 % del Jefe de Tiendas del mes de origen. Desde que son POR MES
        // (ago-2026) hay que arrastrarlos como todo lo demás: si no, el mes nuevo
        // cae al respaldo general y el jefe cobraría con unos % de hace meses.
        ...JEFE_PCT_KEYS_BASE.map(k => `${k}_${source.period_key}`)
      ];
      
      for (const oldKey of keysToCopy) {
        const setting = await prisma.appSetting.findUnique({ where: { key: oldKey } });
        if (setting) {
          const newKey = oldKey.replace(source.period_key, periodKey);
          await prisma.appSetting.upsert({
            where: { key: newKey },
            update: { value: setting.value },
            create: { key: newKey, value: setting.value }
          });
        }
      }

      // Clonar Condiciones Mensuales (MonthlyCondition) - config por mes
      const srcMonthly = await prisma.monthlyCondition.findMany({ where: { periodKey: source.period_key } });
      if (srcMonthly.length > 0) {
        await prisma.monthlyCondition.createMany({
          data: srcMonthly.map(m => ({
            periodKey: periodKey,
            type: m.type,
            title: m.title,
            color: m.color,
            text: m.text,
            amount: m.amount,
            order: m.order
          }))
        });
      }

      // Clonar Objetivos por Tienda (TiendaStoreObjective) - config por mes
      const srcStoreObj = await prisma.tiendaStoreObjective.findMany({ where: { periodKey: source.period_key } });
      if (srcStoreObj.length > 0) {
        await prisma.tiendaStoreObjective.createMany({
          data: srcStoreObj.map(o => ({
            periodKey: periodKey,
            storeName: o.storeName,
            bafConvMS: o.bafConvMS,
            bafNoFusionO2: o.bafNoFusionO2,
            restoBaf: o.restoBaf,
            tvFutbol: o.tvFutbol,
            alarmas: o.alarmas,
            dispSegEuros: o.dispSegEuros,
            dispUnidades: o.dispUnidades,
            seguros: o.seguros,
            movil: o.movil,
            repos: o.repos,
            fttr: o.fttr,
            bafNoTrasl: o.bafNoTrasl
          }))
        });
      }

      return NextResponse.json({ success: true, period: newPeriod })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' })
  } catch (error: any) {
    console.error('Error POST period:', error)
    return NextResponse.json({ success: false, error: error.message })
  }
}

export async function PUT(req: Request) {
  try {
    // Activar un mes (que degrada el resto a histórico) o cambiar sus límites:
    // solo el administrador.
    const no = await exigeAdmin(req); if (no) return no
    const body = await req.json()
    const {
      id, status, pymeMultiplier, tramo1Limit, tramo2Limit, tramo3Limit,
      visitasM1Contactos, visitasM1Visitas, visitasM2Contactos, 
      visitasM2Visitas, visitasM3Contactos, visitasM3Visitas 
    } = body

    if (!id) return NextResponse.json({ success: false, error: 'Missing id' })

    const updateData: any = {}
    if (status !== undefined) updateData.status = status
    if (pymeMultiplier !== undefined) updateData.pymeMultiplier = parseFloat(pymeMultiplier)
    if (tramo1Limit !== undefined) updateData.tramo1Limit = parseFloat(tramo1Limit)
    if (tramo2Limit !== undefined) updateData.tramo2Limit = parseFloat(tramo2Limit)
    if (tramo3Limit !== undefined) updateData.tramo3Limit = parseFloat(tramo3Limit)

    if (visitasM1Contactos !== undefined) updateData.visitasM1Contactos = parseFloat(visitasM1Contactos)
    if (visitasM1Visitas !== undefined) updateData.visitasM1Visitas = parseFloat(visitasM1Visitas)
    if (visitasM2Contactos !== undefined) updateData.visitasM2Contactos = parseFloat(visitasM2Contactos)
    if (visitasM2Visitas !== undefined) updateData.visitasM2Visitas = parseFloat(visitasM2Visitas)
    if (visitasM3Contactos !== undefined) updateData.visitasM3Contactos = parseFloat(visitasM3Contactos)
    if (visitasM3Visitas !== undefined) updateData.visitasM3Visitas = parseFloat(visitasM3Visitas)

    // Si pasamos a ACTIVE, podríamos forzar que todos los demás ACTIVE pasen a HISTORIC
    if (status === 'ACTIVE') {
      await prisma.workPeriod.updateMany({
        where: { status: 'ACTIVE' },
        data: { status: 'HISTORIC' }
      })
    }

    const updated = await prisma.workPeriod.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ success: true, period: updated })
  } catch (error: any) {
    console.error('Error PUT period:', error)
    return NextResponse.json({ success: false, error: error.message })
  }
}
