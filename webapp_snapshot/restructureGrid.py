import re

filepath = 'src/app/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# I will use string slicing to extract the components and put them back together.
# We need to extract:
# 1. Torneos Block
# 2. Termómetro Block
# 3. Cuenta Kms Block
# 4. MVP Block
# 5. Vitrina Block

def get_block(start_marker, end_marker):
    start = content.find(start_marker)
    if start == -1: return ""
    end = content.find(end_marker, start)
    if end == -1: return ""
    return content[start:end]

torneos_start = "<Link href=\"/torneos-ventas\""
torneos_end = "</Link>"
torneos = get_block(torneos_start, torneos_end) + "</Link>"

termometro_start = "{/* TERMÓMETRO DIARIO DE LA EMPRESA */}"
termometro_end = "{/* MÓDULOS DE GAMIFICACIÓN EN TIEMPO REAL */}"
termometro = get_block(termometro_start, termometro_end)

cuenta_start = "{/* CUENTA KILÓMETROS DEL SALTO DE TRAMO */}"
cuenta_end = "{/* EL MVP ROTATIVO */}"
cuenta = get_block(cuenta_start, cuenta_end)

mvp_start = "{/* EL MVP ROTATIVO */}"
mvp_end = "{/* VITRINA DE LOGROS (Estilo PlayStation) */}"
mvp = get_block(mvp_start, mvp_end)

vitrina_start = "{/* VITRINA DE LOGROS (Estilo PlayStation) */}"
vitrina_end = "      </div>\n\n\n      {stats.length > 0 && ("
vitrina = get_block(vitrina_start, vitrina_end)

# Compact the blocks by replacing paddings and margins
def compact(block):
    block = block.replace("padding: '24px'", "padding: '16px'")
    block = block.replace("padding: '20px'", "padding: '16px'")
    block = block.replace("marginBottom: 20", "marginBottom: 12")
    block = block.replace("marginBottom: 16", "marginBottom: 12")
    block = block.replace("marginBottom: '24px'", "marginBottom: '16px'")
    block = block.replace("height: 56", "height: 48") # mvp avatar
    block = block.replace("width: 56", "width: 48") # mvp avatar
    block = block.replace("gap: '16px'", "gap: '12px'")
    return block

torneos = compact(torneos)
termometro = compact(termometro)
cuenta = compact(cuenta)
mvp = compact(mvp)
vitrina = compact(vitrina)

# Reassemble the layout
new_layout = f"""{termometro}
      {{/* MÓDULOS DE GAMIFICACIÓN EN TIEMPO REAL */}}
      <div style={{{{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px', marginBottom: '24px' }}}}>
        
        {torneos}
        
        {mvp}
        
        {cuenta}
        
        {vitrina}
"""

start_replace = content.find(torneos_start)
end_replace = content.find("      </div>\n\n\n      {stats.length > 0 && (")

if start_replace != -1 and end_replace != -1:
    new_content = content[:start_replace] + new_layout + content[end_replace:]
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully restructured layout into 2x2 grid and compacted styling")
else:
    print("Could not find blocks to replace")
