import os

filepath = 'src/app/liquidacion/rentabilidad-tiendas/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("setPymeRows(parsedPyme)", "setPymeRows(parsedPyme.rows)")
content = content.replace("setCaptadorRows(parsedCaptador)", "setCaptadorRows(parsedCaptador.rows)")
content = content.replace("<PageHeader title=\"Rentabilidad por Tiendas\" subtitle=\"Análisis horizontal de operaciones y comisiones generadas por cada tienda y comercial\" icon={BarChart2} />", "<PageHeader title=\"Rentabilidad por Tiendas\" subtitle=\"Análisis horizontal de operaciones y comisiones generadas por cada tienda y comercial\" />")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed TS errors in rentabilidad-tiendas")
