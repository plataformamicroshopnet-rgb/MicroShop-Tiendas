const text = `TELYCO	23-01-2026	2154228913	4792016710	23-03-2026	SI			63.03	228.1	48	291.73
TELYCO	23-01-2026	2154228980	4792016504	23-03-2026	SI		127.29	272.39	57	399.68
TELYCO	23-01-2026	2154228982	90524154	23-03-2026	SI		127.29		0	127.29
TELYCO	26-01-2026	2154229501	4792016719	26-03-2026	SI			1087.99	228	1087.99
TELYCO	26-01-2026	2154229503	4792017099	26-03-2026	SI				228.1	48	228.1
TELYCO	27-01-2026	2154229754	4792017308	27-03-2026	SI				228.1	48	228.1
TELYCO	28-01-2026	2154230109	4792017309	28-03-2026	SI				315.9	66	315.9
TELYCO	29-01-2026	2154230732	4792017914	29-03-2026	SI				544	114	544
TELYCO	30-01-2026	2154230856	90524636	30-03-2026	SI	592.9			0	592.9
TELYCO	30-01-2026	2154231049	4792018124	30-03-2026	SI				315.9	66	315.9
TELYCO	30-01-2026	2154231125	4792017915	30-03-2026	SI				228.1	48	228.1`;

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
console.log(JSON.stringify(newItems, null, 2))
