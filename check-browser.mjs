import puppeteer from 'puppeteer';

(async () => {
  console.log("Launching browser...");
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log("Browser launched");
    const page = await browser.newPage();
    
    page.on('console', msg => console.log(`[CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`));
    page.on('pageerror', err => console.log(`[PAGE_ERROR] ${err.message}`));
    page.on('requestfailed', request => console.log(`[REQUEST_FAILED] ${request.url()} - ${request.failure()?.errorText}`));
    
    console.log("Navigating...");
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 5000 });
    
    // wait 2 seconds for react to render
    await new Promise(r => setTimeout(r, 2000));
    
    const content = await page.content();
    console.log(`Body length: ${content.length}`);
    
    await browser.close();
  } catch (err) {
    console.error("Error:", err);
  }
})();
