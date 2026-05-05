import { AdminDocumentManager } from '@/components/admin/AdminDocumentManager'

export default function RevistasAdminPage() {
    return (
        <AdminDocumentManager 
            type="revista" 
            title="Gestión Editorial Administrativa" 
            iconName="star" 
            descriptionHint=""
            helpContent={
                <div>
                    <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Revista Corporativa</h4>
                    <p style={{ margin: 0, lineHeight: 1.5 }}>Centro de distribución de prensa interna. Sube el último número de la revista de empresa en PDF junto con su portada. Los comerciales verán en su dashboard principal una notificación cuando haya una nueva edición disponible, lo que fomenta la lectura y el sentimiento de pertenencia.</p>
                </div>
            }
        />
    )
}
