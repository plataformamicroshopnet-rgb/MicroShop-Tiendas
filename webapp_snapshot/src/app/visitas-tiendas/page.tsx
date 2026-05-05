'use client'

import React, { useState, useEffect } from 'react'
import { MapPin, ArrowLeft, Upload, Table as TableIcon, Download, Search, X, PlusCircle } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'
import { can, canEdit } from '@/lib/permissions'
import { useGuard } from '@/hooks/useGuard'

type ActionType = 'Teléfono' | 'Teams' | 'Presencial' | 'NoCliente';

interface ClientEntry {
  codigoTiendas: string;
  medio: string;
  objetoVisita: string;
  cif: string;
  empresa: string;
  direccion: string;
  cp: string;
  tandem: string;
  tipo: string;
}

interface Movement {
  cif: string;
  codigoTiendas?: string;
  action: ActionType;
  date: string; 
  year: number;
  trimestre: number;
  mesInterno: number; // 1, 2, 3
  observacion?: string;
}

interface DataStore {
  clients: ClientEntry[];
  movements: Movement[];
}

const PRIORITY: Record<string, number> = {
  'Presencial': 4,
  'Teams': 3,
  'Teléfono': 2,
  'NoCliente': 1
};

export default function VisitasTiendasPage() {
  const { authorized } = useGuard('MODULE_CUMPLIMIENTO')
  const currentDate = new Date();
  
  const [data, setData] = useState<DataStore>({ clients: [], movements: [] });
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedTrimestre, setSelectedTrimestre] = useState(Math.floor(currentDate.getMonth() / 3) + 1);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const canEditFlag = user ? canEdit(user, 'MODULE_CUMPLIMIENTO') : false;

  // Inline Editing Cells State
  const [editingCell, setEditingCell] = useState<{cif: string; mes: number} | null>(null);

  // Inline Client Row Editing State
  const [editingClientCif, setEditingClientCif] = useState<string | null>(null);
  const [draftClient, setDraftClient] = useState<Partial<ClientEntry>>({});

  const [exportModal, setExportModal] = useState(false);
  const [exportCodes, setExportCodes] = useState<string[]>([]);
  const [exportMonths, setExportMonths] = useState<number[]>([1, 2, 3]);
  const [exportNoContactados, setExportNoContactados] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exportActionFilter, setExportActionFilter] = useState(''); 

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.authenticated) setUser(d.user) })
      .catch(() => {});

    setLoading(true);
    fetch(`/api/visitas-tiendas?year=${selectedYear}&trimestre=${selectedTrimestre}`)
      .then(r => r.json())
      .then(d => {
          if (d.clients) setData(d);
          else setData({ clients: [], movements: [] });
          setExportCodes([]); 
          setExportMonths([1, 2, 3]);
          setDateFrom('');
          setDateTo('');
          setExportActionFilter('');
          setEditingCell(null);
          setEditingClientCif(null);
          setDraftClient({});
      })
      .catch(e => console.error("Error fetching", e))
      .finally(() => setLoading(false));
  }, [selectedYear, selectedTrimestre]);

  const saveData = async (newData: DataStore) => {
    setData(newData); 
    try {
        await fetch('/api/visitas-tiendas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year: selectedYear, trimestre: selectedTrimestre, data: newData })
        });
    } catch (e) {
        console.error("Error saving", e);
        alert("Problema al guardar en el servidor.");
    }
  };

  const parseDateToTrimestre = (dateStr: string) => {
    let d = new Date();
    const str = String(dateStr).trim()
    if (str.includes('/') || str.includes('-')) {
        const parts = str.split(/[\/-]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) {
               d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            } else {
               d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            }
        }
    } else {
        d = new Date(str);
    }
    if (isNaN(d.getTime())) d = new Date(); 
    
    const absoluteMonth = d.getMonth();
    return { 
        year: d.getFullYear(), 
        trimestre: Math.floor(absoluteMonth / 3) + 1, 
        mesInterno: (absoluteMonth % 3) + 1 
    };
  };

  const startNewClient = () => {
      setEditingClientCif('__NEW__');
      setDraftClient({ codigoTiendas: '', medio: '', objetoVisita: '', cif: '', empresa: '', direccion: '', cp: '', tandem: '' });
  };

  const startInlineEdit = (c: ClientEntry) => {
      setEditingClientCif(c.cif);
      setDraftClient({ ...c });
  };

  const cancelInlineEdit = () => {
      setEditingClientCif(null);
      setDraftClient({});
  };

  const handleDraftChange = (field: keyof ClientEntry, value: string) => {
      setDraftClient(prev => ({ ...prev, [field]: value }));
  };

  const saveInlineEdit = async (isNew: boolean) => {
      const rawCif = draftClient.cif?.trim() || '';
      const rawCodigoTiendas = draftClient.codigoTiendas?.trim() || '';

      if (!rawCif || !rawCodigoTiendas) {
          alert("El CIF y el Código Tiendas son obligatorios.");
          return;
      }

      const mergedData = { ...data };

      if (isNew) {
          const existe = data.clients.some(c => c.cif.toLowerCase() === rawCif.toLowerCase());
          if (existe) {
              alert(`Ya existe un cliente con el CIF: ${rawCif}.`);
              return;
          }
          const newRecord = { ...draftClient } as ClientEntry;
          mergedData.clients = [newRecord, ...data.clients];
      } else {
          mergedData.clients = data.clients.map(c => c.cif === rawCif ? { ...c, ...draftClient } as ClientEntry : c);
      }

      await saveData(mergedData);
      setEditingClientCif(null);
      setDraftClient({});
  };

  const handleImportClients = async () => {
    try {
        const clipboard = await navigator.clipboard.readText();
        const rows = clipboard.split('\n').map(r => r.split('\t'));
        
        if (rows[0] && rows[0].join('').toLowerCase().includes('cif')) rows.shift();

        const newClients: ClientEntry[] = [];
        let headerHasMedio = false;
        if (rows[0] && rows[0].join('').toLowerCase().includes('cif')) {
            const hStr = rows[0].join('\t').toLowerCase();
            if (hStr.includes('medio')) headerHasMedio = true;
            rows.shift();
        }

        rows.forEach(row => {
            if (row.length >= 7) {
                let cifIdx = 3, objIdx = 2, empIdx = 4, cpIdx = 6, tipoIdx = 8;
                
                // Heurística de detección: Export del Dashboard (sin columna medio) u origen Salesforce
                if (!headerHasMedio && row[2]?.trim().length >= 8 && row[2]?.trim().length <= 15 && !row[2]?.trim().includes(' ')) {
                    cifIdx = 2; objIdx = 1; empIdx = 3; cpIdx = 5; tipoIdx = 7;
                }

                const cif = String(row[cifIdx] || '').trim();
                if (cif !== '') {
                    newClients.push({
                        codigoTiendas: String(row[0] || '').trim(),
                        medio: cifIdx === 3 ? String(row[1] || '').trim() : 'N/A',
                        objetoVisita: String(row[objIdx] || '').trim(),
                        cif: cif,
                        empresa: String(row[empIdx] || '').trim(),
                        direccion: String(row[empIdx+1] || '').trim(),
                        cp: String(row[cpIdx] || '').trim(),
                        tandem: String(row[cpIdx+1] || '').trim(),
                        tipo: String(row[tipoIdx] || '').trim()
                    });
                }
            }
        });

        if (newClients.length === 0) return alert("Faltan columnas o el grid está vacío (no se detectó CIF válido).");

        await saveData({ ...data, clients: newClients });
        alert(`¡Base del T${selectedTrimestre} reemplazada al 100%! Cargados ${newClients.length} clientes válidos.`);
    } catch (err) {
        alert("Error de portapapeles. Da permisos de lectura si se solicita.");
    }
  };

  const handleAddClients = async () => {
    try {
        const clipboard = await navigator.clipboard.readText();
        const rows = clipboard.split('\n').map(r => r.split('\t'));

        if (rows[0] && rows[0].join('').toLowerCase().includes('cif')) rows.shift();

        const parsedClients: ClientEntry[] = [];
        let headerHasMedio = false;
        if (rows[0] && rows[0].join('').toLowerCase().includes('cif')) {
            const hStr = rows[0].join('\t').toLowerCase();
            if (hStr.includes('medio')) headerHasMedio = true;
            rows.shift();
        }

        rows.forEach(row => {
            if (row.length >= 7) {
                let cifIdx = 3, objIdx = 2, empIdx = 4, cpIdx = 6, tipoIdx = 8;
                if (!headerHasMedio && row[2]?.trim().length >= 8 && row[2]?.trim().length <= 15 && !row[2]?.trim().includes(' ')) {
                    cifIdx = 2; objIdx = 1; empIdx = 3; cpIdx = 5; tipoIdx = 7;
                }
                const cif = String(row[cifIdx] || '').trim();
                if (cif !== '') {
                    parsedClients.push({
                        codigoTiendas: String(row[0] || '').trim(),
                        medio: cifIdx === 3 ? String(row[1] || '').trim() : 'N/A',
                        objetoVisita: String(row[objIdx] || '').trim(),
                        cif: cif,
                        empresa: String(row[empIdx] || '').trim(),
                        direccion: String(row[empIdx+1] || '').trim(),
                        cp: String(row[cpIdx] || '').trim(),
                        tandem: String(row[cpIdx+1] || '').trim(),
                        tipo: String(row[tipoIdx] || '').trim()
                    });
                }
            }
        });

        if (parsedClients.length === 0) return alert('Faltan columnas o el grid está vacío (no se detectó CIF válido).');

        const existingCifs = new Set(data.clients.map(c => c.cif.toLowerCase()));
        const newOnes = parsedClients.filter(c => !existingCifs.has(c.cif.toLowerCase()));
        const duplicates = parsedClients.length - newOnes.length;

        if (newOnes.length === 0) {
            return alert(`Ningún cliente nuevo: los ${parsedClients.length} pegados ya existen en la base (mismos CIFs).`);
        }

        await saveData({ ...data, clients: [...data.clients, ...newOnes] });
        const dupMsg = duplicates > 0 ? `\n(${duplicates} ignorados por CIF ya existente)` : '';
        alert(`¡Añadidos ${newOnes.length} clientes nuevos a la base existente!${dupMsg}`);
    } catch (err) {
        alert('Error de portapapeles. Da permisos de lectura si se solicita.');
    }
  };

  const handleImportActions = async () => {
    try {
        const clipboard = await navigator.clipboard.readText();
        const rows = clipboard.split('\n').map(r => r.split('\t'));
        if (rows[0] && rows[0].join('').toLowerCase().includes('fecha')) rows.shift();

        const newMovements: Movement[] = [];
        let erroresIncoherencia = 0;

        rows.forEach(row => {
            if (row.length >= 4 && row[1]?.trim() !== '') {
                const codigoTiendas = String(row[0]).trim();
                const cif = String(row[1]).trim();
                const rawDate = String(row[2]).trim();
                const rawAction = String(row[3]).trim();
                
                const baseClient = data.clients.find(c => c.cif === cif);
                if (baseClient && baseClient.codigoTiendas !== codigoTiendas && codigoTiendas !== '') {
                    erroresIncoherencia++;
                    return; 
                }

                const aNorm = rawAction.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                let action: ActionType = 'Teléfono';
                if (aNorm.includes('presencial') || aNorm.includes('visita')) action = 'Presencial';
                else if (aNorm.includes('teams') || aNorm.includes('video')) action = 'Teams';
                else if (aNorm.includes('nocliente') || aNorm.includes('no cliente')) action = 'NoCliente';
                else action = 'Teléfono';

                const { year, trimestre, mesInterno } = parseDateToTrimestre(rawDate);

                if (year === selectedYear && trimestre === selectedTrimestre) {
                    newMovements.push({ cif, action, date: rawDate, year, trimestre, mesInterno, codigoTiendas });
                }
            }
        });

        if (newMovements.length === 0) {
            const extraMsg = erroresIncoherencia > 0 ? '\nSe detectaron ' + erroresIncoherencia + ' incoherencias de CIF/DIS.' : '';
            alert('No hay acciones que correspondan cronológicamente al T' + selectedTrimestre + ' de ' + selectedYear + '.' + extraMsg);
            return;
        }

        await saveData({ ...data, movements: [...data.movements, ...newMovements] });
        const extraMsg2 = erroresIncoherencia > 0 ? '\nSe ignoraron ' + erroresIncoherencia + ' registros por incoherencia de CIF y Código Tiendas contra la base actual.' : '';
        alert('¡Inyectadas ' + newMovements.length + ' acciones!' + extraMsg2);
    } catch (err) { alert("Error de portapapeles."); }
  };

  const handleSetCellAction = async (cif: string, mesInterno: number, action: ActionType | null) => {
      const cleanMovements = data.movements.filter(m => 
          !(m.cif === cif && m.mesInterno === mesInterno && m.year === selectedYear && m.trimestre === selectedTrimestre)
      );

      const newMovements = [...cleanMovements];

      if (action !== null) {
          const clientMatch = data.clients.find(c => c.cif === cif);
          newMovements.push({
              cif,
              codigoTiendas: clientMatch?.codigoTiendas,
              action,
              date: new Date().toISOString().split('T')[0], 
              year: selectedYear,
              trimestre: selectedTrimestre,
             mesInterno
          });
      }

      await saveData({ ...data, movements: newMovements });
      setEditingCell(null); 
  };

  const closeEditing = () => setEditingCell(null);

  const getCellAction = (cif: string, mesInterno: number) => {
      const moves = data.movements.filter(m => m.cif === cif && m.mesInterno === mesInterno);
      if (moves.length === 0) return null;
      moves.sort((a, b) => PRIORITY[b.action] - PRIORITY[a.action]);
      return moves[0].action;
  };

  const getClientMaxAction = (cif: string) => {
      const moves = data.movements.filter(m => m.cif === cif);
      if (moves.length === 0) return null;
      moves.sort((a, b) => PRIORITY[b.action] - PRIORITY[a.action]);
      return moves[0].action;
  };

  const getClientCifColor = (cif: string) => {
      const moves = data.movements.filter(m => m.cif === cif);
      if (moves.length === 0) return 'var(--text-main)';
      
      moves.sort((a, b) => {
          if (PRIORITY[b.action] !== PRIORITY[a.action]) {
              return PRIORITY[b.action] - PRIORITY[a.action];
          }
          return b.mesInterno - a.mesInterno;
      });
      
      const bestMove = moves[0];
      if (bestMove.mesInterno === 1) return '#1d4ed8'; 
      if (bestMove.mesInterno === 2) return '#047857'; 
      if (bestMove.mesInterno === 3) return '#c2410c'; 
      
      return 'var(--text-main)';
  };

  const getCellColor = (mesInterno: number, action: ActionType | null) => {
      if (!action) return 'transparent';
      if (action === 'NoCliente') return 'var(--active-bg)';
      if (mesInterno === 1) return 'rgba(59, 130, 246, 0.1)'; 
      if (mesInterno === 2) return 'rgba(16, 185, 129, 0.1)'; 
      if (mesInterno === 3) return 'rgba(249, 115, 22, 0.1)';  
      return 'transparent';
  };

  const getCellTextColor = (mesInterno: number, action: ActionType | null) => {
    if (!action) return 'var(--text-muted)'; 
    if (action === 'NoCliente') return '#4b5563';
    if (mesInterno === 1) return '#1d4ed8'; 
    if (mesInterno === 2) return '#047857'; 
    if (mesInterno === 3) return '#c2410c'; 
    return 'var(--text-muted)';
  };

  const filteredClients = data.clients.filter(c => {
      const t = searchTerm.toLowerCase();
      return c.cif.toLowerCase().includes(t) || c.empresa.toLowerCase().includes(t) || c.codigoTiendas.toLowerCase().includes(t);
  });

  const uniqueCodes = Array.from(new Set(data.clients.map(c => c.codigoTiendas).filter(Boolean)));

  const handleConfirmExport = async () => {
    console.log("=== INICIANDO EXPORTACIÓN CON FILTROS ===");
    console.log("1. C.Tiendas marcados:", exportCodes);
    console.log("2. Meses marcados:", exportMonths);
    console.log("3. Fechas:", dateFrom, "->", dateTo);
    console.log("4. Impacto máximo esperado:", exportActionFilter || 'Todos');

    const isDateInRange = (mDate: string, from: string, to: string) => {
        if (!from && !to) return true;
        let dNorm = mDate;
        if (mDate.includes('/')) {
            const p = mDate.split('/');
            dNorm = `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
        }
        if (from && dNorm < from) return false;
        if (to && dNorm > to) return false;
        return true;
    };

    const allFilteredMovements = data.movements.filter(m => 
        m.year === selectedYear && 
        m.trimestre === selectedTrimestre &&
        isDateInRange(m.date, dateFrom, dateTo)
    );

    console.log("5. Movements ANTES de filtro fechas:", data.movements.length);
    console.log("6. Movements DESPUÉS de filtro fechas:", allFilteredMovements.length);

    if (exportCodes.length === 0) {
        alert("Debes seleccionar al menos un C.Tiendas para exportar.");
        return;
    }
    
    let exportable = filteredClients.filter(c => exportCodes.includes(c.codigoTiendas));

    if (exportNoContactados) {
        exportable = exportable.filter(c => {
            return exportMonths.some(mesIdx => {
                const cMoves = allFilteredMovements.filter(m => m.cif === c.cif && m.mesInterno === mesIdx);
                return cMoves.length === 0;
            });
        });
    } else {
        exportable = exportable.filter(c => allFilteredMovements.some(m => m.cif === c.cif));
    }

    if (exportActionFilter !== '') {
        exportable = exportable.filter(c => {
            const cMoves = allFilteredMovements.filter(m => m.cif === c.cif);
            if (cMoves.length === 0) return false;
            cMoves.sort((a, b) => PRIORITY[b.action] - PRIORITY[a.action]);
            return cMoves[0].action === exportActionFilter;
        });
    }

    console.log("7. Clientes finales que entran al Excel:", exportable.length);

    try {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(`Visitas T${selectedTrimestre}`);

        const columns: any[] = [
            { header: 'Código Tiendas', key: 'codigo', width: 14 },
            { header: 'Objeto de Visita', key: 'objeto', width: 20 },
            { header: 'CIF', key: 'cif', width: 15 },
            { header: 'Nombre de la Empresa', key: 'empresa', width: 35 },
            { header: 'Dirección', key: 'direccion', width: 35 },
            { header: 'CP', key: 'cp', width: 10 },
            { header: 'Tandem', key: 'tandem', width: 15 },

        ];

        if (exportMonths.includes(1)) columns.push({ header: 'Mes 1', key: 'm1', width: 15 });
        if (exportMonths.includes(2)) columns.push({ header: 'Mes 2', key: 'm2', width: 15 });
        if (exportMonths.includes(3)) columns.push({ header: 'Mes 3', key: 'm3', width: 15 });

        sheet.columns = columns;
        
        console.log("8. Columnas finales exportadas:", columns.map(c => c.header));

        const hr = sheet.getRow(1);
        hr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
        hr.alignment = { vertical: 'middle', horizontal: 'center' };

        exportable.forEach((c, idx) => {
            const cMoves = allFilteredMovements.filter(m => m.cif === c.cif);
            
            const actM1 = cMoves.filter(m => m.mesInterno === 1).sort((a,b) => PRIORITY[b.action] - PRIORITY[a.action])[0]?.action || null;
            const actM2 = cMoves.filter(m => m.mesInterno === 2).sort((a,b) => PRIORITY[b.action] - PRIORITY[a.action])[0]?.action || null;
            const actM3 = cMoves.filter(m => m.mesInterno === 3).sort((a,b) => PRIORITY[b.action] - PRIORITY[a.action])[0]?.action || null;

            const rowData: any = {
                codigo: c.codigoTiendas,
                objeto: c.objetoVisita,
                cif: c.cif,
                empresa: c.empresa,
                direccion: c.direccion,
                cp: c.cp,
                tandem: c.tandem,

            };

            if (exportMonths.includes(1)) rowData.m1 = actM1 || '—';
            if (exportMonths.includes(2)) rowData.m2 = actM2 || '—';
            if (exportMonths.includes(3)) rowData.m3 = actM3 || '—';

            const row = sheet.addRow(rowData);

            if (idx % 2 !== 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };

            let maxM = null;
            if (cMoves.length > 0) {
                 const sortedMoves = [...cMoves].sort((a, b) => {
                     if (PRIORITY[b.action] !== PRIORITY[a.action]) return PRIORITY[b.action] - PRIORITY[a.action];
                     return b.mesInterno - a.mesInterno;
                 });
                 maxM = sortedMoves[0];
            }

            let cifColor = 'FF111827';
            if (maxM) {
                if (maxM.mesInterno === 1) cifColor = 'FF1D4ED8';
                else if (maxM.mesInterno === 2) cifColor = 'FF047857';
                else if (maxM.mesInterno === 3) cifColor = 'FFC2410C';
            }

            row.getCell('cif').font = { color: { argb: cifColor }, bold: true };

            if (exportMonths.includes(1)) {
                 const cell = row.getCell('m1');
                 cell.alignment = { horizontal: 'center' };
                 if (actM1) { cell.font = { color: { argb: 'FF1D4ED8' }, bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }; } 
                 else { cell.font = { color: { argb: 'FF9CA3AF' } }; }
            }
            if (exportMonths.includes(2)) {
                 const cell = row.getCell('m2');
                 cell.alignment = { horizontal: 'center' };
                 if (actM2) { cell.font = { color: { argb: 'FF047857' }, bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }; } 
                 else { cell.font = { color: { argb: 'FF9CA3AF' } }; }
            }
            if (exportMonths.includes(3)) {
                 const cell = row.getCell('m3');
                 cell.alignment = { horizontal: 'center' };
                 if (actM3) { cell.font = { color: { argb: 'FFC2410C' }, bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } }; } 
                 else { cell.font = { color: { argb: 'FF9CA3AF' } }; }
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Visitas_${selectedYear}_T${selectedTrimestre}_Filtros.xlsx`;
        link.click();
    } catch (err) {
        alert("Ocurrió un problema generando el archivo Excel. Revisa la consola.");
    }
  };

  const trimesters = [1, 2, 3, 4];
  const tNames = ['(Ene-Mar)', '(Abr-Jun)', '(Jul-Sep)', '(Oct-Dic)'];

  if (loading) return <div style={{ padding: 40, color: 'var(--bg-card)', textAlign: 'center' }}>Cargando datos del periodo...</div>;

  const inputStyle = { width: '100%', padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border-strong)', fontSize: 10, outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' };

  const renderClientRow = (c: ClientEntry, isNew: boolean = false) => {
      const isEditing = editingClientCif === c.cif || isNew;
      
      if (isEditing) {
          return (
              <tr key={isNew ? '__NEW__' : c.cif} style={{ backgroundColor: '#eff6ff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', position: 'relative', zIndex: 20 }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #dbeafe', minWidth: 90, maxWidth: 110 }}>
                      <input value={draftClient.codigoTiendas || ''} onChange={e => handleDraftChange('codigoTiendas', e.target.value)} style={{...inputStyle, border: '1px solid #3b82f6'}} placeholder="C.Tiendas*" autoFocus />
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #dbeafe', width: 48, minWidth: 48, maxWidth: 56, textAlign: 'center', overflow: 'hidden' }}>
                      <input value={draftClient.objetoVisita || ''} onChange={e => handleDraftChange('objetoVisita', e.target.value)} style={{...inputStyle, textAlign: 'center', padding: '4px 2px'}} placeholder="O.V." />
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #dbeafe' }}>
                      <input value={draftClient.cif || ''} onChange={e => handleDraftChange('cif', e.target.value)} style={{...inputStyle, fontWeight: 'bold', border: '1px solid #3b82f6', backgroundColor: isNew ? 'var(--bg-card)' : 'var(--active-bg)'}} readOnly={!isNew} placeholder="CIF*" title={!isNew ? "El CIF no se puede editar una vez creado. Borra y crea uno nuevo en su lugar." : ""} />
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #dbeafe', maxWidth: 180 }}>
                      <input value={draftClient.empresa || ''} onChange={e => handleDraftChange('empresa', e.target.value)} style={inputStyle} placeholder="Empresa" />
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #dbeafe', maxWidth: 140 }}>
                      <input value={draftClient.direccion || ''} onChange={e => handleDraftChange('direccion', e.target.value)} style={inputStyle} placeholder="Dirección" />
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #dbeafe', minWidth: 60, maxWidth: 80 }}>
                      <input value={draftClient.cp || ''} onChange={e => handleDraftChange('cp', e.target.value)} style={inputStyle} placeholder="CP" />
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #dbeafe', minWidth: 80, maxWidth: 90 }}>
                      <input value={draftClient.tandem || ''} onChange={e => handleDraftChange('tandem', e.target.value)} style={inputStyle} placeholder="Tandem" />
                  </td>

                  <td colSpan={3} style={{ padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid #dbeafe' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button onClick={() => saveInlineEdit(isNew)} style={{ background: '#2563eb', color: 'var(--bg-card)', padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>Guardar</button>
                          <button onClick={cancelInlineEdit} style={{ background: 'var(--bg-card)', color: '#4b5563', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-strong)', cursor: 'pointer', fontWeight: 600, fontSize: 10 }}>Cancelar</button>
                      </div>
                  </td>
              </tr>
          );
      }

      const m1 = getCellAction(c.cif, 1);
      const m2 = getCellAction(c.cif, 2);
      const m3 = getCellAction(c.cif, 3);
      
      const renderCellAct = (mes: number, currentAction: ActionType | null) => {
          const isContextEditing = editingCell?.cif === c.cif && editingCell?.mes === mes;
          return (
              <td 
                  onClick={() => canEditFlag && setEditingCell({ cif: c.cif, mes })}
                  style={{ padding: '5px 8px', textAlign: 'center', borderLeft: '1px solid var(--active-bg)', borderBottom: '1px solid var(--active-bg)', position: 'relative', cursor: canEditFlag ? 'pointer' : 'default' }}
                  onMouseEnter={(e:any) => { if (canEditFlag) e.currentTarget.style.backgroundColor = 'var(--active-bg)' }}
                  onMouseLeave={(e:any) => { if (canEditFlag) e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                  <div style={{ padding: '2px 6px', borderRadius: 4, fontWeight: currentAction ? 700 : 500, fontSize: 10, backgroundColor: getCellColor(mes, currentAction), color: getCellTextColor(mes, currentAction), width: '100%', minHeight: 16, transition: '0.1s' }}>
                      {currentAction || '—'}
                  </div>
                  {isContextEditing && (
                      <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-card)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)', padding: 6, borderRadius: 6, zIndex: 50, display: 'flex', flexDirection: 'column', gap: 2, border: '1px solid var(--border-strong)', minWidth: 100 }}>
                          <button onClick={(e) => { e.stopPropagation(); handleSetCellAction(c.cif, mes, 'Presencial') }} style={{ padding: '4px 6px', background: '#ecfdf5', color: '#047857', border: 'none', borderRadius: 4, fontWeight: 700, cursor: 'pointer', textAlign: 'left', fontSize: 9 }}>Presencial</button>
                          <button onClick={(e) => { e.stopPropagation(); handleSetCellAction(c.cif, mes, 'Teams') }} style={{ padding: '4px 6px', background: '#eff6ff', color: '#1d4ed8', border: 'none', borderRadius: 4, fontWeight: 700, cursor: 'pointer', textAlign: 'left', fontSize: 9 }}>Teams</button>
                          <button onClick={(e) => { e.stopPropagation(); handleSetCellAction(c.cif, mes, 'Teléfono') }} style={{ padding: '4px 6px', background: '#fff7ed', color: '#ea580c', border: 'none', borderRadius: 4, fontWeight: 700, cursor: 'pointer', textAlign: 'left', fontSize: 9 }}>Teléfono</button>
                          <button onClick={(e) => { e.stopPropagation(); handleSetCellAction(c.cif, mes, 'NoCliente') }} style={{ padding: '4px 6px', background: 'var(--active-bg)', color: '#4b5563', border: 'none', borderRadius: 4, fontWeight: 700, cursor: 'pointer', textAlign: 'left', fontSize: 9 }}>NoCliente</button>
                          <div style={{ borderTop: '1px solid var(--border-strong)', margin: '2px 0' }}></div>
                          <button onClick={(e) => { e.stopPropagation(); handleSetCellAction(c.cif, mes, null) }} style={{ padding: '4px 6px', background: 'var(--bg-card)', color: '#ef4444', border: 'none', borderRadius: 4, fontWeight: 700, cursor: 'pointer', textAlign: 'left', fontSize: 9 }}>🗑️ Limpiar</button>
                      </div>
                  )}
              </td>
          );
      };

      return (
          <tr 
             key={c.cif} 
             style={{ backgroundColor: 'var(--bg-card)' }} 
             onDoubleClick={() => canEditFlag && startInlineEdit(c)}
             title={canEditFlag ? "Doble clic en cualquier parte de la fila para editar el cliente" : ""}
             className="table-row-hover"
          >
              <td style={{ padding: '5px 8px', fontWeight: 600, color: 'var(--text-main)', borderBottom: '1px solid var(--active-bg)', minWidth: 90, maxWidth: 110, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.codigoTiendas}</td>
              <td style={{ padding: '5px 8px', color: '#374151', borderBottom: '1px solid var(--active-bg)', width: 48, minWidth: 48, maxWidth: 56, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.objetoVisita}</td>
              <td style={{ padding: '5px 8px', fontWeight: 700, color: getClientCifColor(c.cif), borderBottom: '1px solid var(--active-bg)', fontFamily: 'monospace' }}>{c.cif}</td>
              <td style={{ padding: '5px 8px', color: 'var(--text-main)', fontWeight: 600, borderBottom: '1px solid var(--active-bg)', maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.empresa}</td>
              <td style={{ padding: '5px 8px', color: 'var(--text-muted)', borderBottom: '1px solid var(--active-bg)', maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.direccion}</td>
              <td style={{ padding: '5px 8px', color: 'var(--text-muted)', borderBottom: '1px solid var(--active-bg)', width: 65, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.cp}</td>
              <td style={{ padding: '5px 8px', color: '#374151', borderBottom: '1px solid var(--active-bg)', width: 75, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.tandem}</td>

              {renderCellAct(1, m1)}
              {renderCellAct(2, m2)}
              {renderCellAct(3, m3)}
          </tr>
      );
  };

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', height: '100vh' }}>
      
      {editingCell && (
          <div onClick={closeEditing} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40, cursor: 'default' }} />
      )}

      {exportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card" style={{ padding: 24, background: 'var(--bg-card)', width: 550, borderRadius: 12, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 16, color: 'var(--text-main)', margin: 0, fontWeight: 700 }}>Exportador Avanzado (.xlsx)</h2>
                    <button onClick={() => setExportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: '#4b5563', marginBottom: 4, fontWeight: 600 }}>Códigos Tiendas</label>
                            <div style={{ maxHeight: 110, overflowY: 'auto', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                                   <input type="checkbox" checked={exportCodes.length === uniqueCodes.length && uniqueCodes.length > 0} onChange={() => setExportCodes(exportCodes.length === uniqueCodes.length ? [] : uniqueCodes)} /> <strong>Todos</strong>
                                </label>
                                {uniqueCodes.map(code => (
                                   <label key={code} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                                      <input type="checkbox" checked={exportCodes.includes(code)} onChange={() => setExportCodes(p => p.includes(code) ? p.filter(x=>x!==code) : [...p, code])} /> {code}
                                   </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: '#4b5563', marginBottom: 4, fontWeight: 600 }}>Exportar Meses</label>
                            <div style={{ border: '1px solid var(--border-strong)', borderRadius: 6, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={exportMonths.includes(1)} onChange={() => setExportMonths(p => p.includes(1) ? p.filter(x=>x!==1) : [...p, 1].sort())} /> Mes 1 (Azul)
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={exportMonths.includes(2)} onChange={() => setExportMonths(p => p.includes(2) ? p.filter(x=>x!==2) : [...p, 2].sort())} /> Mes 2 (Verde)
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={exportMonths.includes(3)} onChange={() => setExportMonths(p => p.includes(3) ? p.filter(x=>x!==3) : [...p, 3].sort())} /> Mes 3 (Naranja)
                                </label>
                            </div>
                            
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-strong)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={exportNoContactados}
                                        onChange={(e) => setExportNoContactados(e.target.checked)}
                                        style={{ width: 14, height: 14, accentColor: '#ef4444' }} 
                                    />
                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c' }}>Solo Clientes NO Contactados</span>
                                </label>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, marginLeft: 22, lineHeight: 1.3 }}>
                                    Extrae únicamente los clientes que estén completamente vacíos en al menos uno de los meses elegidos arriba.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 12, color: '#4b5563', marginBottom: 4, fontWeight: 600 }}>Fecha Desde</label>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 11, color: 'var(--text-main)' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 12, color: '#4b5563', marginBottom: 4, fontWeight: 600 }}>Fecha Hasta</label>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 11, color: 'var(--text-main)' }} />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 12, color: '#4b5563', marginBottom: 4, fontWeight: 600 }}>Filtrar clientes por prioridad MÁXIMA alcanzada en rango temporal</label>
                        <select value={exportActionFilter} onChange={e => setExportActionFilter(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-strong)', color: 'var(--text-main)', fontSize: 11 }}>
                            <option value="">Todos los impactos válidos</option>
                            <option value="Presencial">Impacto máximo = Presencial</option>
                            <option value="Teams">Impacto máximo = Teams</option>
                            <option value="Teléfono">Impacto máximo = Teléfono</option>
                        </select>
                    </div>
                   
                    <button onClick={handleConfirmExport} style={{ background: 'var(--text-main)', color: 'var(--bg-card)', padding: '10px', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', marginTop: 6, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center', fontSize: 12 }}>
                        <Download size={16} /> Validar y Generar XLSX de Panel
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* HEADER BAR */}
      <PageHeader 
          title={<><MapPin className="text-cyan" size={28} /> Visitas Tiendas Trimestral</>}
          subtitle="Control presencial y virtual de la cartera."
          showBack={true}
          backFallback="/back-office"
          helpContent={
            <div>
              <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Visitas Trimestrales</h4>
              <p style={{ margin: 0, lineHeight: 1.5 }}>Tracker de impacto de cartera. Registra qué clientes han sido contactados (Presencial, Teams, Teléfono) mes a mes durante el trimestre. Importante para cumplir con el indicador de penetración.</p>
            </div>
          }
      />

      <div className="card" style={{ padding: 12, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {canEditFlag && (
                      <>
                          <button 
                              onClick={startNewClient} 
                              className="btn-primary" 
                              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, height: 36 }}
                              title="Abre un formulario inline en la parte superior de la tabla para registrar manualmente un cliente nuevo. Campos obligatorios: CIF y Código Tiendas. El CIF debe ser único (no puede existir otro cliente con el mismo CIF en este trimestre). Útil para altas puntuales de 1 a 3 clientes."
                          >
                              <PlusCircle size={16} /> Nuevo Cliente
                          </button>
                          <div style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 4px' }}></div>
                      </>
                  )}
                  <span style={{ color: 'var(--light-text)', fontSize: 11, fontWeight: 600 }}>Periodo:</span>
                  <select 
                      value={selectedYear} 
                      onChange={e => setSelectedYear(Number(e.target.value))} 
                      className="form-select" 
                      style={{ padding: '0 8px', height: 36, fontSize: 13 }}
                      title="Selecciona el año del trimestre que quieres consultar o editar. Cada año tiene sus propios datos independientes."
                  >
                      {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select 
                      value={selectedTrimestre} 
                      onChange={e => setSelectedTrimestre(Number(e.target.value))} 
                      className="form-select" 
                      style={{ padding: '0 8px', height: 36, fontSize: 13 }}
                      title="Selecciona el trimestre: T1 (Ene-Mar), T2 (Abr-Jun), T3 (Jul-Sep), T4 (Oct-Dic). Los datos de cada trimestre son completamente independientes y se conservan al cambiar de trimestre."
                  >
                      {trimesters.map(t => <option key={t} value={t}>T{t} {tNames[t-1]}</option>)}
                  </select>
              </div>
          </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ position: 'relative', width: 300 }}>
                <Search size={14} color="#6b7280" style={{ position: 'absolute', left: 10, top: 8 }} />
                <input type="text" placeholder="Buscar por CIF, Empresa o C.Tiendas..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '6px 10px 6px 30px', borderRadius: 6, border: '1px solid var(--border-strong)', backgroundColor: 'var(--active-bg)', color: 'var(--text-main)', fontSize: 11 }}/>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {canEditFlag && (
                    <>
                        <button onClick={handleImportClients} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 11 }} title="⚠️ DESTRUCTIVO: Reemplaza al 100% toda la cartera del trimestre activo con los datos del portapapeles. Los clientes anteriores se pierden (pero sus visitas/acciones se conservan). Copia desde Excel las columnas: C.Tiendas | O.V. | CIF | Empresa | Dirección | CP | Tandem. Úsalo al inicio de cada trimestre para cargar la cartera completa desde cero.">
                            <TableIcon size={12} color="#0284c7" /> Pegar Base
                        </button>
                        <button onClick={handleAddClients} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid #a3e635', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 11 }} title="✅ ACUMULATIVO: Añade clientes nuevos del portapapeles a los ya existentes sin borrar ninguno. Si algún CIF del portapapeles ya existe en la base, ese registro se ignora automáticamente (no duplica). Mismo formato que Pegar Base: C.Tiendas | O.V. | CIF | Empresa | Dirección | CP | Tandem. Ideal para altas de 4 o más clientes en mitad del trimestre.">
                            <PlusCircle size={12} color="#65a30d" /> Añadir Clientes
                        </button>
                        <button onClick={handleImportActions} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 11 }} title="✅ ACUMULATIVO: Importa en bloque los registros de visitas/contactos realizados. Copia desde Excel o Salesforce las columnas: Código Tiendas | CIF | Fecha | Tipo de Acción. Solo acepta acciones cuya fecha corresponda al trimestre activo. Normaliza automáticamente: 'Visita'→Presencial, 'Teams'→Teams, resto→Teléfono. Los registros anteriores NO se borran, se suman. Úsalo mensualmente cuando tengas el reporte de actividad.">
                            <Upload size={12} color="#059669" /> Pegar Acciones (lote)
                        </button>
                    </>
                )}
                {(() => {
                  const hasExportPermission = can(user, 'EXPORT_EXCEL');
                  return (
                    <button 
                      onClick={() => { setExportCodes(uniqueCodes); setExportMonths([1, 2, 3]); setDateFrom(''); setDateTo(''); setExportActionFilter(''); setExportModal(true); }} 
                      disabled={!hasExportPermission}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', backgroundColor: 'var(--text-main)', color: 'var(--bg-card)', border: 'none', borderRadius: 6, cursor: hasExportPermission ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: 11, opacity: hasExportPermission ? 1 : 0.4 }}
                      title={!hasExportPermission ? "No tienes permisos de descarga maestra. Contacta con el administrador para que te asigne el permiso EXPORT_EXCEL." : "Abre el exportador avanzado: filtra por Código Tiendas, meses del trimestre, rango de fechas e impacto máximo alcanzado. Genera un archivo Excel (.xlsx) con la lista de clientes y sus acciones registradas. También permite exportar solo los clientes NO contactados en los meses seleccionados."}
                    >
                        <Download size={12} /> Exportar Excel
                    </button>
                  )
                })()}
            </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: '#4b5563', backgroundColor: 'var(--active-bg)', padding: '6px 10px', borderRadius: 4, width: 'fit-content' }}>
              <strong style={{ color: 'var(--text-main)', marginRight: 4 }}>Color y Autoridad Celda:</strong>
              <span style={{ color: '#059669', fontWeight: 700 }}>Presencial</span> {' > '}
              <span style={{ color: '#2563eb', fontWeight: 700 }}>Teams</span> {' > '}
              <span style={{ color: '#ea580c', fontWeight: 700 }}>Teléfono</span> {' > '}
              <span style={{ color: '#4b5563', fontWeight: 700 }}>NoCliente</span>
              <span style={{ marginLeft: 6, fontStyle: 'italic', fontWeight: 500 }}>(Clickea o Doble-Clickea cualquier fila/celda para editar)</span>
        </div>
      </div>

      <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ overflow: 'auto', flex: 1 }}>
            <table style={{ minWidth: 1000, width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 11 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--active-bg)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <tr style={{ color: '#4b5563', textTransform: 'uppercase', fontSize: 10 }}>
                        <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid var(--border-strong)', minWidth: 90, maxWidth: 110 }}>C.Tiendas</th>
                        <th style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, borderBottom: '1px solid var(--border-strong)', width: 48, minWidth: 48, maxWidth: 56, whiteSpace: 'nowrap', overflow: 'hidden' }}>O.V.</th>
                        <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid var(--border-strong)' }}>CIF</th>
                        <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid var(--border-strong)', maxWidth: 180 }}>Empresa</th>
                        <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid var(--border-strong)', maxWidth: 140 }}>Dirección</th>
                        <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid var(--border-strong)', width: 65 }}>CP</th>
                        <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid var(--border-strong)', width: 75 }}>Tandem</th>

                        <th style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, borderBottom: '1px solid var(--border-strong)', borderLeft: '1px solid var(--border-strong)', color: '#1d4ed8', backgroundColor: '#eff6ff', width: 85 }}>Mes 1</th>
                        <th style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, borderBottom: '1px solid var(--border-strong)', borderLeft: '1px solid var(--border-strong)', color: '#047857', backgroundColor: '#ecfdf5', width: 85 }}>Mes 2</th>
                        <th style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, borderBottom: '1px solid var(--border-strong)', borderLeft: '1px solid var(--border-strong)', color: '#c2410c', backgroundColor: '#fff7ed', width: 85 }}>Mes 3</th>
                    </tr>
                </thead>
                <tbody>
                    {editingClientCif === '__NEW__' && renderClientRow({} as ClientEntry, true)}

                    {filteredClients.length === 0 && editingClientCif !== '__NEW__' ? (
                        <tr>
                            <td colSpan={12} style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                {searchTerm !== '' ? 'No hay resultados para tu búsqueda.' : 'La base trimestral está vacía. Crea un cliente o Pega una base.'}
                            </td>
                        </tr>
                    ) : (
                        filteredClients.map(c => renderClientRow(c, false))
                    )}
                </tbody>
            </table>
          </div>
      </div>
    </div>
  )
}
