import { AdminDocumentManager } from '@/components/admin/AdminDocumentManager'

export default function CatalogoMovistarPage() {
    return (
        <AdminDocumentManager 
            type="catalogo" 
            title="Catálogo Dispositivos Movistar" 
            iconName="smartphone" 
            descriptionHint="Recuerda que los catálogos deben subirse en formato Horizontal (DIN A4 apaisado)."
            helpContent={
                <div>
                    <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Catálogo Dispositivos</h4>
                    <p style={{ margin: 0, lineHeight: 1.5 }}>Librería comercial para la red de ventas. Sube el último porfolio oficial en PDF (ej. Catálogo Fusión, Terminales Libres). Al estar integrado en el ERP, aseguras que todo el equipo maneje los mismos precios y promociones actualizadas cuando están en la calle frente al cliente.</p>
                </div>
            }
        />
    )
}
