import re

with open("temp.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace renderCard
new_render_card = """const renderCard = (info: TramoInfo, label: string, color: string, totalImporte: number, tramoAmt: number, tramoProyectado: number) => {
              if (!info || info.tramoVal === 0) return null
              const pje = info.pje || 0
              const isPercentage = info.isPercentage

              const TRAMOS = [
                { p: 50, label: '< 50%', col: '#EF4444', bg: '#FEE2E2' },
                { p: 80, label: '50-80%', col: '#F59E0B', bg: '#FEF3C7' },
                { p: 100, label: '80-100%', col: '#10B981', bg: '#D1FAE5' },
                { p: 999, label: '> 100%', col: '#3B82F6', bg: '#DBEAFE' }
              ]
              
              const tramoLabel = pje < 50 ? TRAMOS[0] : pje < 80 ? TRAMOS[1] : pje <= 100 ? TRAMOS[2] : TRAMOS[3]
              const activeColor = tramoLabel.col
              const activeBg = tramoLabel.bg
              const barPct = Math.min(pje, 130)

              return (
                <div style={{ flex: 1, minWidth: '100%', background: '#fff', border: `1px solid ${color}40`, borderRadius: 16, padding: '24px 32px', position: 'relative' }}>
                  
                  {/* Top Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ background: color, color: '#fff', fontSize: 13, fontWeight: 800, padding: '4px 12px', borderRadius: 20, letterSpacing: 1 }}>{label}</span>
                        <span style={{ fontSize: 15, color: 'var(--medium-gray)', fontWeight: 500 }}>Estado del Tramo</span>
                      </div>
                      <div style={{ marginTop: 12, fontSize: 16, color: 'var(--medium-gray)' }}>
                        Liquidación actual: <strong style={{ color }}>{info.tramoVal}{isPercentage ? '%' : '€/ud'}</strong>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, color: 'var(--medium-gray)', marginBottom: 4 }}>Pago de este grupo</div>
                      <div style={{ fontSize: 32, fontWeight: 900, color }}>{fmt(tramoAmt)}</div>
                    </div>
                  </div>

                  {/* Percentage Row */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 28, marginBottom: 32 }}>
                    <span style={{ fontSize: 56, fontWeight: 900, color: activeColor, letterSpacing: -1, lineHeight: 1 }}>{pje.toFixed(1)}%</span>
                    <span style={{ fontSize: 16, color: 'var(--medium-gray)', fontWeight: 500 }}>cumplimiento actual</span>
                    <span style={{ marginLeft: 'auto', background: activeBg, color: activeColor, border: `1px solid ${activeColor}40`, padding: '8px 20px', borderRadius: 24, fontWeight: 700, fontSize: 14 }}>
                      Tramo {tramoLabel.label}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ position: 'relative', marginBottom: 48 }}>
                    {/* Background segments */}
                    <div style={{ display: 'flex', height: 14, borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ width: '38.4%', background: '#FEE2E2', borderRight: '2px solid #fff' }} /> {/* 0-50% */}
                      <div style={{ width: '23.1%', background: '#FEF3C7', borderRight: '2px solid #fff' }} /> {/* 50-80% */}
                      <div style={{ width: '15.4%', background: '#D1FAE5', borderRight: '2px solid #fff' }} /> {/* 80-100% */}
                      <div style={{ width: '23.1%', background: '#DBEAFE' }} /> {/* >100% */}
                    </div>
                    
                    {/* Fill */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: `${(barPct / 130) * 100}%`, height: 14, borderRadius: 8, background: `linear-gradient(90deg, ${activeColor}99, ${activeColor})`, transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: `0 2px 10px ${activeColor}50` }} />
                    
                    {/* Markers */}
                    <div style={{ position: 'absolute', top: 22, left: 0, fontSize: 12, color: 'var(--medium-gray)', fontWeight: 600 }}>0%</div>
                    <div style={{ position: 'absolute', top: 22, left: '38.4%', transform: 'translateX(-50%)', fontSize: 12, color: 'var(--medium-gray)', fontWeight: 600 }}>50%</div>
                    <div style={{ position: 'absolute', top: 22, left: '61.5%', transform: 'translateX(-50%)', fontSize: 12, color: 'var(--medium-gray)', fontWeight: 600 }}>80%</div>
                    <div style={{ position: 'absolute', top: 22, left: '76.9%', transform: 'translateX(-50%)', fontSize: 12, color: 'var(--medium-gray)', fontWeight: 600 }}>100%</div>
                    <div style={{ position: 'absolute', top: 22, right: 0, fontSize: 12, color: 'var(--medium-gray)', fontWeight: 600 }}>+</div>
                  </div>

                  {/* Tramos Boxes */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
                    {TRAMOS.map((t, i) => {
                      const isActive = (i === 0 && pje < 50) || (i === 1 && pje >= 50 && pje < 80) || (i === 2 && pje >= 80 && pje <= 100) || (i === 3 && pje > 100)
                      return (
                        <div key={i} style={{
                          background: isActive ? t.bg : '#f8fafc',
                          border: isActive ? `2px solid ${t.col}` : '1px solid #e2e8f0',
                          borderRadius: 12, padding: '16px 8px', textAlign: 'center',
                          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                          height: 70
                        }}>
                          <div style={{ fontSize: 15, color: isActive ? t.col : 'var(--medium-gray)', fontWeight: isActive ? 800 : 500 }}>{t.label}</div>
                          {isActive && <div style={{ fontSize: 12, color: t.col, fontWeight: 900, marginTop: 4 }}>← AQUÍ</div>}
                        </div>
                      )
                    })}
                  </div>

                  {/* Footer Base de Cálculo */}
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 20, fontSize: 14, color: 'var(--medium-gray)' }}>
                    Base de cálculo: <strong style={{ color: '#1e293b', fontSize: 15 }}>{fmt(totalImporte)}</strong>
                  </div>
                </div>
              )
            }"""

start_idx = content.find("const renderCard =")
end_idx = content.find("return (", start_idx)
end_idx = content.find("}", end_idx) + 1

content = content[:start_idx] + new_render_card + content[end_idx:]

# 2. Change the flexWrap: 'wrap' to flexDirection: 'column'
content = content.replace("<div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>", "<div style={{ display: 'flex', gap: 24, marginBottom: 32, flexDirection: 'column' }}>")

# 3. Replace the 3-box Grand Total with the original
grand_total_start = content.find("{/* 📈 Grand total 📈 */}")
if grand_total_start == -1:
    grand_total_start = content.find("{/* 📊 Grand total 📊 */}")
if grand_total_start == -1:
    grand_total_start = content.find("{/* ── Grand total ── */}")

if grand_total_start != -1:
    end_sections = content.find("{/* ── Sections ── */}")
    
    old_grand_total = """          {/* 📈 Grand total 📈 */}
          <div style={{ marginTop: 8, padding: '18px 28px', background: `${tab.color}15`, border: `2px solid ${tab.color}40`, borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--medium-gray)', marginBottom: 2 }}>{tab.emoji} {tab.label} — GRAN TOTAL</div>
              <div style={{ fontSize: 12, color: 'var(--medium-gray)' }}>{tabSales.length} operaciones · {uniqueNifs} clientes</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: 'var(--medium-gray)', marginBottom: 2 }}>Importe total</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: tab.color }}>{fmt(grandTotal)}</div>
              {grandTramo > 0 && <div style={{ fontSize: 13, color: tab.color, fontWeight: 700 }}>Tramo total: {fmt(grandTramo)}</div>}
            </div>
          </div>

"""
    content = content[:grand_total_start] + old_grand_total + content[end_sections:]

with open("src/app/operaciones-grupo-cliente/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
