import re

filepath = 'src/app/liquidacion/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

card_insert = """              {
                  title: 'Territorial Tiendas / O2',
                  description: 'Configuración y cálculo de tramos territoriales por tienda y O2 MovilFree.',
                  icon: Map,
                  href: '/liquidacion/territorial'
              }
          ];"""

content = content.replace("              }\n          ];", card_insert)

if "Map," not in content and "Map " not in content:
    content = content.replace("import { Briefcase, BarChart2, Users, Calendar, Settings, ArrowLeft, Plus, Trash2, Edit2, Save, X, RefreshCw, Upload, Download, MapPin, Search, Filter, Shield, Building2 }", 
                              "import { Briefcase, BarChart2, Users, Calendar, Settings, ArrowLeft, Plus, Trash2, Edit2, Save, X, RefreshCw, Upload, Download, MapPin, Search, Filter, Shield, Building2, Map }")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Card injected successfully")
