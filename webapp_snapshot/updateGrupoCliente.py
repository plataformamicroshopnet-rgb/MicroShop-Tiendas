import re

filepath = 'src/app/operaciones-grupo-cliente/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the SectionTable function
# Find start of SectionTable
start_idx = content.find("function SectionTable({")
# Find end of SectionTable by looking for the next function or component, or simply finding the end of the file/component.
# It ends with `  )\n}\n`
end_idx = content.find("  )\n}\n\n//", start_idx)
if end_idx == -1:
    end_idx = content.find("  )\n}\n", start_idx)

new_section_table = """function SectionTable({
  label, badge, badgeColor, groups, tabColor
}: {
  label: string; badge: string; badgeColor: string
  groups: NifGroup[]; tabColor: string;
}) {
  if (groups.length === 0) return null

  const sectionTotal = groups.reduce((s, g) => s + g.subtotal, 0)
  const totalUnits   = groups.reduce((s, g) => s + g.sales.length, 0)

  return (
    <div style={{ marginBottom: 36 }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 18px', marginBottom: 0,
        background: `${badgeColor}18`, borderRadius: '12px 12px 0 0',
        border: `1px solid ${badgeColor}40`, borderBottom: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: badgeColor, color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, letterSpacing: 1 }}>{badge}</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--light-text)' }}>{label}</span>
          <span style={{ fontSize: 12, color: 'var(--medium-gray)' }}>{groups.length} clientes · {totalUnits} uds.</span>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--medium-gray)' }}>Total: <strong style={{ color: 'var(--light-text)' }}>{fmt(sectionTotal)}</strong></span>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', border: `1px solid ${badgeColor}40`, borderRadius: '0 0 12px 12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 800 }}>
          <thead>
            <tr style={{ background: 'var(--active-bg)' }}>
              {['Cliente (NIF)', 'Nombre del Cliente', 'Fecha Tram.', 'Teléfono', 'Código', 'Comercial', 'Productos', 'Uds.', 'Total'].map((h, i) => (
                <th key={i} style={{
                  padding: '10px 14px', textAlign: i >= 7 ? 'right' : 'left',
                  whiteSpace: 'nowrap', color: 'var(--medium-gray)', fontWeight: 600, fontSize: 11,
                  textTransform: 'uppercase', letterSpacing: 0.5,
                  borderBottom: `2px solid ${badgeColor}60`,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.flatMap((group, gi) => {
              return group.sales.map((sale: any, si: number) => {
                const rowBg = si % 2 === 0 ? 'transparent' : `${badgeColor}08`
                const isLast = si === group.sales.length - 1
                return (
                  <tr key={`${gi}-${si}`} style={{ background: rowBg, borderBottom: isLast ? `2px solid ${badgeColor}30` : `1px dashed var(--border-color)`, verticalAlign: 'middle' }}>
                    <td style={{ padding: '12px 14px', color: 'var(--medium-gray)', fontSize: 12, whiteSpace: 'nowrap', borderRight: '1px solid var(--border-color)' }}>{group.nif}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--light-text)', borderRight: '1px solid var(--border-color)' }}>{group.nombre || '—'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{sale.fecha || '—'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{sale.telf || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 11.5, color: 'var(--medium-gray)', borderRight: '1px solid var(--border-color)' }}>{sale.codigo || '—'}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, borderRight: '1px solid var(--border-color)' }}>{sale.vendedor || '—'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--light-text)', maxWidth: 280 }}>{sale.producto || '—'}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <span style={{ background: `${tabColor}22`, color: tabColor, borderRadius: 20, padding: '3px 11px', fontWeight: 800, fontSize: 13 }}>1</span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--light-text)', fontSize: 13, whiteSpace: 'nowrap' }}>{fmt(Number(sale.cuota ?? 0))}</td>
                  </tr>
                )
              })
            })}
          </tbody>
        </table>
      </div>
    </div>
"""

content = content[:start_idx] + new_section_table + content[end_idx+3:]

# Also we need to fix the calls to SectionTable in the render to remove the removed props: tramoInfo, dashRows, flatRows, dedupeInfo
# I will just use regex to remove them from all <SectionTable ... /> calls
content = re.sub(r'tramoInfo=\{[^}]+\}', '', content)
content = re.sub(r'dashRows=\{[^}]+\}', '', content)
content = re.sub(r'flatRows(\=\{[^}]+\})?', '', content)
content = re.sub(r'dedupeInfo(\=\{[^}]+\})?', '', content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated SectionTable to remove grouping and tramo.")
