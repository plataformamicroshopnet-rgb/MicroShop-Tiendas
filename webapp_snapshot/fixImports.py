import re

filepath = 'src/app/liquidacion/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "import { Euro, Calendar, ArrowLeft, Save, ClipboardList, X, Trash2, Settings, Download, Briefcase, FileText, BarChart2, Repeat, Zap, Settings2, ArrowUp, ArrowDown, Users, RefreshCcw, Map } from 'lucide-react'",
    "import { Euro, Calendar, ArrowLeft, Save, ClipboardList, X, Trash2, Settings, Download, Briefcase, FileText, BarChart2, Repeat, Zap, Settings2, ArrowUp, ArrowDown, Users, RefreshCcw, Map, TrendingUp } from 'lucide-react'"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed imports")
