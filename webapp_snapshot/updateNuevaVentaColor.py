import re

filepath = 'src/app/back-office/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the color for Nueva Venta
old_block = """      title: 'Nueva Venta',
      description: 'Registra nuevas operaciones de catálogo fijo, móvil o TI en el sistema unificado.',
      icon: Building2,
      href: '/nueva-venta',
      color: 'rgba(37, 99, 235, 0.1)',
      textColor: '#2563eb'"""

new_block = """      title: 'Nueva Venta',
      description: 'Registra nuevas operaciones de catálogo fijo, móvil o TI en el sistema unificado.',
      icon: Building2,
      href: '/nueva-venta',
      color: 'rgba(14, 165, 233, 0.1)',
      textColor: '#0ea5e9'"""

content = content.replace(old_block, new_block)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Changed Nueva Venta color to Azul Celeste")
