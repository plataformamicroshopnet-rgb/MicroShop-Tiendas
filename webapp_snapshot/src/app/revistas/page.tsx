import { PrismaClient } from '@prisma/client'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { MagazineBackButton } from '@/components/MagazineBackButton'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

const monthNames = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
]
const getMonthName = (m: number) => (m >= 1 && m <= 12) ? monthNames[m - 1] : 'EDICIÓN ESPECIAL'

const getMediaUrl = (url: string | null) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('/')) return url;
    return `/revistas_uploads/${url}`;
}

const getCoverRaw = (mag: any) => {
    return mag?.coverUrl ||
           mag?.cover ||
           mag?.coverImage ||
           mag?.portada ||
           mag?.imageUrl ||
           mag?.thumbnail ||
           "";
}

const isHorizontal = (slug: string) => {
    return slug?.startsWith('catalogo-') || slug?.startsWith('dosier-');
}

const getDocType = (slug: string) => {
    if (slug?.startsWith('catalogo-')) return 'CATÁLOGO';
    if (slug?.startsWith('dosier-')) return 'DOSIER';
    return 'REVISTA';
}

const getTypeColor = (slug: string) => {
    if (slug?.startsWith('catalogo-')) return '#10b981'; // emerald
    if (slug?.startsWith('dosier-')) return '#f59e0b'; // amber
    return '#0ea5e9'; // sky blue
}

const FallbackCover = ({ title }: { title: string }) => (
    <div style={{ 
        width: '100%', height: '100%',
        background: 'linear-gradient(135deg, #0f172a 0%, #0891b2 100%)', 
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px', textAlign: 'center', color: 'var(--bg-card)'
    }}>
        <BookOpen size={40} opacity={0.4} style={{ marginBottom: 16 }} />
        <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'serif', letterSpacing: 0.5, lineHeight: 1.2 }}>{title}</div>
        <div style={{ marginTop: 'auto', fontSize: 9, opacity: 0.6, letterSpacing: 2 }}>MICROSHOP EDITORIAL</div>
    </div>
)

export default async function MagazineHistoryPage() {
    const magazines = await prisma.magazine.findMany({
        where: { isPublished: true },
        orderBy: [ { year: 'desc' }, { month: 'desc' } ]
    })

    const featured = magazines.find((m: any) => m.isFeatured) || magazines[0]
    const otherMagazines = featured ? magazines.filter((m: any) => m.id !== featured.id) : magazines

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-app)', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
            {/* CSS inyectado para hover effects en Server Component */}
            <style dangerouslySetInnerHTML={{__html: `
                .mag-hero { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
                .mag-hero:hover { transform: translateY(-4px); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15) !important; }
                .mag-card { transition: all 0.3s ease; }
                .mag-card:hover .mag-cover { transform: translateY(-6px); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.2) !important; }
                .mag-card:hover h3 { color: #0ea5e9 !important; }
            `}} />

            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
                    <MagazineBackButton />
                    <div>
                        <h1 style={{ fontSize: 32, color: 'var(--text-main)', margin: '0 0 6px 0', fontWeight: 900, letterSpacing: '-0.5px' }}>Biblioteca Corporativa</h1>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 16 }}>Acceso centralizado a documentos, catálogos y operativas oficiales.</p>
                    </div>
                </div>

                {magazines.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 16, border: '1px dashed #cbd5e1' }}>
                        <BookOpen size={48} style={{ opacity: 0.2, marginBottom: 20 }} />
                        <h3 style={{ margin: 0, fontSize: 18 }}>El catálogo está vacío</h3>
                    </div>
                ) : (
                    <>
                        {/* HERO: REVISTA DESTACADA */}
                        {featured && (
                            <Link href={`/revistas/${featured.slug}`} style={{ textDecoration: 'none', display: 'block' }} className="mag-hero">
                                <div style={{ 
                                    background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)', 
                                    borderRadius: 24, display: 'flex', flexWrap: 'wrap', 
                                    color: 'var(--text-main)', border: '1px solid var(--border-light)', marginBottom: 60,
                                    boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.08)', overflow: 'hidden',
                                    position: 'relative'
                                }}>
                                    {/* Adorno visual Premium */}
                                    <div style={{ position: 'absolute', top: 0, right: 0, width: '40%', height: '100%', background: 'radial-gradient(circle at top right, rgba(14, 165, 233, 0.04), transparent 70%)', pointerEvents: 'none' }} />

                                    <div style={{ flex: '0 0 auto', width: isHorizontal(featured.slug) ? 'clamp(280px, 45%, 450px)' : 'clamp(200px, 35%, 320px)', padding: 40, background: 'rgba(248, 250, 252, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRight: '1px solid rgba(226, 232, 240, 0.5)' }}>
                                          <div style={{ width: '100%', aspectRatio: isHorizontal(featured.slug) ? '1.414/1' : '1/1.414', borderRadius: 12, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)', background: 'var(--bg-card)' }}>
                                              {getCoverRaw(featured) ? <img src={getMediaUrl(getCoverRaw(featured))} alt="portada" style={{ width: "100%", height: "100%", objectFit: isHorizontal(featured.slug) ? 'cover' : 'cover' }} /> : <FallbackCover title={featured.title} />}
                                         </div>
                                    </div>
                                    <div style={{ flex: '1 1 300px', padding: '56px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 1 }}>
                                         <div style={{ color: getTypeColor(featured.slug), fontSize: 12, fontWeight: 800, letterSpacing: 2, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                             <span style={{ width: 24, height: 2, background: getTypeColor(featured.slug), borderRadius: 2 }} /> {getDocType(featured.slug)} PRINCIPAL
                                         </div>
                                         <h2 style={{ fontSize: 40, margin: '0 0 16px 0', fontWeight: 900, letterSpacing: '-1px', lineHeight: 1.1, color: 'var(--text-main)' }}>{featured.title}</h2>
                                         <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-app)', padding: '6px 12px', borderRadius: 8, width: 'fit-content', border: '1px solid var(--border-light)' }}>
                                             <BookOpen size={16} color="#0ea5e9" /> EDICIÓN {getMonthName(featured.month)} {featured.year}
                                         </div>
                                         <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.6, maxWidth: 540, marginBottom: 48 }}>
                                             {featured.description || 'Incluye operativas comerciales, catálogos de productos, condiciones vigentes y documentación técnica clave para el equipo.'}
                                         </p>
                                         <div>
                                             <span className="btn-hero-cta" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'var(--text-main)', color: 'var(--bg-card)', padding: '16px 32px', borderRadius: 12, fontWeight: 700, fontSize: 15, boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.4)', transition: 'all 0.3s' }}>
                                                Acceder al documento &rarr;
                                             </span>
                                         </div>
                                    </div>
                                </div>
                            </Link>
                        )}

                        {/* GRID: PUBLICACIONES ANTERIORES */}
                        {otherMagazines.length > 0 && (
                            <>
                                <h3 style={{ fontSize: 20, color: 'var(--text-main)', fontWeight: 800, marginBottom: 24, paddingBottom: 12, borderBottom: '2px solid #e2e8f0' }}>Archivo Documental</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 220px)', gap: 32, justifyContent: 'start' }}>
                                    {otherMagazines.map((mag: any) => (
                                        <Link key={mag.id} href={`/revistas/${mag.slug}`} style={{ textDecoration: 'none' }} className="mag-card">
                                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                                <div className="mag-cover" style={{ width: '100%', aspectRatio: isHorizontal(mag.slug) ? '1.414/1' : '1/1.414', borderRadius: 12, overflow: 'hidden', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', marginBottom: 16, background: 'var(--bg-card)' }}>
                                                    {getCoverRaw(mag) ? <img src={getMediaUrl(getCoverRaw(mag))} alt="portada" style={{ width: "100%", borderRadius: 10, height: "100%", objectFit: "cover" }} /> : <FallbackCover title={mag.title} />}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', background: `${getTypeColor(mag.slug)}20`, color: getTypeColor(mag.slug), borderRadius: 4, letterSpacing: 0.5 }}>{getDocType(mag.slug)}</span>
                                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 1 }}>{getMonthName(mag.month)} {mag.year}</span>
                                                </div>
                                                <h3 style={{ color: 'var(--text-main)', margin: '0 0 12px 0', fontSize: 18, fontWeight: 800, lineHeight: 1.25 }}>
                                                    {mag.title}
                                                </h3>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
