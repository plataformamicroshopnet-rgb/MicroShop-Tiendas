import os
import re

with open('src/app/cristina-admin/stock/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove table header
content = content.replace("<th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '13px', textAlign: 'center', width: '8%' }}>Movilfree</th>", "")

# 2. Remove table cell (the entire td block for udsMovilfree)
# It looks like this:
#                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
#                              {isEditing ? (
#                                  <input type="number" value={editForm.udsMovilfree || 0} onChange={e => setEditForm({...editForm, udsMovilfree: parseInt(e.target.value)||0})} style={{ width: '50px', padding: '6px', borderRadius: '4px', border: '1px solid #CBD5E1', textAlign: 'center' }} />
#                              ) : (
#                                <span style={{ display: 'inline-block', width: '30px', padding: '4px', background: item.udsMovilfree > 0 ? '#FEF08A' : 'transparent', borderRadius: '4px', fontWeight: item.udsMovilfree > 0 ? 'bold' : 'normal' }}>
#                                  {item.udsMovilfree || '-'}
#                                </span>
#                              )}
#                          </td>

pattern = re.compile(r'<td style=\{\{ padding: \'12px 16px\', textAlign: \'center\' \}\}>\s*\{isEditing \? \(\s*<input type="number" value=\{editForm\.udsMovilfree[^>]+>\s*\) : \(\s*<span[^>]+>\s*\{item\.udsMovilfree \|\| \'-\'\}\s*</span>\s*\)\}\s*</td>', re.MULTILINE | re.DOTALL)
content = pattern.sub('', content)

# 3. Update totalUds calculation
content = content.replace(
    "const totalUds = parseIntSafe(currentItem.udsCorrehuela?.toString()||'0') + parseIntSafe(currentItem.udsAuxiliadora?.toString()||'0') + parseIntSafe(currentItem.udsBejar?.toString()||'0') + parseIntSafe(currentItem.udsVillamayor?.toString()||'0') + parseIntSafe(currentItem.udsMovilfree?.toString()||'0')",
    "const totalUds = parseIntSafe(currentItem.udsCorrehuela?.toString()||'0') + parseIntSafe(currentItem.udsAuxiliadora?.toString()||'0') + parseIntSafe(currentItem.udsBejar?.toString()||'0') + parseIntSafe(currentItem.udsVillamayor?.toString()||'0')"
)

# 4. Remove colSpan=10 to colSpan=9 for the empty state
content = content.replace("colSpan={10}", "colSpan={9}")

with open('src/app/cristina-admin/stock/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Replacement script executed.")
