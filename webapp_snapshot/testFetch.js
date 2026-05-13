const text = `TELYCO	23-01-2026	2154228913	4792016710	23-03-2026	SI			63.03	228.1	48	291.73`;

const parseIntSafe = (val) => parseInt(val) || 0
const parseFloatSafe = (val) => parseFloat(val) || 0

const lines = text.trim().split('\n')
const newItems = []
for (const line of lines) {
    const cols = line.split('\t').map(c => c.trim())
    if (cols.length < 5) continue
    if (cols[0].toUpperCase() === 'PROVEEDORES') continue
    const cleanNum = (str) => {
        if (!str) return 0
        let s = str.replace(/[€]/g, '').trim()
        s = s.replace(/\./g, '')
        s = s.replace(/,/g, '.')
        return parseFloatSafe(s)
    }
    newItems.push({
        proveedor: cols[0],
        fechaFactura: cols[1],
        albaran: cols[2],
        nFactura: cols[3],
        vencimiento: cols[4],
        pagado: cols[5] && cols[5].toUpperCase() === 'SI',
        recargo: cleanNum(cols[6]),
        tarjetas: cleanNum(cols[7]),
        accesorios: cleanNum(cols[8]),
        moviles: cleanNum(cols[9]),
        iva: cleanNum(cols[10]),
        totalFactura: cleanNum(cols[11]),
    })
}

async function test() {
    const res = await fetch('http://localhost:3000/api/vencimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk', items: newItems, replace: false })
    })
    const json = await res.json()
    console.log(json)
}
test()
