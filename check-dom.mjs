import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 5000 });
    
    // wait 3 seconds
    await new Promise(r => setTimeout(r, 3000));
    
    const bodyHtml = await page.evaluate(() => document.body.innerHTML.substring(0, 500));
    console.log("BODY HTML START:");
    console.log(bodyHtml);
    
    const rootNodes = await page.evaluate(() => Array.from(document.body.children).map(n => n.tagName + ' (id: ' + n.id + ', class: ' + n.className + ')'));
    console.log("ROOT NODES:", rootNodes);
    
    await browser.close();
  } catch (err) {
    console.error("Error:", err);
  }
})();
