import re

filepath = 'src/app/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Update imports
content = content.replace("import { FileText, BookOpen, Library, Trophy } from 'lucide-react'", "import { FileText, BookOpen, Library, Trophy, Flame, Target, Award, Star, Zap, Clock, ShieldCheck } from 'lucide-react'")

# Gamification blocks
gamification_blocks = """
      {/* MÓDULOS DE GAMIFICACIÓN EN TIEMPO REAL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        
        {/* CUENTA KILÓMETROS DEL SALTO DE TRAMO */}
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
          <div style={{ position: 'absolute', top: -50, right: -50, width: 150, height: 150, background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0) 70%)', borderRadius: '50%' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '12px' }}>
              <Target size={24} color="#10b981" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>Cuenta Kilómetros</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--medium-gray)', fontWeight: 500 }}>Objetivo: Tramo PLUS (15%)</p>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--text-main)', lineHeight: 1.4 }}>
              <strong style={{ color: 'var(--mercedes-cyan)' }}>Marta</strong>, estás a solo <strong style={{ color: '#10b981', fontSize: '18px' }}>2 ventas</strong> de MovilFree para saltar al siguiente tramo y multiplicar tu comisión mensual.
            </p>

            {/* Progress Bar */}
            <div style={{ width: '100%', height: '14px', background: 'var(--bg-input)', borderRadius: '7px', overflow: 'hidden', position: 'relative' }}>
              <div style={{ width: '93%', height: '100%', background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)', borderRadius: '7px', boxShadow: '0 0 10px rgba(16,185,129,0.5)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--medium-gray)' }}>
              <span>28 Ventas</span>
              <span style={{ color: '#10b981' }}>Meta: 30</span>
            </div>
          </div>
        </div>


        {/* VITRINA DE LOGROS (Estilo PlayStation) */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 16,
          padding: '24px',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 4px 14px -5px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '10px', borderRadius: '12px' }}>
              <Award size={24} color="#8b5cf6" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>Tus Medallas y Logros</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--medium-gray)', fontWeight: 500 }}>Desbloqueos recientes esta semana</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', flex: 1 }}>
            
            {/* Medalla 1: Oro */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'var(--bg-body)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)' }}>
                <ShieldCheck size={24} color="#fff" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#d97706', marginBottom: 2 }}>Rey del O2</div>
                <div style={{ fontSize: '10px', color: 'var(--medium-gray)' }}>Liderando O2</div>
              </div>
            </div>

            {/* Medalla 2: Plata */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'var(--bg-body)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.3)' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(148, 163, 184, 0.4)' }}>
                <Clock size={24} color="#fff" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: 2 }}>Madrugador</div>
                <div style={{ fontSize: '10px', color: 'var(--medium-gray)' }}>1ª venta < 10h</div>
              </div>
            </div>

            {/* Medalla 3: Bronce/Cobre */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'var(--bg-body)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(217, 119, 6, 0.2)' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #fca5a5 0%, #ef4444 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)' }}>
                <Zap size={24} color="#fff" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#b91c1c', marginBottom: 2 }}>El Pulpo</div>
                <div style={{ fontSize: '10px', color: 'var(--medium-gray)' }}>Multi-paquete</div>
              </div>
            </div>

          </div>
        </div>

      </div>
"""

# Insert after Torneos de Ventas banner
target_anchor = "        </div>\n      </Link>"
content = content.replace(target_anchor, target_anchor + "\n" + gamification_blocks)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected gamification blocks")
