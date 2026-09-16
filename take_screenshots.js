import puppeteer from 'puppeteer';

(async () => {
  try {
    const targetUrl = process.argv[2];
    if (!targetUrl) {
      console.error("Please provide the inspector URL as a command-line argument.");
      process.exit(1);
    }

    const browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });

    console.log("Taking screenshot of initial UI...");
    await page.screenshot({ path: 'inspector_initial.png' });

    // Try to interact with the UI. The inspector usually has a list of tools.
    // Wait for the tool list to appear.
    // Assuming Inspector UI has some tool buttons.
    try {
      await page.waitForSelector('button, .tool-list, input', { timeout: 5000 });
      console.log("Found UI elements, taking screenshot...");
      await page.screenshot({ path: 'inspector_tools.png' });
    } catch (e) {
      console.log("Timeout waiting for tools. The UI might be different.");
    }

    console.log("Screenshots saved.");
    await browser.close();
  } catch (error) {
    console.error("Puppeteer error:", error);
    process.exit(1);
  }
})();
