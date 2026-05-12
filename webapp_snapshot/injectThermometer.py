import re

filepath = 'src/app/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure we have the required icons imported.
# Let's find the lucide import and add Wifi, Smartphone, Shield, Zap, TrendingUp, Tv
old_imports = "import { FileText, BookOpen, Library, Trophy, Flame, Target, Award, Star, Zap, Clock, ShieldCheck, Crown } from 'lucide-react'"
new_imports = "import { FileText, BookOpen, Library, Trophy, Flame, Target, Award, Star, Zap, Clock, ShieldCheck, Crown, Wifi, Smartphone, Shield, TrendingUp, Tv, Layers } from 'lucide-react'"
content = content.replace(old_imports, new_imports)

thermometer_block = """
      {/* TERMÓMETRO DIARIO DE LA EMPRESA */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 16,
        padding: '24px',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 4px 14px -5px rgba(0,0,0,0.05)',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '12px' }}>
            <Flame size={24} color="#ef4444" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-main)' }}>Termómetro Diario de la Empresa</h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--medium-gray)', fontWeight: 500 }}>Seguimiento en vivo de los 6 KPIs críticos para llegar al objetivo del mes.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          
          {/* 1. Altas BAF Total */}
          <div style={{ background: 'var(--bg-body)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wifi size={18} color="#0ea5e9" />
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Altas BAF Total</span>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>Faltan 4</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border-strong)', borderRadius: '4px', overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: '60%', height: '100%', background: 'linear-gradient(90deg, #38bdf8, #0284c7)', borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--medium-gray)', fontWeight: 600 }}>
              <span>Llevamos: <strong style={{ color: 'var(--text-main)' }}>6</strong></span>
              <span>Objetivo Hoy: 10</span>
            </div>
          </div>

          {/* 2. Alta BAF Convergente */}
          <div style={{ background: 'var(--bg-body)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} color="#8b5cf6" />
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>BAF Convergente</span>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>¡Logrado!</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border-strong)', borderRadius: '4px', overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #34d399, #059669)', borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--medium-gray)', fontWeight: 600 }}>
              <span>Llevamos: <strong style={{ color: 'var(--text-main)' }}>5</strong></span>
              <span>Objetivo Hoy: 4</span>
            </div>
          </div>

          {/* 3. Dispositivos + Seguros */}
          <div style={{ background: 'var(--bg-body)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Smartphone size={18} color="#f59e0b" />
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Dispositivos + Seguros</span>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>Faltan 7</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border-strong)', borderRadius: '4px', overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: '45%', height: '100%', background: 'linear-gradient(90deg, #fbbf24, #d97706)', borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--medium-gray)', fontWeight: 600 }}>
              <span>Llevamos: <strong style={{ color: 'var(--text-main)' }}>8</strong></span>
              <span>Objetivo Hoy: 15</span>
            </div>
          </div>

          {/* 4. FTTR */}
          <div style={{ background: 'var(--bg-body)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={18} color="#ec4899" />
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>FTTR</span>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>Falta 1</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border-strong)', borderRadius: '4px', overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: '50%', height: '100%', background: 'linear-gradient(90deg, #f472b6, #db2777)', borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--medium-gray)', fontWeight: 600 }}>
              <span>Llevamos: <strong style={{ color: 'var(--text-main)' }}>1</strong></span>
              <span>Objetivo Hoy: 2</span>
            </div>
          </div>

          {/* 5. ARPU */}
          <div style={{ background: 'var(--bg-body)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={18} color="#10b981" />
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>ARPU Diario</span>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>Faltan 120€</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border-strong)', borderRadius: '4px', overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: '80%', height: '100%', background: 'linear-gradient(90deg, #34d399, #059669)', borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--medium-gray)', fontWeight: 600 }}>
              <span>Llevamos: <strong style={{ color: 'var(--text-main)' }}>480€</strong></span>
              <span>Objetivo: 600€</span>
            </div>
          </div>

          {/* 6. Repo Fútbol */}
          <div style={{ background: 'var(--bg-body)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tv size={18} color="#3b82f6" />
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Repo Fútbol</span>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>Faltan 2</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border-strong)', borderRadius: '4px', overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: '33%', height: '100%', background: 'linear-gradient(90deg, #60a5fa, #2563eb)', borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--medium-gray)', fontWeight: 600 }}>
              <span>Llevamos: <strong style={{ color: 'var(--text-main)' }}>1</strong></span>
              <span>Objetivo Hoy: 3</span>
            </div>
          </div>

        </div>
      </div>
"""

target_anchor = "{/* MÓDULOS DE GAMIFICACIÓN EN TIEMPO REAL */}"
content = content.replace(target_anchor, thermometer_block + "\n      " + target_anchor)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected Termómetro Diario block")
