async function main() {
  const res = await fetch('http://localhost:3000/api/catalogs?periodKey=2026_05&strictPeriod=1');
  const data = await res.json();
  if (data.success) {
    for (const cat in data.catalogs) {
      console.log(cat, data.catalogs[cat].length);
    }
  } else {
    console.log(data);
  }
}
main();
