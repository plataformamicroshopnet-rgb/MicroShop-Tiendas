import re

filepath = 'src/app/liquidacion/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove from menuCardsRaw
card_to_remove = """            {
                title: 'Ventas vs Importes PLUS',
                description: 'Control y cálculo automático de comisiones fijadas para el segmento superior.',
                icon: Briefcase,
                view: 'basico' as ViewType
            },
"""
content = content.replace(card_to_remove, "")

# Remove from defaultCards arrays
content = content.replace(
    "const defaultCards = ['Ventas vs Importes PLUS', 'Operaciones Telefónica', 'Operaciones por Grupo Cliente']",
    "const defaultCards = ['Operaciones Telefónica', 'Operaciones por Grupo Cliente']"
)

content = content.replace(
    "setCardOrder(['Ventas vs Importes PLUS', 'Operaciones Telefónica', 'Operaciones por Grupo Cliente'])",
    "setCardOrder(['Operaciones Telefónica', 'Operaciones por Grupo Cliente'])"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Removed 'Ventas vs Importes PLUS' card")
