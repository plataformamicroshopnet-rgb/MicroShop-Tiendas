import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// ═══════════════════════════════════════════════════════════════════════════
// Selene IA — generación DIRECTA de las 8 historias de Instagram del taller
// «Selene Studio» (ERP mi-nuevo-erp → app/ui/manuales_html/taller_instagram.html,
// pestaña 👨‍👩‍👧 Consultas). El taller (iframe srcdoc de Streamlit) hace un
// fetch POST aquí con la consulta del padre; este route construye el ENCARGO
// en el servidor, llama a la API de Anthropic con la clave (que NUNCA sale
// del servidor) y devuelve el texto con las 8 HISTORIAS + el coste.
//
// Auth del POST: cabecera `x-selene-token` === SELENE_IA_TOKEN (token propio,
// mismo valor inyectado por el ERP en window.SELENE_IA — este token SÍ viaja
// al navegador, por eso jamás se usa aquí PRV_FEED_SECRET, que es
// server-to-server). Sin la env el endpoint queda CERRADO (patrón prv-feed).
//
// Auth del GET (contador de costes para el Admin del ERP): `x-prv-secret`
// === PRV_FEED_SECRET (server-to-server, nunca llega a un navegador).
//
// CORS: el taller vive en un iframe srcdoc → el Origin puede llegar como
// "null"; se responde Access-Control-Allow-Origin: * y se atiende el
// preflight OPTIONS. La seguridad es el token, no el origen.
// ═══════════════════════════════════════════════════════════════════════════

// Token del taller. Sin env → endpoint cerrado (también en desarrollo:
// los tests locales arrancan el dev server con SELENE_IA_TOKEN=test-token).
const TOKEN: string | null = process.env.SELENE_IA_TOKEN || null

// Secreto server-to-server para el GET del ERP (mismo patrón que prv-feed:
// default solo en desarrollo; en producción sin env → GET cerrado).
const PRV_SECRET: string | null = process.env.PRV_FEED_SECRET
    || (process.env.NODE_ENV === 'production' ? null : 'dev-prv-secret')

// Log de costes SIN tocar Prisma: JSON en el volumen (patrón *_feed.json).
const LOG_PATH = process.env.SQLITE_VOLUME_PATH
    ? path.join(process.env.SQLITE_VOLUME_PATH, 'selene_ia_log.json')
    : path.join(process.cwd(), 'selene_ia_log.json')
const LOG_MAX = 500

// Tarifas Claude Sonnet (claude-sonnet-5): 3 $/M tokens entrada, 15 $/M salida.
const USD_IN_PER_TOKEN = 3 / 1e6
const USD_OUT_PER_TOKEN = 15 / 1e6

const CORS_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-selene-token',
}

// ───────────────────────────────────────────────────────────────────────────
// EL ENCARGO — port FIEL de `conPromptIA()` del taller
// (taller_instagram.html, ~línea 2747). ⚠️ MANTENER EN SINCRONÍA: si se
// retoca el texto aquí, hay que retocar también conPromptIA() del taller
// (que sigue existiendo para el puente manual / plan B), y viceversa.
// ───────────────────────────────────────────────────────────────────────────

// = ARCO_PASOS del taller (nombre + guía de cada uno de los 8 pasos).
const ARCO_PASOS: { n: string; guia: string }[] = [
    { n: 'El gancho (encuesta)', guia: 'Plantea el dilema tal cual lo vive la familia, con 2-3 opciones con emoji, y cierra con la encuesta Sí / No.' },
    { n: 'El giro', guia: 'Dale la vuelta: «La pregunta no es si…». El problema real no es el que parece a primera vista.' },
    { n: 'Qué aprende el niño', guia: 'La creencia que se le está quedando dentro al niño con la situación actual (sin culpar a nadie).' },
    { n: 'La consecuencia', guia: 'Qué pasa si seguimos así. Describe, no sentencies: nada de dramatismo ni de culpas.' },
    { n: 'El matiz', guia: 'No es todo o nada: qué SÍ se puede hacer, dónde está la línea que separa lo uno de lo otro.' },
    { n: '❌ vs ✅', guia: 'Dos frases concretas enfrentadas: la que solemos decir sin pensar y la alternativa que enseña.' },
    { n: 'El reencuadre', guia: 'Por qué esa diferencia pequeña cambia por completo el mensaje que recibe el niño.' },
    { n: 'El cierre', guia: 'Tu filosofía (la autonomía del niño) + invitación suave: «Comenta PALABRA y te cuento».' },
]

// = CONSULTAS_BANCO[0].pasos[0][0] y [7][0] del taller (los 2 ejemplos literales).
const EJEMPLO_H1 = '¿Le das premios a tu hijo para que estudie?\n\n🍫 Un helado.\n\n🎮 Más tiempo de pantalla.\n\n💰 Dinero por las notas.\n\n¿Crees que funciona?\n\n👉 Sí / No (encuesta)'
const EJEMPLO_H8 = 'Mi objetivo no es que un niño estudie por un premio.\n\nEs que llegue un día en el que sea capaz de decir:\n\n"Lo hago porque sé que puedo."\n\nEse es el tipo de autonomía que buscamos.'

// = conCita() del taller: la consulta en una línea, recortada a 200 caracteres.
function cita(t: string): string {
    let s = String(t || '').replace(/\s+/g, ' ').trim()
    if (s.length > 200) s = s.slice(0, 200).trim() + '…'
    return s
}

function construirEncargo(consulta: string): string {
    return 'Eres quien escribe los textos de Instagram de Selene, profesora particular de apoyo de ' +
        'primaria, especializada en organización, hábitos y técnicas de estudio. Muy importante: su ' +
        'cliente es el PADRE o la MADRE del alumno (quien la contrata y quien la sigue en Instagram), ' +
        'no el niño.\n\n' +
        'Una familia le ha escrito esta consulta:\n\n«' + cita(consulta) + '»\n\n' +
        'Escribe una secuencia de 8 historias de Instagram sobre esa consulta siguiendo EXACTAMENTE ' +
        'este arco narrativo:\n\n' +
        ARCO_PASOS.map((p, i) => 'HISTORIA ' + (i + 1) + ' — ' + p.n + ': ' + p.guia).join('\n') + '\n\n' +
        'TONO Y ESTILO:\n' +
        '- Cercano y empático. Jamás culpabilices a los padres ni al niño.\n' +
        '- Frases cortas, una idea por línea, separadas por líneas en blanco (como se lee en una historia de Instagram).\n' +
        '- Emojis con moderación (2 a 5 por historia), nada recargado.\n' +
        '- Nada de promesas milagro, tecnicismos ni jerga de psicología.\n' +
        '- Consejos realistas de organización y estudio propios de primaria.\n' +
        '- La HISTORIA 1 empieza citando la consulta tal cual (Me escribe una familia: “…”) y termina con «👉 Sí / No (encuesta)».\n' +
        '- La HISTORIA 8 cierra con la filosofía de Selene (que el niño acabe haciéndolo solo: autonomía) ' +
        'más una invitación suave del tipo «Comenta PALABRA y te cuento», eligiendo una PALABRA clave ' +
        'EN MAYÚSCULAS acorde al tema.\n\n' +
        'EJEMPLOS DEL ESTILO QUE BUSCO (son de otra consulta, sobre premios por estudiar — no los copies, imita el estilo):\n\n' +
        'Ejemplo de HISTORIA 1:\n' + EJEMPLO_H1 + '\n\n' +
        'Ejemplo de HISTORIA 8:\n' + EJEMPLO_H8 + '\n\n' +
        'FORMATO DE SALIDA (estricto):\n' +
        'Responde ÚNICAMENTE con los 8 bloques, cada uno encabezado por una línea que diga exactamente ' +
        'HISTORIA 1, HISTORIA 2… hasta HISTORIA 8, y debajo el texto completo de esa historia. ' +
        'Sin saludo, sin comentarios antes ni después, sin numeración adicional y sin negritas de markdown.'
}

// ───────────────────────────────────────────────────────────────────────────
// Log de costes (JSON plano, sin migraciones de Prisma)
// ───────────────────────────────────────────────────────────────────────────

type LogEntry = { fecha: string; consulta: string; tokensIn: number; tokensOut: number; costeUsd: number }

function leerLog(): LogEntry[] {
    try {
        if (!fs.existsSync(LOG_PATH)) return []
        const j = JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8'))
        return Array.isArray(j) ? j : []
    } catch {
        return []
    }
}

function apuntarEnLog(entry: LogEntry) {
    try {
        const log = leerLog()
        log.push(entry)
        // Se conservan como máximo las 500 últimas entradas.
        const recortado = log.slice(-LOG_MAX)
        fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true })
        fs.writeFileSync(LOG_PATH, JSON.stringify(recortado, null, 2))
    } catch {
        // El log jamás tumba la respuesta al taller.
    }
}

// ───────────────────────────────────────────────────────────────────────────
// Llamada a Anthropic (fetch directo, sin SDK)
// ───────────────────────────────────────────────────────────────────────────

// MODO PRUEBA: con ANTHROPIC_API_KEY === 'fake' no se toca la red — respuesta
// enlatada con los 8 bloques HISTORIA 1..8 y usage simulado, para poder
// verificar el circuito completo en local sin gastar un céntimo.
function respuestaEnlatada(): { texto: string; input_tokens: number; output_tokens: number } {
    const bloques = ARCO_PASOS.map((p, i) =>
        'HISTORIA ' + (i + 1) + '\n' +
        '(Respuesta de PRUEBA — paso «' + p.n + '»)\n\n' +
        'Esta es la historia ' + (i + 1) + ' generada en modo prueba.\n\n' +
        'Una idea por línea, como en Instagram.\n\n' +
        (i === 0 ? '👉 Sí / No (encuesta)' : i === 7 ? 'Comenta PRUEBA y te cuento. ✨' : 'Sigue el arco sin culpar a nadie. 🌱'))
    return { texto: bloques.join('\n\n'), input_tokens: 1200, output_tokens: 900 }
}

async function llamarAnthropic(encargo: string): Promise<{ texto: string; input_tokens: number; output_tokens: number }> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('El servidor no tiene configurada la clave de la IA (ANTHROPIC_API_KEY).')
    if (apiKey === 'fake') return respuestaEnlatada()

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model: 'claude-sonnet-5',
            max_tokens: 3000,
            messages: [{ role: 'user', content: encargo }],
        }),
    })
    if (!resp.ok) {
        // Mensaje entendible, sin volcar jamás la clave ni cabeceras.
        let detalle = ''
        try {
            const j = await resp.json()
            detalle = j?.error?.message || ''
        } catch { /* cuerpo no-JSON: se ignora */ }
        if (resp.status === 401) throw new Error('La clave de la IA no es válida (revisa ANTHROPIC_API_KEY en Railway).')
        if (resp.status === 429) throw new Error('La IA está saturada ahora mismo (límite de peticiones). Prueba en un minuto.')
        if (resp.status >= 500 || resp.status === 529) throw new Error('El servicio de la IA está caído temporalmente. Prueba en un minuto.')
        throw new Error('La IA rechazó la petición' + (detalle ? ': ' + detalle : ` (HTTP ${resp.status}).`))
    }
    const data = await resp.json()
    const texto = Array.isArray(data?.content)
        ? data.content.filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('\n')
        : ''
    if (!texto) throw new Error('La IA devolvió una respuesta vacía. Vuelve a intentarlo.')
    return {
        texto,
        input_tokens: Number(data?.usage?.input_tokens || 0),
        output_tokens: Number(data?.usage?.output_tokens || 0),
    }
}

// ───────────────────────────────────────────────────────────────────────────
// Handlers
// ───────────────────────────────────────────────────────────────────────────

export async function OPTIONS() {
    // Preflight del navegador (el taller manda content-type + x-selene-token).
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
    const token = request.headers.get('x-selene-token') || ''
    if (!TOKEN || token !== TOKEN) {
        return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401, headers: CORS_HEADERS })
    }
    let consulta = ''
    try {
        const body = await request.json()
        consulta = String(body?.consulta || '').trim()
    } catch {
        return NextResponse.json({ ok: false, error: 'cuerpo inválido (se espera JSON con "consulta")' },
            { status: 400, headers: CORS_HEADERS })
    }
    if (!consulta) {
        return NextResponse.json({ ok: false, error: 'la consulta no puede estar vacía' },
            { status: 400, headers: CORS_HEADERS })
    }
    if (consulta.length > 600) {
        return NextResponse.json({ ok: false, error: 'la consulta es demasiado larga (máx. 600 caracteres)' },
            { status: 400, headers: CORS_HEADERS })
    }

    try {
        const encargo = construirEncargo(consulta)
        const r = await llamarAnthropic(encargo)
        const costeUsd = r.input_tokens * USD_IN_PER_TOKEN + r.output_tokens * USD_OUT_PER_TOKEN
        apuntarEnLog({
            fecha: new Date().toISOString(),
            consulta: consulta.slice(0, 200),
            tokensIn: r.input_tokens,
            tokensOut: r.output_tokens,
            costeUsd,
        })
        return NextResponse.json({
            ok: true,
            texto: r.texto,
            usage: { input_tokens: r.input_tokens, output_tokens: r.output_tokens },
            costeUsd,
        }, { headers: CORS_HEADERS })
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: String(e?.message || e) },
            { status: 502, headers: CORS_HEADERS })
    }
}

// GET server-to-server para el contador «Costes IA» del Admin del ERP.
export async function GET(request: Request) {
    const secret = request.headers.get('x-prv-secret') || ''
    if (!PRV_SECRET || secret !== PRV_SECRET) {
        return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
    const entradas = leerLog()
    const totales = entradas.reduce(
        (acc, e) => ({
            n: acc.n + 1,
            costeUsd: acc.costeUsd + (Number(e.costeUsd) || 0),
            tokensIn: acc.tokensIn + (Number(e.tokensIn) || 0),
            tokensOut: acc.tokensOut + (Number(e.tokensOut) || 0),
        }),
        { n: 0, costeUsd: 0, tokensIn: 0, tokensOut: 0 },
    )
    return NextResponse.json({ ok: true, entradas, totales })
}
