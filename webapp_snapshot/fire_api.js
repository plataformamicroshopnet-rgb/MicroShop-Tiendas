async function run() {
    const payload = {
        catalogs: {
            "TMA": [
                {
                    "producto": "Test",
                    "mensual": "5",
                    "anual": "120",
                    "validFrom": "01/04/2026",
                    "validTo": null
                }
            ]
        }
    };
    try {
        const res = await fetch("http://localhost:3000/api/catalogs", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log("SERVER RESPONSE:", data);
    } catch(e) {
        console.log("FETCH ERROR:", e);
    }
}
run();
