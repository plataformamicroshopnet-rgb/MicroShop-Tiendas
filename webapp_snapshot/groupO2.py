import re

filepath = 'src/components/ProductTreeSelector.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# We want to change how O2 is rendered. 
# Look for:
#              const distinctProducts = [...new Set(products.map(p => p.producto).filter(Boolean))].sort()
#              const isExpanded = expandedCats[cat]
#              
#              return (
#                <div key={cat} style={{ display: 'flex', flexDirection: 'column' }}>
#                  {renderCheckbox(cat === 'O2' ? 'O2 MovilFree' : cat, cat, true, () => toggleCat(cat), isExpanded)}
#                  
#                  {isExpanded && (
#                    <div style={{ paddingLeft: 24, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
#                      {distinctProducts.map(prod => renderCheckbox(prod, prod))}
#                    </div>
#                  )}
#                </div>
#              )

search_target = """              const distinctProducts = [...new Set(products.map(p => p.producto).filter(Boolean))].sort()
              const isExpanded = expandedCats[cat]
              
              return (
                <div key={cat} style={{ display: 'flex', flexDirection: 'column' }}>
                  {renderCheckbox(cat === 'O2' ? 'O2 MovilFree' : cat, cat, true, () => toggleCat(cat), isExpanded)}
                  
                  {isExpanded && (
                    <div style={{ paddingLeft: 24, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {distinctProducts.map(prod => renderCheckbox(prod, prod))}
                    </div>
                  )}
                </div>
              )"""

replace_target = """              const distinctProducts = [...new Set(products.map(p => p.producto).filter(Boolean))].sort()
              const isExpanded = expandedCats[cat]
              
              if (cat === 'O2') {
                const subcats = [...new Set(products.map(p => p.subcategoria).filter(Boolean))].sort()
                return (
                  <div key={cat} style={{ display: 'flex', flexDirection: 'column' }}>
                    {renderCheckbox('O2 MovilFree', cat, true, () => toggleCat(cat), isExpanded)}
                    
                    {isExpanded && (
                      <div style={{ paddingLeft: 24, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {subcats.map(sub => {
                          const subExpanded = expandedCats[`O2_${sub}`]
                          const subProds = [...new Set(products.filter(p => p.subcategoria === sub).map(p => p.producto).filter(Boolean))].sort()
                          return (
                            <div key={`O2_${sub}`} style={{ display: 'flex', flexDirection: 'column' }}>
                              {renderCheckbox(sub, sub, true, () => toggleCat(`O2_${sub}`), subExpanded)}
                              {subExpanded && (
                                <div style={{ paddingLeft: 24, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {subProds.map(prod => renderCheckbox(prod, prod))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }
              
              return (
                <div key={cat} style={{ display: 'flex', flexDirection: 'column' }}>
                  {renderCheckbox(cat, cat, true, () => toggleCat(cat), isExpanded)}
                  
                  {isExpanded && (
                    <div style={{ paddingLeft: 24, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {distinctProducts.map(prod => renderCheckbox(prod, prod))}
                    </div>
                  )}
                </div>
              )"""

if search_target in content:
    content = content.replace(search_target, replace_target)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched ProductTreeSelector to group O2 by subcategory")
else:
    print("Could not find target")
