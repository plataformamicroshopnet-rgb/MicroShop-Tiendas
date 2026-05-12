import re

with open('src/app/liquidacion/rentabilidad-tiendas/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the fetchData function inside useEffect
new_fetch_data = """  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const currentPeriodObj = availablePeriods.find(p => p.period_key === activePeriodKey)
        const periodStr = currentPeriodObj ? `${currentPeriodObj.year}${String(currentPeriodObj.month).padStart(2, '0')}` : ''

        if (!activePeriodKey) return;

        const [salesRes, catRes, pymeRes, plusRes, objRes] = await Promise.all([
          fetch(`/api/sales?period=${periodStr}&strictPeriod=1`).catch(() => null),
          fetch('/api/catalogs').catch(() => null),
          fetch(`/api/importes-pyme?periodKey=${activePeriodKey}&strictPeriod=1`).catch(() => null),
          fetch(`/api/importes-plus?periodKey=${activePeriodKey}&strictPeriod=1`).catch(() => null),
          fetch(`/api/objetivos?periodKey=${activePeriodKey}&strictPeriod=1`).catch(() => null)
        ])

        const salesData = salesRes && salesRes.ok ? await salesRes.json() : { logs: [] }
        const catData = catRes && catRes.ok ? await catRes.json() : {}
        const pymeData = pymeRes && pymeRes.ok ? await pymeRes.json() : {}
        const plusData = plusRes && plusRes.ok ? await plusRes.json() : {}
        const objData = objRes && objRes.ok ? await objRes.json() : {}

        const fetchedSales = salesData.logs || []
        setSales(fetchedSales)
        setCatalogs(catData.catalogs || catData || {})

        const importesPyme = pymeData.importes || pymeData.data || []
        const importesPlus = plusData.importes || plusData.data || []
        const objetivosObj = objData.objetivos || { Pyme: {}, Captador: {} }
        const objGruposObj = objData.grupos || { Pyme: {}, Captador: {} }

        const parsedPyme = renderDashboardData('Pyme', importesPyme, objetivosObj.Pyme || {}, fetchedSales, objGruposObj.Pyme || {}, currentPeriodObj)
        const parsedCaptador = renderDashboardData('Captador', importesPlus, objetivosObj.Captador || {}, fetchedSales, objGruposObj.Captador || {}, currentPeriodObj)
        
        setPymeRows(parsedPyme)
        setCaptadorRows(parsedCaptador)
      } catch (err) {
        console.error('Error loading data for rentabilidad:', err)
      } finally {
        setLoading(false)
      }
    }

    if (activePeriodKey && availablePeriods.length > 0) {
      fetchData()
    }
  }, [activePeriodKey, availablePeriods])"""

content = re.sub(r'  useEffect\(\(\) => \{.*?  \}, \[activePeriodKey, availablePeriods\]\)', new_fetch_data, content, flags=re.DOTALL)

with open('src/app/liquidacion/rentabilidad-tiendas/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed API calls in useEffect")
