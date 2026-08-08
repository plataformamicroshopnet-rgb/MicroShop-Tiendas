import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hashPassword, esHuella } from '@/lib/password'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  const rawUsers = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' }
  })
  
  const users = rawUsers.map((u) => {
    let perms = null
    try {
      if (u.permissions && u.permissions !== 'null') {
        perms = JSON.parse(u.permissions)
      }
    } catch (e) { }
    return {
      username: u.username,
      // La contraseña NO sale de aqui. Antes se enviaba al navegador de quien
      // abriera «Gestion de Usuarios»: las doce contraseñas viajaban por la red y
      // se quedaban en la pantalla. Se manda solo si esta pendiente de convertir,
      // para poder avisar; nunca su contenido.
      passwordPendiente: !esHuella(u.password),
      role: u.role,
      codigoComercial: u.codigoComercial || '',
      retroDiasCrear: (u as any).retroDiasCrear ?? null,
      retroDiasModificar: (u as any).retroDiasModificar ?? null,
      permissions: perms
    }
  })

  return NextResponse.json({ success: true, users })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { username, permissions } = await request.json()
    
    await prisma.user.update({
      where: { username },
      data: {
        permissions: JSON.stringify(permissions || [])
      }
    })

    return NextResponse.json({ success: true })
  } catch(e) {
    return NextResponse.json({ success: false, error: 'Error del servidor o usuario no encontrado' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { username, password, role, codigoComercial } = await request.json()
    
    const existing = await prisma.user.findFirst({
        where: { username: { equals: username } } // case sensitive/insensitive depends on sqlite collation, but close enough
    })
    
    // Manual pseudo case-insensitive check
    const allUsers = await prisma.user.findMany()
    if (allUsers.find(u => u.username.toLowerCase() === username.toLowerCase())) {
        return NextResponse.json({ success: false, error: 'Ya existe un usuario con ese nombre' }, { status: 400 })
    }

    await prisma.user.create({
      data: {
        username,
        password: hashPassword(password),
        role: role || 'COMERCIAL',
        codigoComercial: codigoComercial || '',
        permissions: 'null'
      }
    })
    
    return NextResponse.json({ success: true })
  } catch(e) {
    return NextResponse.json({ success: false, error: 'Error del servidor' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { oldUsername, newUsername, password, role, codigoComercial, retroDiasCrear, retroDiasModificar } = await request.json()

    if (oldUsername !== newUsername) {
      const allUsers = await prisma.user.findMany()
      if (allUsers.find(u => u.username.toLowerCase() === (newUsername || '').toLowerCase())) {
        return NextResponse.json({ success: false, error: 'Ya existe otro usuario con ese nuevo nombre' }, { status: 400 })
      }
    }

    const updateData: any = {}
    if (newUsername) updateData.username = newUsername
    // Cambiar la contraseña guarda la HUELLA, no lo que se ha tecleado.
    if (password) updateData.password = hashPassword(password)
    if (role) updateData.role = role
    if (codigoComercial !== undefined) updateData.codigoComercial = codigoComercial
    if (retroDiasCrear !== undefined) updateData.retroDiasCrear = retroDiasCrear === null || retroDiasCrear === '' ? null : Math.max(0, parseInt(retroDiasCrear, 10) || 0)
    if (retroDiasModificar !== undefined) updateData.retroDiasModificar = retroDiasModificar === null || retroDiasModificar === '' ? null : Math.max(0, parseInt(retroDiasModificar, 10) || 0)

    await prisma.user.update({
      where: { username: oldUsername },
      data: updateData
    })
    
    return NextResponse.json({ success: true })
  } catch(e) {
    return NextResponse.json({ success: false, error: 'Error del servidor o usuario no encontrado' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')
    
    if (username === 'Admin') {
      return NextResponse.json({ success: false, error: 'No puedes borrar al Administrador principal' }, { status: 400 })
    }

    if (!username) {
        return NextResponse.json({ success: false, error: 'Usuario no proporcionado' }, { status: 400 })
    }

    await prisma.user.delete({
      where: { username }
    })
    
    return NextResponse.json({ success: true })
  } catch(e: any) {
    if (e.code === 'P2025') {
       return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }
    return NextResponse.json({ success: false, error: 'Error del servidor' }, { status: 500 })
  }
}
