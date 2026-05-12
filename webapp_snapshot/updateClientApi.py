import re

filepath = 'src/app/api/movilfree/clients/route.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the creation logic in POST to include new fields
content = content.replace(
    'data: { nif: data.nif, nombre: data.nombre, telefono: data.telefono, email: data.email }',
    'data: { nif: data.nif, nombre: data.nombre, direccion: data.direccion, poblacion: data.poblacion, provincia: data.provincia, cp: data.cp, movil: data.movil, fijo: data.fijo, email: data.email }'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated API route")
