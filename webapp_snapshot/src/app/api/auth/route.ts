import { NextResponse } from 'next/server'
import { login } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

console.log('[API Login] Instanciando PrismaClient...');
const prisma = new PrismaClient()
console.log('[API Login] PrismaClient instanciado correctamente.');

export async function POST(request: Request) {
  try {
    console.log('[API Login] Petición POST recibida.');
    const body = await request.json()
    const { username, password } = body
    console.log('[API Login] Intento de login para usuario:', username);

    console.log('[API Login] Consultando usuarios en la base de datos a través de Prisma...');
    const allUsers = await prisma.user.findMany()
    console.log('[API Login] Consulta exitosa. Usuarios encontrados:', allUsers.length);
    const user = allUsers.find(
      (u: any) => u.username.toLowerCase() === (username || '').toLowerCase() && u.password === password
    )

    if (user) {
      const { password: _, ...userWithoutPassword } = user
      
      let perms = null
      try {
        if (userWithoutPassword.permissions && userWithoutPassword.permissions !== 'null') {
          perms = JSON.parse(userWithoutPassword.permissions as string)
        }
      } catch (e) {}

      const sessionUser = { 
        ...userWithoutPassword, 
        permissions: perms 
      }
      
      await login(sessionUser)
      return NextResponse.json({ success: true, user: sessionUser })
    }

    return NextResponse.json(
      { success: false, error: 'Credenciales incorrectas' },
      { status: 401 }
    )
  } catch (error) {
    console.error('[API Login] Error capturado en el catch:');
    console.error(error);
    return NextResponse.json(
      { success: false, error: 'Error del servidor' },
      { status: 500 }
    )
  }
}
