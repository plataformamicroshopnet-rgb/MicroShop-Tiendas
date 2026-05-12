const fetch = require('node-fetch');

async function testPut() {
    // First, fetch products to get a valid ID
    const res = await fetch('http://localhost:3000/api/movilfree/products');
    const products = await res.json();
    if(products.length === 0) { console.log('No products'); return; }
    
    const p = products[0];
    console.log('Testing PUT on', p.id);
    
    const putRes = await fetch('http://localhost:3000/api/movilfree/products/' + p.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...p,
            stock: p.stock + 1
        })
    });
    
    const putData = await putRes.json();
    console.log('Result:', putRes.status, putData);
}

testPut();
