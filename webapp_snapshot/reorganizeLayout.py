import re

filepath = 'src/app/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

def get_block(start_marker, end_marker):
    start = content.find(start_marker)
    if start == -1: return ""
    end = content.find(end_marker, start)
    if end == -1: return ""
    return content[start:end]

# Extract raw content
torneos_start = "<Link href=\"/torneos-ventas\""
torneos_end = "</Link>"
torneos = get_block(torneos_start, torneos_end) + "</Link>"

mvp_start = "{/* EL MVP ROTATIVO */}"
mvp_end = "{/* CUENTA KILÓMETROS DEL SALTO DE TRAMO */}"
mvp = get_block(mvp_start, mvp_end)

if not mvp: # In case the order is different
    mvp_end = "{/* VITRINA DE LOGROS (Estilo PlayStation) */}"
    mvp = get_block(mvp_start, mvp_end)

cuenta_start = "{/* CUENTA KILÓMETROS DEL SALTO DE TRAMO */}"
cuenta_end = "{/* VITRINA DE LOGROS (Estilo PlayStation) */}"
cuenta = get_block(cuenta_start, cuenta_end)

if not cuenta:
    cuenta_end = "{/* EL MVP ROTATIVO */}"
    cuenta = get_block(cuenta_start, cuenta_end)

vitrina_start = "{/* VITRINA DE LOGROS (Estilo PlayStation) */}"
vitrina_end = "      </div>\n\n\n      {stats.length > 0 && ("
vitrina = get_block(vitrina_start, vitrina_end)

termometro_start = "{/* TERMÓMETRO DIARIO DE LA EMPRESA */}"
termometro_end = "{/* MÓDULOS DE GAMIFICACIÓN EN TIEMPO REAL */}"
termometro = get_block(termometro_start, termometro_end)

# Compact Thermometer
termometro = termometro.replace("padding: '24px'", "padding: '16px'")
termometro = termometro.replace("padding: '16px'", "padding: '12px'") # compact the inner boxes further
termometro = termometro.replace("marginBottom: 24", "marginBottom: 16")
termometro = termometro.replace("marginBottom: 12", "marginBottom: 8")
termometro = termometro.replace("marginBottom: 8", "marginBottom: 4")
termometro = termometro.replace("gap: '20px'", "gap: '12px'")

# To make Torneos the same height/layout as MVP, let's adjust Torneos flex properties
# Currently Torneos is `display: 'flex', alignItems: 'center', gap: '16px'`
# Let's change it to `display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', height: '100%'`
torneos = torneos.replace("display: 'flex',\n            alignItems: 'center',", "display: 'flex',\n            flexDirection: 'column',\n            justifyContent: 'center',\n            alignItems: 'center',\n            textAlign: 'center',\n            height: '100%',")
torneos = torneos.replace("marginBottom: '16px'", "marginBottom: '0'") # handled by grid

# Build the layout
# Row 1: Grid 2 cols (Torneos, MVP)
# Row 2: Termometro
# Row 3: Grid 2 cols (Cuenta, Vitrina)

new_layout = f"""
      {{/* FILA 1: TORNEOS Y MVP */}}
      <div style={{{{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}}}>
        {torneos}
        {mvp}
      </div>

      {termometro}

      {{/* FILA 3: CUENTA KMS Y MEDALLAS */}}
      <div style={{{{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}}}>
        {cuenta}
        {vitrina}
"""

start_replace = content.find(termometro_start)
end_replace = content.find("      </div>\n\n\n      {stats.length > 0 && (")

if start_replace != -1 and end_replace != -1:
    new_content = content[:start_replace] + new_layout + content[end_replace:]
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully restructured the layout: Torneos+MVP -> Termómetro -> CuentaKms+Vitrina")
else:
    print("Could not find blocks to replace. Attempting fallback extraction.")
    # Maybe the order changed earlier.
