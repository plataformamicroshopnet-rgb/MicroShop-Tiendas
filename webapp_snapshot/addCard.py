import re

filepath = 'src/app/liquidacion/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add the new card definition in menuCardsRaw
card_insert = """              {
                  title: 'Rentabilidad por Tiendas',
                  description: 'Análisis horizontal de operaciones y comisiones generadas por cada tienda y comercial',
                  icon: Building2,
                  href: '/liquidacion/rentabilidad-tiendas'
              },
              {
                  title: 'Territorial Tiendas / O2',
                  description: 'Configuración y cálculo de tramos y comisiones territoriales por tienda y O2 MovilFree.',
                  icon: Map,
                  href: '/liquidacion/territorial'
              },"""

content = content.replace("""              {
                  title: 'Rentabilidad por Tiendas',
                  description: 'Análisis horizontal de operaciones y comisiones generadas por cada tienda y comercial',
                  icon: Building2,
                  href: '/liquidacion/rentabilidad-tiendas'
              },""", card_insert)

# Add import Map if needed
if "Map," not in content and "Map " not in content:
    content = content.replace("import { Briefcase, BarChart2, Users, Calendar, Settings, ArrowLeft, Plus, Trash2, Edit2, Save, X, RefreshCw, Upload, Download, MapPin, Search, Filter, Shield, Building2 } from 'lucide-react'", 
                              "import { Briefcase, BarChart2, Users, Calendar, Settings, ArrowLeft, Plus, Trash2, Edit2, Save, X, RefreshCw, Upload, Download, MapPin, Search, Filter, Shield, Building2, Map } from 'lucide-react'")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Card injected")
