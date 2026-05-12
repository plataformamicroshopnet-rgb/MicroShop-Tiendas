import re

filepath = 'src/app/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_avatar = """            {/* Avatar Circle */}
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #f472b6 0%, #db2777 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(219, 39, 119, 0.4)', color: 'white', fontSize: '20px', fontWeight: 800 }}>
              C
            </div>"""

new_avatar = """            {/* Avatar Circle */}
            <div style={{ 
              width: 56, height: 56, borderRadius: '50%', 
              boxShadow: '0 4px 12px rgba(219, 39, 119, 0.4)', 
              border: '2px solid #ec4899',
              overflow: 'hidden', flexShrink: 0,
              background: 'linear-gradient(135deg, #f472b6 0%, #db2777 100%)'
            }}>
              {/* REEMPLAZA EL 'src' CON LA RUTA DE TU FOTO (ej. '/fotos/carlos.jpg') */}
              <img 
                src="https://i.pravatar.cc/150?img=11" 
                alt="Carlos" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            </div>"""

content = content.replace(old_avatar, new_avatar)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Added image to MVP avatar")
