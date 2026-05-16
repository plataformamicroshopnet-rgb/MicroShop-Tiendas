const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./prisma/database.sqlite');
const fs = require('fs');

db.all("SELECT * FROM Sale", (err, sales) => {
    if (err) return console.error(err);
    
    // Emulate the logic
    const STORE_NAMES = ["Auxiliadora 45", "Correhuela", "Villamayor", "Béjar", "O2"];
    const TIENDAS_COMERCIALES = {
        "Auxiliadora 45": ["Cristina", "Elena", "Gabriel"],
        "Correhuela": ["Carmen"],
        "Villamayor": ["Carlos", "Nuria"],
        "Béjar": ["Vanesa", "Lara"],
        "O2": ["Marta"]
    };

    const isPending = (sale) => {
        return sale.pendiente === 'Sí' || sale.pendiente === 'Pendiente';
    };
    
    const isValidSale = (sale) => {
        return sale.anulado !== 'Si' && sale.anulado !== 'Sí' && sale.pendiente !== 'Anulado';
    };

    const result = {};

    STORE_NAMES.forEach(store => {
        const sellers = TIENDAS_COMERCIALES[store] || [];
        const storeSales = sales.filter(s => isValidSale(s) && sellers.includes(s.vendedor));

        const row = {
            store,
            pers: sellers.length,
            altasTotales: storeSales.length,
            bafNoTrasl_vent: 0,
            bafNoTrasl_tram: 0,
            bafConvMS_vent: 0,
            bafConvMS_tram: 0
        };

        storeSales.forEach(sale => {
            const pending = isPending(sale);
            const p = sale.producto?.toLowerCase() || '';

            if (store === 'O2') {
                if (p.includes('fibra') && !p.includes('interna')) {
                    row.bafNoTrasl_vent++;
                    if (pending) row.bafNoTrasl_tram++;
                } else if (p.includes('interna')) {
                    row.bafConvMS_vent++;
                    if (pending) row.bafConvMS_tram++;
                }
            } else {
                if (p.includes('alta') && p.includes('baf') || p.includes('mimovistar')) {
                    row.bafNoTrasl_vent++;
                    if (pending) row.bafNoTrasl_tram++;
                }
            }
        });

        result[store] = row;
    });
    
    console.log(result);
});
