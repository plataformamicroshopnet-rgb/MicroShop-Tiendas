import re

filepath = 'src/app/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """      <Link href="/torneos-ventas" style={{ textDecoration: 'none', display: 'block', marginBottom: '24px', outline: 'none' }}>
        <div 
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.15) 100%)',
            borderRadius: 12,
            padding: '20px',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 14px -5px rgba(0,0,0,0.05)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 8px 24px -10px rgba(245, 158, 11, 0.25)'
            e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.6)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.boxShadow = '0 4px 14px -5px rgba(0,0,0,0.05)'
            e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.3)'
          }}
        >
          <div style={{ backgroundColor: '#f59e0b', padding: '12px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trophy size={28} color="#fff" />
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800, color: '#d97706' }}>Torneos de Ventas</h3>"""

new_block = """      <Link href="/torneos-ventas" style={{ textDecoration: 'none', display: 'block', marginBottom: '24px', outline: 'none' }}>
        <div 
          style={{
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.1) 0%, rgba(14, 165, 233, 0.15) 100%)',
            borderRadius: 12,
            padding: '20px',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 14px -5px rgba(0,0,0,0.05)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 8px 24px -10px rgba(14, 165, 233, 0.25)'
            e.currentTarget.style.borderColor = 'rgba(14, 165, 233, 0.6)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.boxShadow = '0 4px 14px -5px rgba(0,0,0,0.05)'
            e.currentTarget.style.borderColor = 'rgba(14, 165, 233, 0.3)'
          }}
        >
          <div style={{ backgroundColor: '#0ea5e9', padding: '12px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trophy size={28} color="#fff" />
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800, color: '#0ea5e9' }}>Torneos de Ventas</h3>"""

content = content.replace(old_block, new_block)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Changed Torneos de Ventas background to Azul Celeste")
