"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, ChevronRight, FileX } from 'lucide-react'
import { usePeriod } from '@/components/PeriodProvider'

export function FeaturedMagazine({ variant }: { variant?: string }) {
    const [mag, setMag] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const { activePeriodKey } = usePeriod()

    useEffect(() => {
        if (!activePeriodKey) return;
        setLoading(true);
        const [year, month] = activePeriodKey.split('_').map(Number);
        
        fetch(`/api/revistas?public=true&t=${Date.now()}`, { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
                if (!Array.isArray(data) || data.length === 0) {
                    setMag(null);
                    return;
                }
                const periodMag = data.find((m: any) => m.year === year && m.month === month)
                setMag(periodMag || null)
            })
            .catch(e => console.error(e))
            .finally(() => setLoading(false))
    }, [activePeriodKey])

    if (loading) return (
        <div style={{ background: 'var(--bg-app)', borderRadius: 12, height: '100%', minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
            <div style={{ color: 'var(--medium-gray)', fontSize: 13, fontWeight: 600 }}>Cargando catálogo...</div>
        </div>
    )

    if (!mag) return (
        <div style={{
            background: 'var(--bg-card)', borderRadius: 16,
            display: 'flex', flexDirection: 'column',
            height: '100%', minHeight: 280, overflow: 'hidden',
            border: '1px solid #0ea5e920',
            boxShadow: '0 8px 32px -8px rgba(14,165,233,0.15)',
        }}>
            {/* Visual area */}
            <div style={{
                position: 'relative', flex: 1, minHeight: 160,
                background: 'linear-gradient(135deg, #0f172a 0%, #0c4a6e 50%, #0ea5e9 100%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', padding: 24
            }}>
                {/* Decorative rings */}
                <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', border: '1px solid rgba(14,165,233,0.2)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                <div style={{ position: 'absolute', width: 130, height: 130, borderRadius: '50%', border: '1px solid rgba(14,165,233,0.15)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                {/* Shimmer lines */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(255,255,255,0.01) 30px, rgba(255,255,255,0.01) 60px)' }} />
                {/* Badge */}
                <div style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', color: '#0f172a', fontSize: 9, fontWeight: 900, letterSpacing: 2.5, padding: '4px 12px', borderRadius: 20, marginBottom: 14, textTransform: 'uppercase' }}>✦ Próximamente</div>
                {/* Icon */}
                <BookOpen size={36} style={{ color: 'rgba(255,255,255,0.9)', marginBottom: 12 }} strokeWidth={1.5} />
                {/* Title */}
                <div style={{ color: '#fff', fontWeight: 900, fontSize: 18, textAlign: 'center', letterSpacing: -0.3, fontFamily: 'serif', lineHeight: 1.2 }}>La Nueva<br/>Revista</div>
            </div>
            {/* Footer */}
            <div style={{ padding: '14px 18px', borderTop: '1px solid #0ea5e920' }}>
                <div style={{ fontSize: 10, color: '#0ea5e9', fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>Revista del Mes</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>Edición mensual en preparación. Disponible próximamente.</div>
            </div>
        </div>
    )

    const FallbackCover = ({ title }: { title: string }) => (
        <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg, #0f172a 0%, #0ea5e9 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '16px 12px', textAlign: 'center', color: 'var(--bg-card)'
        }}>
            <BookOpen size={32} opacity={0.4} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'serif', letterSpacing: 0.5, lineHeight: 1.2 }}>{title}</div>
            <div style={{ marginTop: 'auto', fontSize: 10, opacity: 0.6, letterSpacing: 2 }}>MICROSHOP EDITORIAL</div>
        </div>
    )

    return (
        <div
            onClick={() => router.push(`/revistas/${mag.slug}`)}
            style={{
                background: 'var(--bg-card)',
                borderRadius: 12, cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                color: 'var(--text-main)',
                border: '1px solid var(--border-color)',
                transition: 'all 0.3s ease',
                padding: 14,
                boxShadow: '0 4px 14px -5px rgba(0,0,0,0.05)',
                height: '100%'
            }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 12px 30px -10px rgba(0,0,0,0.1)'
                e.currentTarget.style.borderColor = '#0ea5e9'
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 4px 20px -5px rgba(0,0,0,0.05)'
                e.currentTarget.style.borderColor = 'var(--border-color)'
            }}
        >
            <div style={{
                width: '100%', aspectRatio: '1/1.414', borderRadius: 8, overflow: 'hidden',
                boxShadow: '0 4px 14px -4px rgba(0,0,0,0.1)',
                background: 'var(--bg-app)', marginBottom: 14
            }}>
                {mag.coverUrl ? (
                    <img src={mag.coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Portada" />
                ) : <FallbackCover title={mag.title} />}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ color: '#0ea5e9', fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                    Revista del Mes
                </span>
                {mag.isFeatured && (
                    <span style={{ background: 'var(--text-main)', color: 'var(--bg-card)', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                        ACTIVA
                    </span>
                )}
            </div>
            
            <h3 style={{ fontSize: 15, margin: '0 0 6px 0', fontWeight: 800, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {mag.title}
             </h3>
            
            <div style={{ fontSize: 13, color: 'var(--medium-gray)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
                <BookOpen size={14} /> EDICIÓN {mag.month}/{mag.year}
            </div>
            
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-color)' }}>
                <button
                    onClick={(e) => { e.stopPropagation(); router.push('/revistas'); }}
                    style={{
                        background: 'transparent', border: 'none', color: '#0ea5e9',
                        fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        padding: 0, display: 'flex', alignItems: 'center', gap: 4
                    }}
                >
                    Ver historial <ChevronRight size={14} />
                </button>
            </div>
        </div>
    )
}
