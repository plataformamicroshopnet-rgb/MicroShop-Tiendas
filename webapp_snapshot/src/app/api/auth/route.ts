import { NextResponse } from 'next/server'
import { login } from '@/lib/auth'
import { verifyPassword, hashPassword } from '@/lib/password'
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
    // Primero se busca a la PERSONA y despues se comprueba su contraseña contra la
    // huella guardada. Antes se buscaba por usuario Y contraseña a la vez, que solo
    // funciona si la contraseña esta escrita en claro en la base.
    const candidato: any = allUsers.find(
      (u: any) => u.username.toLowerCase() === (username || '').toLowerCase()
    )
    const comprobacion = candidato
      ? verifyPassword(password, candidato.password)
      : { ok: false, hayQueMigrar: false }
    const user = comprobacion.ok ? candidato : null

    // Si acerto pero lo guardado seguia siendo texto legible, se convierte AHORA.
    // Asi, aunque quede algun usuario sin convertir, se arregla solo la primera vez
    // que esa persona entra, sin que ella note nada.
    if (user && comprobacion.hayQueMigrar) {
      try {
        await prisma.user.update({
          where: { username: user.username },
          data: { password: hashPassword(password) }
        })
        console.log('[API Login] Contraseña de', user.username, 'guardada ya como huella.');
      } catch (e) {
        console.error('[API Login] No se pudo convertir la contraseña:', e);
      }
    }

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
