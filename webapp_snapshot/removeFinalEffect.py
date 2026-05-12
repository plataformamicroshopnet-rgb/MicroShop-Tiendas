import re

filepath = 'src/app/liquidacion/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

use_effect_logic = """    useEffect(() => {
        const savedOrder = localStorage.getItem('telefonica_card_order')
        if (savedOrder) {
            try { setCardOrder(JSON.parse(savedOrder)) } catch (e) {}
        }
    }, [])"""

content = content.replace(use_effect_logic, "")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Removed final useEffect")
