import { NextResponse } from 'next/server'

export async function POST() {
    return NextResponse.json({ 
        success: true, 
        message: 'Función en modo Legado: La plataforma ya no requiere sincronizarse con archivos Excel. MicroShop FFVV ahora opera 100% sobre la base de datos SQL en tiempo real con backups gestionados automáticamente por Railway.' 
    })
}
