"use client"
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export function MagazineBackButton() {
    const router = useRouter()
    
    return (
        <button 
            onClick={() => router.back()} 
            style={{ 
                display: 'flex', alignItems: 'center', color: '#3b82f6', 
                textDecoration: 'none', fontWeight: 600, marginRight: 24, 
                padding: '10px 16px', background: 'var(--bg-card)', borderRadius: 10, 
                border: '1px solid var(--border-light)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem'
            }}
        >
            <ArrowLeft size={18} style={{ marginRight: 8 }} /> Volver
        </button>
    )
}
