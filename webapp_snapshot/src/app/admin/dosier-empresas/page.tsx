import { AdminDocumentManager } from '@/components/admin/AdminDocumentManager'

export default function DosierEmpresasPage() {
    return (
        <AdminDocumentManager 
            type="dosier" 
            title="Dosier Telefónica Empresas" 
            iconName="briefcase" 
            descriptionHint="Recuerda que los dosiers deben subirse en formato Horizontal (DIN A4 apaisado)."
            helpContent={
                <div>
                    <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Dosier Empresas</h4>
                    <p style={{ margin: 0, lineHeight: 1.5 }}>Repositorio B2B (Business to Business). Dedicado exclusivamente a la documentación oficial para autónomos y pymes (Centralitas, IP Fija, Cloud). Separa claramente la oferta corporativa del catálogo residencial tradicional.</p>
                </div>
            }
        />
    )
}
