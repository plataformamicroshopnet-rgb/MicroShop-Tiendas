import re

filepath = 'src/app/liquidacion/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove isEditMode and cardOrder states and gear icon
content = content.replace("const [isEditMode, setIsEditMode] = useState(false)", "")
content = content.replace("const [cardOrder, setCardOrder] = useState<string[]>([])", "")
content = content.replace("import { Search, Info, Plus, FileText, ChevronDown, RefreshCw, BarChart2, Briefcase, Settings, X, Calendar, Download, Trash2, ArrowUp, ArrowDown, Users, Save, Settings2, Map } from 'lucide-react'", "import { Search, Info, Plus, FileText, ChevronDown, RefreshCw, BarChart2, Briefcase, Settings, X, Calendar, Download, Trash2, Users, Map } from 'lucide-react'")

gear_logic_old = """                        {isEditMode ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button onClick={() => {
                                setIsEditMode(false)
                            }} title="Cancelar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                            <button onClick={() => {
                                const defaultCards = ['Operaciones Telefónica', 'Operaciones por Grupo Cliente']
                                const currentOrder = cardOrder.length > 0 ? cardOrder : defaultCards;
                                localStorage.setItem('telefonica_card_order', JSON.stringify(currentOrder));
                                setIsEditMode(false);
                            }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: 40, borderRadius: 20, background: '#10b981', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)' }}>
                                <Save size={18} /> Guardar Orden
                            </button>
                        </div>
                        ) : (
                            <button onClick={() => { 
                                setIsEditMode(true); 
                                if(cardOrder.length === 0) setCardOrder(['Operaciones Telefónica', 'Operaciones por Grupo Cliente']); 
                            }} title="Personalizar Orden" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                                <Settings2 size={20} />
                            </button>
                        )}"""
content = content.replace(gear_logic_old, "")


# 2. Replace renderMenu logic
old_render_menu_start = """        const sortedCards = (() => {
            if (cardOrder.length === 0) return menuCardsRaw;
            return [...menuCardsRaw].sort((a, b) => {
                const idxA = cardOrder.indexOf(a.title);
                const idxB = cardOrder.indexOf(b.title);
                return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
            });
        })();

        const moveCard = (index: number, direction: 'up' | 'down') => {
            if (direction === 'up' && index === 0) return;
            if (direction === 'down' && index === sortedCards.length - 1) return;
            
            const newSorted = [...sortedCards];
            const swapIdx = direction === 'up' ? index - 1 : index + 1;
            const temp = newSorted[index];
            newSorted[index] = newSorted[swapIdx];
            newSorted[swapIdx] = temp;
            
            setCardOrder(newSorted.map(c => c.title));
        };

        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '16px' }}>
                <style dangerouslySetInnerHTML={{__html: `
                    @keyframes wiggle {
                        0% { transform: rotate(0deg); }
                        25% { transform: rotate(-0.5deg); }
                        50% { transform: rotate(0deg); }
                        75% { transform: rotate(0.5deg); }
                        100% { transform: rotate(0deg); }
                    }
                    .wiggle-mode {
                        animation: wiggle 0.4s infinite;
                        border: 2px dashed #3b82f6 !important;
                    }
                `}} />
                {sortedCards.map((c: any, i: number) => {
                    const Icon = c.icon;
                    return (
                        <div 
                            key={c.title} 
                            className={`premium-card ${isEditMode ? 'wiggle-mode' : ''}`} 
                            onClick={isEditMode ? undefined : () => c.href ? router.push(c.href) : setCurrentView(c.view)}
                            style={{ 
                            position: 'relative', 
                            cursor: isEditMode ? 'default' : 'pointer', 
                            borderLeft: c.title === 'Agenda de Llamadas Cristina' ? '5px solid #5CB615' : 
                                        c.title === 'Operaciones Telefónica' || c.title === 'Operaciones por Grupo Cliente' ? '5px solid #b8860b' :
                                        c.title === 'Rentabilidad por Tiendas' || c.title === 'Territorial Tiendas / O2' ? '5px solid #0ea5e9' : 
                                        '1px solid transparent' 
                        }}
                        >
                            {isEditMode && (
                                <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: 4, background: 'var(--bg-card)', padding: 4, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid var(--border-light)' }}>
                                    <button onClick={(e) => { e.stopPropagation(); moveCard(i, 'up') }} disabled={i === 0} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', background: i === 0 ? 'transparent' : 'var(--bg-input)', color: i === 0 ? 'var(--border-strong)' : 'var(--text-main)', cursor: i === 0 ? 'not-allowed' : 'pointer' }}>
                                        <ArrowUp size={16} />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); moveCard(i, 'down') }} disabled={i === sortedCards.length - 1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', background: i === sortedCards.length - 1 ? 'transparent' : 'var(--bg-input)', color: i === sortedCards.length - 1 ? 'var(--border-strong)' : 'var(--text-main)', cursor: i === sortedCards.length - 1 ? 'not-allowed' : 'pointer' }}>
                                        <ArrowDown size={16} />
                                    </button>
                                </div>
                            )}

                            <div className="card-icon-wrapper" style={
                                c.title === 'Agenda de Llamadas Cristina' ? { backgroundColor: 'rgba(92, 182, 21, 0.1)', color: '#5CB615' } : 
                                c.title === 'Operaciones Telefónica' || c.title === 'Operaciones por Grupo Cliente' ? { backgroundColor: 'rgba(184, 134, 11, 0.1)', color: '#b8860b' } :
                                c.title === 'Rentabilidad por Tiendas' || c.title === 'Territorial Tiendas / O2' ? { backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9' } :
                                c.href ? { backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' } : 
                                c.isSub ? { backgroundColor: 'rgba(107, 114, 128, 0.1)', color: 'var(--text-muted)' } : 
                                { backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }
                            }>
                                <Icon size={24} strokeWidth={2.5} />
                            </div>
                            <h3 className="card-title">{c.title}</h3>
                            <p className="card-desc">{c.description}</p>
                        </div>
                    )
                })}
            </div>
        )
    }"""

new_render_menu_start = """        const renderCard = (c: any) => {
            const Icon = c.icon;
            return (
                <div 
                    key={c.title} 
                    className="premium-card"
                    onClick={() => c.href ? router.push(c.href) : setCurrentView(c.view)}
                    style={{ 
                        position: 'relative', 
                        cursor: 'pointer', 
                        borderLeft: c.title === 'Agenda de Llamadas Cristina' ? '5px solid #5CB615' : 
                                    c.title === 'Operaciones Telefónica' || c.title === 'Operaciones por Grupo Cliente' ? '5px solid #b8860b' :
                                    c.title === 'Rentabilidad por Tiendas' || c.title === 'Territorial Tiendas / O2' ? '5px solid #0ea5e9' : 
                                    '1px solid transparent' 
                    }}
                >
                    <div className="card-icon-wrapper" style={
                        c.title === 'Agenda de Llamadas Cristina' ? { backgroundColor: 'rgba(92, 182, 21, 0.1)', color: '#5CB615' } : 
                        c.title === 'Operaciones Telefónica' || c.title === 'Operaciones por Grupo Cliente' ? { backgroundColor: 'rgba(184, 134, 11, 0.1)', color: '#b8860b' } :
                        c.title === 'Rentabilidad por Tiendas' || c.title === 'Territorial Tiendas / O2' ? { backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9' } :
                        { backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }
                    }>
                        <Icon size={24} strokeWidth={2.5} />
                    </div>
                    <h3 className="card-title">{c.title}</h3>
                    <p className="card-desc">{c.description}</p>
                </div>
            );
        };

        const brownCards = menuCardsRaw.filter(c => c.title === 'Operaciones Telefónica' || c.title === 'Operaciones por Grupo Cliente');
        const blueCards = menuCardsRaw.filter(c => c.title === 'Rentabilidad por Tiendas' || c.title === 'Territorial Tiendas / O2');
        const greenCards = menuCardsRaw.filter(c => c.title === 'Agenda de Llamadas Cristina');

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                    {brownCards.map(renderCard)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                    {blueCards.map(renderCard)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                    {greenCards.map(renderCard)}
                </div>
            </div>
        )
    }"""
content = content.replace(old_render_menu_start, new_render_menu_start)

# Clean up useEffect references to cardOrder
content = content.replace("""    useEffect(() => {
        const saved = localStorage.getItem('telefonica_card_order')
        if (saved) {
            try {
                setCardOrder(JSON.parse(saved))
            } catch (e) { }
        }
    }, [])""", "")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Placed cards in 3 rows grouped by color")
