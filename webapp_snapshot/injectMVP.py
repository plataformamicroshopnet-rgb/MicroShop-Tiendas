import re

filepath = 'src/app/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Update imports
content = content.replace("import { FileText, BookOpen, Library, Trophy, Flame, Target, Award, Star, Zap, Clock, ShieldCheck } from 'lucide-react'", "import { FileText, BookOpen, Library, Trophy, Flame, Target, Award, Star, Zap, Clock, ShieldCheck, Crown } from 'lucide-react'")

mvp_block = """
        {/* EL MVP ROTATIVO */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 16,
          padding: '24px',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 4px 14px -5px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle background glow */}
          <div style={{ position: 'absolute', bottom: -50, right: -50, width: 150, height: 150, background: 'radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, rgba(236, 72, 153, 0) 70%)', borderRadius: '50%' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ backgroundColor: 'rgba(236, 72, 153, 0.1)', padding: '10px', borderRadius: '12px' }}>
              <Crown size={24} color="#ec4899" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>El MVP del Día</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--medium-gray)', fontWeight: 500 }}>Rey de la Facturación Hoy</p>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16, background: 'var(--bg-body)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(236, 72, 153, 0.2)' }}>
            {/* Avatar Circle */}
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #f472b6 0%, #db2777 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(219, 39, 119, 0.4)', color: 'white', fontSize: '20px', fontWeight: 800 }}>
              C
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>Carlos</h4>
              <div style={{ fontSize: '13px', color: 'var(--medium-gray)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span>
                Liderando con <strong style={{ color: '#ec4899' }}>1.450€</strong>
              </div>
            </div>
          </div>
        </div>
"""

target_anchor = "{/* VITRINA DE LOGROS (Estilo PlayStation) */}"
content = content.replace(target_anchor, mvp_block + "\n        " + target_anchor)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected MVP block")
