import re

filepath = 'src/app/liquidacion/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Define the new border style logic
old_style = "style={{ position: 'relative', cursor: isEditMode ? 'default' : 'pointer', borderLeft: c.title === 'Agenda de Llamadas Cristina' ? '5px solid #5CB615' : '1px solid transparent' }}"

new_style = """style={{ 
                            position: 'relative', 
                            cursor: isEditMode ? 'default' : 'pointer', 
                            borderLeft: c.title === 'Agenda de Llamadas Cristina' ? '5px solid #5CB615' : 
                                        c.title === 'Operaciones Telefónica' || c.title === 'Operaciones por Grupo Cliente' ? '5px solid #b8860b' :
                                        c.title === 'Rentabilidad por Tiendas' || c.title === 'Territorial Tiendas / O2' ? '5px solid #0ea5e9' : 
                                        '1px solid transparent' 
                        }}"""
content = content.replace(old_style, new_style)

# Define the new icon wrapper logic
old_icon = "<div className=\"card-icon-wrapper\" style={c.title === 'Agenda de Llamadas Cristina' ? { backgroundColor: 'rgba(92, 182, 21, 0.1)', color: '#5CB615' } : c.href ? { backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' } : c.isSub ? { backgroundColor: 'rgba(107, 114, 128, 0.1)', color: 'var(--text-muted)' } : { backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>"

new_icon = """<div className="card-icon-wrapper" style={
                                c.title === 'Agenda de Llamadas Cristina' ? { backgroundColor: 'rgba(92, 182, 21, 0.1)', color: '#5CB615' } : 
                                c.title === 'Operaciones Telefónica' || c.title === 'Operaciones por Grupo Cliente' ? { backgroundColor: 'rgba(184, 134, 11, 0.1)', color: '#b8860b' } :
                                c.title === 'Rentabilidad por Tiendas' || c.title === 'Territorial Tiendas / O2' ? { backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9' } :
                                c.href ? { backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' } : 
                                c.isSub ? { backgroundColor: 'rgba(107, 114, 128, 0.1)', color: 'var(--text-muted)' } : 
                                { backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }
                            }>"""
content = content.replace(old_icon, new_icon)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied colors to all cards")
