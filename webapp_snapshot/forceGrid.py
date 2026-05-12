import re

filepath = 'src/app/admin/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Grid Layout
old_grid = """      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px',
        marginTop: '8px'
      }}>"""
new_grid = """      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '24px',
        marginTop: '16px'
      }}>"""
content = content.replace(old_grid, new_grid)

# 2. Remove hero-card css
hero_css = """        /* Hero Card Específica */
        .hero-card {
            grid-column: 1 / -1;
            order: -1;
            padding: 16px 20px;
        }
        .hero-card .card-icon-wrapper {
            width: 44px;
            height: 44px;
            border-radius: 12px;
        }
        .hero-card .card-title {
            font-size: 18px;
        }
        .hero-card .card-desc {
            font-size: 14px;
        }
        
        @media (min-width: 640px) {
            .hero-card {
                flex-direction: row;
                align-items: center;
                gap: 20px;
                padding: 18px 24px;
            }
        }"""
content = content.replace(hero_css, "")

# 3. Remove hero-card class injection
content = content.replace("const isHero = c.title === 'Gestión de Periodos Operativos'\n\n          return (\n            <div\n              key={c.title}\n              className={`premium-card ${isHero ? 'hero-card' : ''} ${isEditMode ? 'wiggle-mode' : ''}`}", "return (\n            <div\n              key={c.title}\n              className={`premium-card ${isEditMode ? 'wiggle-mode' : ''}`}")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Forced 3 columns grid")
