"use client"
import { useGuard } from '@/hooks/useGuard'
import TrackingDashboard from './TrackingDashboard'

export default function SeguimientoDiarioPage() {
    // Proteger vista para Jefatura
    const { authorized } = useGuard('MODULE_JEFE_FFVV')

    if (authorized === null) {
        return <div style={{ padding: 40, color: '#3b82f6', fontWeight: 'bold' }}>Verificando credenciales del módulo...</div>
    }

    return <TrackingDashboard />
}
