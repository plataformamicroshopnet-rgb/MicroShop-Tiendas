export const VENDEDORES = [
  "Javier", "Juan Carlos", "Luis", "Belén", "Maite", "Elena"
];

export const CODIGOS_TRAMITACION = [
  "Plus 1SK", "Plus ZF7", "Plus NFG", "Plus N7D", "Plus K2Z", "Básico XCU", "Residencial"
];

export const PRODUCTOS_MOVIL = [
  "",
  "Porta Móvil AV",
  "Porta Móvil MV",
  "Porta Móvil BV",
  "Porta Móvil AV NC",
  "Porta Móvil MV NC",
  "Porta Móvil BV NC",
  "Alta Móvil AV",
  "Alta Móvil MV",
  "Alta Móvil BV",
];

export const PRODUCTOS_FIJA = [
  "",
  "Alarma Directa",
  "Alarma Asistida o Esencial",
  "Alta FD Total",
  "Alta FD Total NC",
  "Migra FD Total",
  "Puesto Fijo",
  "Puesto Fijo 365",
  "Alta FD Flex",
  "Alta FD Flex NC",
  "Migra FD Flex",
  "Microinformática",
  "TMA",
  "Alta BAF Total",
  "Alta BAF Total NC",
  "Respaldo 5G",
  "Migra BAF Total",
  "Renovación Base",
  "Renovación Extra = 1",
  "Renovación Extra > 1",
  "Alta FN Flex",
  "Alta FN Flex NC",
  "Migra FN Flex",
  "Servicio TI KD Instalado",
  "Servicio TI KD Ganado",
  "Servicio TI KC Instalado",
  "Servicio TI KC Ganado",
  "Servicio No KD",
  "TGT",
  "Solar",
  "Firma KD Ganada [Solo Comisiones]",
  "Firma KC Ganada [Solo Comisiones]",
  "Renovación + Dispositivo [Solo Comisiones]",
];

export const OBJECTIVE_MAPPING: Record<string, string[]> = {
  // FD: ALL 6 products have their own admin rows with distinct rates — each matches its own row only
  "Alta FD Total": ["Alta FD Total"],
  "Alta FD Flex": ["Alta FD Flex"],
  "Puesto Fijo": ["Puesto Fijo", "Puesto Fijo 365"],
  // FN: NC and Migra have own admin rows
  "Alta FN Flex": ["Alta FN Flex"],
  "Alta BAF Total": ["Alta BAF Total", "Migra BAF Total"],
  // Alta Movil: AV/MV/BV each have different rates and own admin rows (same as PORTA)
  "Alta Móvil AV": ["Alta Móvil AV"],
  "Alta Móvil MV": ["Alta Móvil MV"],
  "Alta Móvil BV": ["Alta Móvil BV"],

  "Microinformática": ["Microinformática"],
  "TMA": ["TMA"],
  "Alarma Directa": ["Alarma Directa", "Alarma Asistida o Esencial"],
  "Servicio TI KD Instalado": ["Servicio TI KD Instalado", "Servicio TI KC Instalado", "Servicio No KD"],
  "Solar": ["Solar"]
};

export const OBJECTIVE_KEYS = Object.keys(OBJECTIVE_MAPPING);
