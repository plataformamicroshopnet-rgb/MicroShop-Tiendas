export type MetricLineageNode = {
    id: string;
    label: string;
    type: 'source' | 'process' | 'output';
    description?: string;
    formula?: string;
};

export type MetricLineage = {
    key: string;
    title: string;
    description: string;
    formula: string;
    sources: MetricLineageNode[];
    destinations: MetricLineageNode[];
};

export const DATA_DICTIONARY: Record<string, MetricLineage> = {
    'ARPU_VENTAS': {
        key: 'ARPU_VENTAS',
        title: 'Ventas Arpu (Repos)',
        description: 'Suma de todas las ventas categorizadas como ARPU o Reposiciones para un comercial específico en el mes actual.',
        formula: '∑ (Ventas donde Tipo = ARPU)',
        sources: [
            { id: 's1', label: 'Formulario de Ventas (App)', type: 'source', description: 'Registro manual o automático de ventas diarias.' },
            { id: 's2', label: 'Base de Datos (Mes Activo)', type: 'source', description: 'Tabla de ventas filtrada por el periodo actual.' }
        ],
        destinations: [
            { id: 'd1', label: 'Comisión Equipo', type: 'output', description: 'Cálculo de la comisión directa del comercial.' },
            { id: 'd2', label: 'Comisión Jefe Tiendas', type: 'output', description: 'Se suma al global de la tienda para el objetivo del jefe.' }
        ]
    },
    'DISP_SEG_VENTAS': {
        key: 'DISP_SEG_VENTAS',
        title: 'Ventas Dispositivos + Seguros',
        description: 'Suma de todas las ventas categorizadas como Dispositivo o Seguro.',
        formula: '∑ (Ventas donde Tipo = Dispositivo o Seguro)',
        sources: [
            { id: 's1', label: 'Formulario de Ventas (App)', type: 'source' },
            { id: 's2', label: 'Base de Datos (Mes Activo)', type: 'source' }
        ],
        destinations: [
            { id: 'd1', label: 'Comisión Equipo', type: 'output' },
            { id: 'd2', label: 'Comisión Jefe Tiendas', type: 'output' }
        ]
    },
    'AVANCE_IMPORTE_JEFE_DISP': {
        key: 'AVANCE_IMPORTE_JEFE_DISP',
        title: 'Avance de Importe (Disp+Seg)',
        description: 'Proyección económica ganada por el jefe de tiendas sobre las ventas de dispositivos de su equipo, asumiendo que se cumple el objetivo.',
        formula: 'Total Ventas Equipo * Porcentaje Objetivo (1 o 2)',
        sources: [
            { id: 's1', label: 'Ventas Equipo (Disp+Seg)', type: 'process' },
            { id: 's2', label: 'Configuración % Comisión Jefe', type: 'source', description: 'Porcentajes definidos por el administrador.' }
        ],
        destinations: [
            { id: 'd1', label: 'Total Condicionado Jefe', type: 'process' },
            { id: 'd2', label: 'Comisión Final Jefe', type: 'output' }
        ]
    },
    'AVANCE_IMPORTE_JEFE_ARPU': {
        key: 'AVANCE_IMPORTE_JEFE_ARPU',
        title: 'Avance de Importe (Arpu)',
        description: 'Proyección económica ganada por el jefe de tiendas sobre las ventas ARPU de su equipo.',
        formula: 'Total Ventas Equipo ARPU * Porcentaje Objetivo Arpu (1 o 2)',
        sources: [
            { id: 's1', label: 'Ventas Equipo (Arpu)', type: 'process' },
            { id: 's2', label: 'Configuración % Comisión Jefe', type: 'source' }
        ],
        destinations: [
            { id: 'd1', label: 'Total Condicionado Jefe', type: 'process' },
            { id: 'd2', label: 'Comisión Final Jefe', type: 'output' }
        ]
    },
    'COMISION_INDIVIDUAL_TRAMO': {
        key: 'COMISION_INDIVIDUAL_TRAMO',
        title: 'Comisión por Tramo (Comercial)',
        description: 'Importe ganado por el comercial al alcanzar un tramo de objetivos específico (Obj 1 u Obj 2).',
        formula: 'Si (Ventas >= Obj 2) -> Importe Obj 2; Si (Ventas >= Obj 1) -> Importe Obj 1; Si no -> 0',
        sources: [
            { id: 's1', label: 'Ventas del Comercial', type: 'process' },
            { id: 's2', label: 'Configuración Tramos (Admin)', type: 'source' }
        ],
        destinations: [
            { id: 'd1', label: 'Total Consolidado Comercial', type: 'output' }
        ]
    }
};

export const getLineage = (key: string): MetricLineage | undefined => {
    return DATA_DICTIONARY[key];
};
