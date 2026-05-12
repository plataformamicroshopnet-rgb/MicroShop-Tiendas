import re

filepath = 'src/app/liquidacion/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add border left
old_style = "style={{ position: 'relative', cursor: isEditMode ? 'default' : 'pointer' }}"
new_style = "style={{ position: 'relative', cursor: isEditMode ? 'default' : 'pointer', borderLeft: c.title === 'Agenda de Llamadas Cristina' ? '5px solid #5CB615' : '1px solid transparent' }}"
content = content.replace(old_style, new_style)

# Update Icon Wrapper
old_icon = "<div className=\"card-icon-wrapper\" style={c.href ? { backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' } : c.isSub ? { backgroundColor: 'rgba(107, 114, 128, 0.1)', color: 'var(--text-muted)' } : { backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>"
new_icon = "<div className=\"card-icon-wrapper\" style={c.title === 'Agenda de Llamadas Cristina' ? { backgroundColor: 'rgba(92, 182, 21, 0.1)', color: '#5CB615' } : c.href ? { backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' } : c.isSub ? { backgroundColor: 'rgba(107, 114, 128, 0.1)', color: 'var(--text-muted)' } : { backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>"
content = content.replace(old_icon, new_icon)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied Verde movistar to Agenda Cristina")
