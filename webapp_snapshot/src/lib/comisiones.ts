export const COMISIONES_NACIONALES = [
  // --- FUSIÓN DIGITAL TOTAL ---
  {
    producto: 'Alta FD Total', objKey: 'FUSIÓN DIGITAL TOTAL',
    t50: 95, t80: 195, t100: 255, t120: 350, type: 'UDS'
  },
  {
    producto: 'Alta FD Total NC', objKey: 'FUSIÓN DIGITAL TOTAL',
    t50: 135, t80: 275, t100: 360, t120: 500, type: 'UDS'
  },
  {
    producto: 'Migra FD Total', objKey: 'FUSIÓN DIGITAL TOTAL',
    t50: 40, t80: 100, t100: 135, t120: 170, type: 'UDS'
  },
  {
    producto: 'Alta FD Flex', objKey: 'FUSIÓN DIGITAL TOTAL',
    t50: 95, t80: 195, t100: 255, t120: 350, type: 'UDS'
  },
  {
    producto: 'Alta FD Flex NC', objKey: 'FUSIÓN DIGITAL TOTAL',
    t50: 135, t80: 275, t100: 360, t120: 500, type: 'UDS'
  },
  {
    producto: 'Migra FD Flex', objKey: 'FUSIÓN DIGITAL TOTAL',
    t50: 40, t80: 100, t100: 135, t120: 170, type: 'UDS'
  },

  // --- PUESTO FIJO / MFE_PRO ---
  {
    producto: 'Puesto Fijo', objKey: 'MFE_PRO_Negocios_(Altas)',
    t50: 10, t80: 10, t100: 10, t120: 10, type: 'UDS'
  },
  {
    producto: 'Puesto Fijo 365', objKey: 'MFE_PRO_Negocios_(Altas)',
    t50: 10, t80: 10, t100: 10, t120: 10, type: 'UDS'
  },

  // --- FN FLEX ---
  {
    producto: 'Alta FN Flex', objKey: 'Altas BAF TOTAL (BAF + FNegocios)',
    t50: 0, t80: 40, t100: 65, t120: 95, type: 'UDS'
  },
  {
    producto: 'Alta FN Flex NC', objKey: 'Altas BAF TOTAL (BAF + FNegocios)',
    t50: 0, t80: 40, t100: 65, t120: 95, type: 'UDS'
  },
  
  // --- BAF TOTAL ---
  {
    producto: 'Alta BAF Total', objKey: 'Altas BAF TOTAL (BAF + FNegocios)',
    t50: 0, t80: 55, t100: 85, t120: 120, type: 'UDS'
  },
  {
    producto: 'Alta BAF Total NC', objKey: 'Altas BAF TOTAL (BAF + FNegocios)',
    t50: 0, t80: 80, t100: 125, t120: 170, type: 'UDS'
  },
  {
    producto: 'Respaldo 5G', objKey: 'Altas BAF TOTAL (BAF + FNegocios)',
    t50: 0, t80: 55, t100: 85, t120: 120, type: 'UDS'
  },
  {
    producto: 'Migra BAF Total', objKey: 'Altas BAF TOTAL (BAF + FNegocios)',
    t50: 40, t80: 40, t100: 40, t120: 40, type: 'UDS'
  },

  // --- MÓVIL ALTA ---
  {
    producto: 'Alta Móvil AV', objKey: 'ALTAS MOVIL Sin Porta',
    t50: 5, t80: 5, t100: 5, t120: 5, type: 'UDS'
  },
  {
    producto: 'Alta Móvil MV', objKey: 'ALTAS MOVIL Sin Porta',
    t50: 5, t80: 5, t100: 5, t120: 5, type: 'UDS'
  },
  {
    producto: 'Alta Móvil BV', objKey: 'ALTAS MOVIL Sin Porta',
    t50: 5, t80: 5, t100: 5, t120: 5, type: 'UDS'
  },

  // --- MÓVIL PORTA ---
  {
    producto: 'Porta Móvil AV', objKey: 'Altas VM porta',
    t50: 40, t80: 55, t100: 65, t120: 90, type: 'UDS'
  },
  {
    producto: 'Porta Móvil AV NC', objKey: 'Altas VM porta',
    t50: 60, t80: 75, t100: 95, t120: 130, type: 'UDS'
  },
  {
    producto: 'Porta Móvil MV', objKey: 'Altas VM porta',
    t50: 30, t80: 45, t100: 55, t120: 75, type: 'UDS'
  },
  {
    producto: 'Porta Móvil MV NC', objKey: 'Altas VM porta',
    t50: 45, t80: 65, t100: 75, t120: 105, type: 'UDS'
  },
  {
    producto: 'Porta Móvil BV', objKey: 'Altas VM porta',
    t50: 15, t80: 20, t100: 25, t120: 40, type: 'UDS'
  },
  {
    producto: 'Porta Móvil BV NC', objKey: 'Altas VM porta',
    t50: 20, t80: 30, t100: 40, t120: 60, type: 'UDS'
  },

  // --- MICROINFORMÁTICA Y TMA ---
  {
    producto: 'Microinformática', objKey: 'Microinformatica_(Altas)',
    t50: 0.24, t80: 0.72, t100: 0.96, t120: 1.92, type: 'EUR_PCT'
  },
  {
    producto: 'TMA', objKey: 'TMAs_(Altas)',
    t50: 0.24, t80: 0.72, t100: 0.96, t120: 1.92, type: 'EUR_PCT'
  },

  // --- ALARMAS ---
  {
    producto: 'Alarma Directa', objKey: null,
    t50: 100, t80: 100, t100: 100, t120: 100, type: 'UDS'
  },
  {
    producto: 'Alarma Asistida o Esencial', objKey: null,
    t50: 75, t80: 75, t100: 75, t120: 75, type: 'UDS'
  },

  // --- SERVICIOS TI ---
  {
    producto: 'Servicio TI KD Instalado', objKey: 'TOTAL TI',
    t50: 0.09, t80: 0.09, t100: 0.09, t120: 0.09, type: 'EUR_PCT'
  },
  {
    producto: 'Servicio TI KC Instalado', objKey: 'TOTAL TI',
    t50: 0.09, t80: 0.09, t100: 0.09, t120: 0.09, type: 'EUR_PCT'
  },
  {
    producto: 'Ti', objKey: 'TOTAL TI',
    t50: 0.09, t80: 0.09, t100: 0.09, t120: 0.09, type: 'EUR_PCT'
  },
  {
    producto: 'Solar', objKey: 'TI_Solar_(Altas)',
    t50: 0.09, t80: 0.09, t100: 0.09, t120: 0.09, type: 'EUR_PCT'
  }
];

// --- Lógica Compartida FrontEnd / Dashboard ---
export const getProfile = (vendedorName: string) => {
    const nombre = String(vendedorName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
    if (nombre === 'luis') return 'Básico'
    if (['elena', 'javier', 'juan carlos', 'belen', 'maite'].includes(nombre)) return 'Plus'
    return 'Desconocido'
}

export const ALL_GROUPS = ['FD', 'BAF', 'REN', 'ALTA', 'PORTA', 'TMA', 'TI', 'MIC', 'MPA']

export const PRODUCT_GROUPS: Record<string, string[]> = {
    'FD': [
        'alta fd total', 'alta fd total nc', 'migra fd total', 
        'alta fd flex', 'alta fd flex nc', 'migra fd flex'
    ],
    'BAF': [
        'alta baf total', 'alta baf total nc', 'respaldo 5g'
    ],
    'REN': [
        'renovacion + dispositivo'
    ],
    'ALTA': [
        'alta movil av', 'alta movil mv'
    ],
    'PORTA': [
        'porta movil av nc', 'porta movil av', 'porta movil mv nc', 
        'porta movil mv', 'porta movil bv nc', 'porta movil bv'
    ],
    'MPA': [
        'alarma directa', 'venta mpa'
    ]
}

export const getGroupVisual = (producto: string, detalle: string) => {
    const det = String(detalle || '').trim().toLowerCase()
    if (det === 'ti') return 'TI'
    if (det === 'tma') return 'TMA'
    if (det === 'micro' || det === 'mic') return 'MIC'
    
    if (!producto) return null
    
    const p = String(producto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
    
    if (['tmas', 'tma'].includes(p)) return 'TMA'
    if (['tis', 'ti', 'tgt', 'tgt (usuario)', 'hacemos tu negocio web'].includes(p)) return 'TI'
    if (['micro informatica', 'micro', 'mic'].includes(p)) return 'MIC'

    for (const [gName, validos] of Object.entries(PRODUCT_GROUPS)) {
        if (validos.includes(p)) {
            return gName
        }
    }

    return null // Omitido del gráfico si no existe
}

export const mapObjectiveGroup = (rowName: string) => {
    if (!rowName) return null;
    const p = String(rowName).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    if (['alta fd total', 'alta fd total nc', 'migra fd total', 'alta fd flex', 'alta fd flex nc', 'migra fd flex'].includes(p)) return 'FD';
    if (['alta baf total', 'alta baf total nc', 'respaldo 5g'].includes(p)) return 'BAF';
    if (['renovacion + dispositivo'].includes(p)) return 'REN';
    if (['alta movil av', 'alta movil mv'].includes(p)) return 'ALTA';
    if (['porta movil av nc', 'porta movil av', 'porta movil mv nc', 'porta movil mv', 'porta movil bv nc', 'porta movil bv'].includes(p)) return 'PORTA';
    if (['alarma directa', 'venta mpa'].includes(p)) return 'MPA';
    
    if (['tmas', 'tma'].includes(p)) return 'TMA';
    if (['tis', 'ti'].includes(p)) return 'TI';
    if (['micro informatica', 'microinformatica', 'micro', 'mic'].includes(p)) return 'MIC';

    return null;
}

export const FIXED_SELLERS = ['Luis', 'Javier', 'Elena', 'Maite', 'Belén', 'Juan Carlos']

