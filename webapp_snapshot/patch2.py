import re

with open('src/app/liquidacion/rentabilidad-tiendas/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

bad = '''    const getCurrentMonthString = () => {
      const now = new Date()
      return ''';
bad += str(now.getFullYear()) if 'now' in locals() else '';
bad += '''
    }'''

good = '''    const getCurrentMonthString = () => {
      const now = new Date()
      return \\\\
    }'''

content = re.sub(r'    const getCurrentMonthString.*?\}', good, content, flags=re.DOTALL)

with open('src/app/liquidacion/rentabilidad-tiendas/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
