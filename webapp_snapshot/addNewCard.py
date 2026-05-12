import re

filepath = 'src/app/liquidacion/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add TrendingUp to lucide-react imports
content = content.replace("import { Search, Info, Plus, FileText, ChevronDown, RefreshCw, BarChart2, Briefcase, Settings, X, Calendar, Download, Trash2, Users, Map } from 'lucide-react'", "import { Search, Info, Plus, FileText, ChevronDown, RefreshCw, BarChart2, Briefcase, Settings, X, Calendar, Download, Trash2, Users, Map, TrendingUp } from 'lucide-react'")

# Add new card to menuCardsRaw
new_card = """            {
                title: 'Territorial Tiendas / O2',
                description: 'Configuración y cálculo de tramos territoriales por tienda y O2 MovilFree.',
                icon: Map,
                href: '/liquidacion/territorial'
            },
            {
                title: 'Rentabilidad Total de Tiendas Movistar/O2/Movilfree',
                description: 'Módulo en construcción. Próximamente incluirá la estructura consolidada.',
                icon: TrendingUp,
                href: '#'
            }"""
content = content.replace("""            {
                title: 'Territorial Tiendas / O2',
                description: 'Configuración y cálculo de tramos territoriales por tienda y O2 MovilFree.',
                icon: Map,
                href: '/liquidacion/territorial'
            }""", new_card)

# Add to blueCards row and style logic
content = content.replace("c.title === 'Rentabilidad por Tiendas' || c.title === 'Territorial Tiendas / O2' ? '5px solid #0ea5e9'", "c.title === 'Rentabilidad por Tiendas' || c.title === 'Territorial Tiendas / O2' || c.title === 'Rentabilidad Total de Tiendas Movistar/O2/Movilfree' ? '5px solid #0ea5e9'")
content = content.replace("c.title === 'Rentabilidad por Tiendas' || c.title === 'Territorial Tiendas / O2' ? { backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9' }", "c.title === 'Rentabilidad por Tiendas' || c.title === 'Territorial Tiendas / O2' || c.title === 'Rentabilidad Total de Tiendas Movistar/O2/Movilfree' ? { backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9' }")
content = content.replace("const blueCards = menuCardsRaw.filter(c => c.title === 'Rentabilidad por Tiendas' || c.title === 'Territorial Tiendas / O2');", "const blueCards = menuCardsRaw.filter(c => c.title === 'Rentabilidad por Tiendas' || c.title === 'Territorial Tiendas / O2' || c.title === 'Rentabilidad Total de Tiendas Movistar/O2/Movilfree');")


with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Added new Rentabilidad Total card")
