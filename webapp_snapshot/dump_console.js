const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  await page.goto('http://localhost:3000/cristina-admin/gastos', { waitUntil: 'networkidle2' });
  
  // click the tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const compBtn = btns.find(b => b.innerText.includes('Comparativa Histórica'));
    if (compBtn) compBtn.click();
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
