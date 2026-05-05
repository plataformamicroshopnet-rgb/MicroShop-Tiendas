"use client"

import { useState, useEffect } from 'react';

export default function MagazineViewer({ magazine }: { magazine: any }) {
    const [isMobile, setIsMobile] = useState<boolean | null>(null);

    const rawPdfUrl =
        magazine?.pdfUrl ||
        magazine?.fileUrl ||
        magazine?.url ||
        magazine?.archivo ||
        magazine?.pdf ||
        "";

    const getPdfUrl = (url: string) => {
        if (!url) return "";
        if (url.startsWith('http') || url.startsWith('/')) return url;
        return `/revistas_uploads/${url}`;
    };

    const pdfUrl = getPdfUrl(rawPdfUrl);

    useEffect(() => {
        const checkIsMobile = () => {
            const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) || window.innerWidth <= 768;
        };
        setIsMobile(checkIsMobile());

        const handleResize = () => setIsMobile(checkIsMobile());
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (!pdfUrl) {
        return (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', marginTop: 100 }}>
                No se ha encontrado el archivo PDF de esta revista.
            </div>
        )
    }

    // Evitamos renderizado discordante entre servidor y cliente (hydration mismatch)
    if (isMobile === null) {
        return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-app)', color: '#94a3b8' }}>Preparando documento...</div>;
    }

    // ============================================
    // COMPORTAMIENTO BIFURCADO: MÓVIL
    // ============================================
    if (isMobile) {
        return (
            <div style={{ padding: 24, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)' }}>
                <div style={{ background: 'var(--bg-card)', padding: 40, borderRadius: 24, boxShadow: '0 20px 40px -15px rgba(15,23,42,0.1)', textAlign: 'center', maxWidth: 400, width: '100%', border: '1px solid var(--border-light)' }}>
                    <div style={{ background: '#e0f2fe', width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <h2 style={{ margin: '0 0 16px 0', fontSize: 24, color: 'var(--text-main)', fontWeight: 900, letterSpacing: '-0.5px' }}>Lector Móvil</h2>
                    <p style={{ margin: '0 0 32px 0', color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6 }}>
                        Abre el documento a <strong>pantalla completa</strong> con el visor nativo de tu teléfono para leer, ampliar y desplazarte sin molestias.
                    </p>
                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--text-main)', color: 'var(--bg-card)', padding: '18px 24px', borderRadius: 14, fontWeight: 700, fontSize: 16, textDecoration: 'none', boxShadow: '0 10px 25px -5px rgba(15,23,42,0.3)' }}>
                        Abrir Documento ↗
                    </a>

                    <button onClick={() => window.history.back()} style={{ display: 'block', width: '100%', marginTop: 24, background: 'none', border: 'none', color: '#94a3b8', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 12 }}>
                        Volver a Biblioteca
                    </button>
                </div>
            </div>
        )
    }

    // ============================================
    // COMPORTAMIENTO BIFURCADO: ESCRITORIO
    // ============================================
    const responsivePdfUrl = `${pdfUrl}#view=FitH`;

    return (
        <div style={{ width: "100%", height: "100vh", overflow: "hidden", WebkitOverflowScrolling: "touch" }}>
            <iframe
                src={responsivePdfUrl}
                title={magazine?.title || "Documento Administrativo"}
                style={{ width: "100%", height: "100%", border: "none", overflow: "hidden" }}
            />
        </div>
    )
}