import re

filepath = 'src/app/back-office/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the color for Operaciones Pendientes
old_block = """      title: 'Operaciones Pendientes',
      description: 'Acceso directo a las operaciones en estado Pendiente para su tramitación.',
      icon: List,
      href: '/operaciones?filter=pendientes',
      color: 'rgba(245, 158, 11, 0.1)',
      textColor: '#d97706',
      border: '1px solid rgba(245, 158, 11, 0.2)'"""

new_block = """      title: 'Operaciones Pendientes',
      description: 'Acceso directo a las operaciones en estado Pendiente para su tramitación.',
      icon: List,
      href: '/operaciones?filter=pendientes',
      color: 'rgba(239, 68, 68, 0.1)',
      textColor: '#ef4444',
      border: '1px solid rgba(239, 68, 68, 0.2)'"""

content = content.replace(old_block, new_block)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Changed Operaciones Pendientes color to red")
