import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 10000 });
    
    const screenshotPath = '/home/chris/.gemini/antigravity-ide/brain/1292a7bb-6f64-43ce-8de4-c6d6520fc9a2/artifacts/screenshot.jpg';
    await page.screenshot({ path: screenshotPath, type: 'jpeg' });
    
    console.log(`Screenshot saved to ${screenshotPath}`);
    await browser.close();
  } catch (err) {
    console.error("Error:", err);
  }
})();
