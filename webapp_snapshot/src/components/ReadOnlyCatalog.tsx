'use client'

import { useEffect, useState } from 'react'
import { Search, ChevronLeft, Smartphone, ShieldCheck, Tag } from 'lucide-react'
import Link from 'next/link'

type ProductItem = {
  id: string
  producto: string
  cuotaMensual?: number
  cuotaAnual?: number
}

interface ReadOnlyCatalogProps {
  category: 'Ti' | 'TMA' | 'Micro'
  title: string
  iconColor: string
}

export default function ReadOnlyCatalog({ category, title, iconColor }: ReadOnlyCatalogProps) {
  const Icon = category === 'Ti' ? Smartphone : category === 'TMA' ? ShieldCheck : Tag;
  
  const [data, setData] = useState<ProductItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/catalogs')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.catalogs && data.catalogs[category]) {
           const items = data.catalogs[category].map((it: any) => ({
               ...it,
               id: it.id || String(Math.random()),
               cuotaMensual: Number(String(it.mensual || 0).replace(',','.')),
               cuotaAnual: Number(String(it.anual || 0).replace(',','.'))
           }))
           setData(items)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [category])

  const filteredData = data.filter(p => p.producto.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ padding: 20, paddingBottom: 60 }}>
      {/* HEADER LOCAL */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, marginTop: 12, flexWrap: 'wrap' }}>
        <Link href="/tiendas" className="btn btn-secondary" style={{ padding: '8px 12px' }}>
          <ChevronLeft size={20} />
          Volver
        </Link>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, margin: 0 }}>
            <Icon size={28} style={{ color: iconColor }} /> {title} <span style={{fontSize: 14, fontWeight: 'normal', color: 'var(--medium-gray)', marginLeft: 8}}>(Solo Lectura)</span>
          </h1>
        </div>
      </div>

      {/* TOOLBAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 250 }}>
          <Search size={18} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--medium-gray)' }} />
          <input 
            type="text" 
            placeholder={`Buscar en ${title}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input"
            style={{ paddingLeft: 40, width: '100%', maxWidth: 400 }}
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
          <table style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--active-bg)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--active-bg)', padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)', width: '50%' }}>Nombre de Producto</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--active-bg)', padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)' }}>Cuota Mensual (€)</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--active-bg)', padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)' }}>Cuota Total (€)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} style={{ padding: 30, textAlign: 'center', color: 'var(--medium-gray)' }}>
                    Cargando catálogo...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: 30, textAlign: 'center', color: 'var(--medium-gray)' }}>
                    No se encontraron productos.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr key={item.id || index} style={{ borderBottom: '1px solid var(--table-border)' }}>
                    <td style={{ padding: '12px 20px', fontWeight: 500 }}>
                      {item.producto}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{ color: 'var(--mercedes-cyan)', fontWeight: 'bold', fontSize: 15 }}>
                        {item.cuotaMensual !== undefined ? Number(item.cuotaMensual).toFixed(2) : '0.00'}
                      </span>
                      <span style={{ color: 'var(--medium-gray)', fontSize: 13, marginLeft: 4 }}>€</span>
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{ color: 'var(--medium-gray)', fontSize: 15 }}>
                        {item.cuotaAnual !== undefined ? Number(item.cuotaAnual).toFixed(2) : '0.00'}
                      </span>
                      <span style={{ color: 'var(--medium-gray)', fontSize: 13, marginLeft: 4 }}>€</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
