import os

filepath = 'src/app/liquidacion/territorial/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = content.replace(
    "import { TIENDAS_COMERCIALES } from '@/lib/constants'",
    "import { TIENDAS_COMERCIALES } from '@/lib/constants'\nimport ProductTreeSelector from '@/components/ProductTreeSelector'\nimport { matchTipoVenta } from '@/hooks/useComisionesData'"
)

# 2. Remove CATEGORIES
content = content.replace("""const CATEGORIES = [
  'Contratos Móvil', 'Rent', 'O2 MovilFree', 'Seguro', 'miMovistar', 
  'Suscripciones TV', 'Prepago', 'Varios', 'Repos', 'Resto BAF', 
  'Altas Internas y Externas', 'Altas BAF', 'Altas BAF Movistar Convergente', 
  'Fibra FTTR', 'Dispositivos', 'Repo Futbol', 'O2'
];""", "")

# 3. Update countSalesForStoreAndType
old_logic = """    // El "tipoVenta" de la regla suele machear con el "producto" o con el "detalle"
    const isProductMatch = (sale: any) => 
      String(sale.producto || '').toLowerCase().includes(tipoVenta.toLowerCase()) || 
      String(sale.detalle || '').toLowerCase().includes(tipoVenta.toLowerCase());

    const isAmountMatch = (sale: any) => isProductMatch(sale);"""

new_logic = """    const isProductMatch = (sale: any) => matchTipoVenta(sale, tipoVenta);"""
content = content.replace(old_logic, new_logic)

# 4. Table 1 (Tiendas): Replace Select with ProductTreeSelector
old_select_1 = """                      <select value={rule.tipoVenta} onChange={e => { const r = [...tiendasRules]; r[idx].tipoVenta = e.target.value; setTiendasRules(r); }} className="form-input" style={{ width: '100%' }}>
                        <option value="">Seleccionar</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>"""
new_select_1 = """                      <ProductTreeSelector 
                        value={rule.tipoVenta || ''} 
                        onChange={val => { const r = [...tiendasRules]; r[idx].tipoVenta = val; setTiendasRules(r); }} 
                        placeholder="Tipo de Venta..." 
                      />"""
content = content.replace(old_select_1, new_select_1)

# 5. Table 2 (O2): Replace Select with ProductTreeSelector
old_select_2 = """                      <select value={rule.tipoVenta} onChange={e => { const r = [...o2Rules]; r[idx].tipoVenta = e.target.value; setO2Rules(r); }} className="form-input" style={{ width: '100%' }}>
                        <option value="">Seleccionar</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>"""
new_select_2 = """                      <ProductTreeSelector 
                        value={rule.tipoVenta || ''} 
                        onChange={val => { const r = [...o2Rules]; r[idx].tipoVenta = val; setO2Rules(r); }} 
                        placeholder="Tipo de Venta..." 
                      />"""
content = content.replace(old_select_2, new_select_2)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated ProductTreeSelector")
