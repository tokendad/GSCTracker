const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function captureScreenshots() {
  const browser = await chromium.launch();
  const screenshotsDir = path.join(__dirname, '../../screenshots');
  
  // Ensure screenshots directory exists
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {
    // Desktop view with empty state
    const desktopPage = await browser.newPage({
      viewport: { width: 1280, height: 720 }
    });
    await desktopPage.goto('http://localhost:3000');
    await desktopPage.waitForLoadState('networkidle');
    await desktopPage.screenshot({
      path: path.join(screenshotsDir, 'desktop-empty-state.png'),
      fullPage: true
    });

    // Add sample data
    await desktopPage.selectOption('select#cookieType', 'Thin Mints');
    await desktopPage.fill('input#quantity', '5');
    await desktopPage.fill('input#customerName', 'Mrs. Johnson');
    await desktopPage.click('button[type="submit"]');
    await desktopPage.waitForTimeout(1000);

    await desktopPage.selectOption('select#cookieType', 'Samoas/Caramel deLites');
    await desktopPage.fill('input#quantity', '3');
    await desktopPage.fill('input#customerName', 'Mr. Smith');
    await desktopPage.click('button[type="submit"]');
    await desktopPage.waitForTimeout(1000);

    await desktopPage.selectOption('select#cookieType', 'Exploremores');
    await desktopPage.fill('input#quantity', '2');
    await desktopPage.fill('input#customerName', 'Ms. Davis');
    await desktopPage.click('button[type="submit"]');
    await desktopPage.waitForTimeout(1000);

    // Desktop view with data
    await desktopPage.screenshot({
      path: path.join(screenshotsDir, 'desktop-with-data.png'),
      fullPage: true
    });
    await desktopPage.close();

    // Mobile view
    const mobilePage = await browser.newPage({
      viewport: { width: 375, height: 667 }
    });
    await mobilePage.goto('http://localhost:3000');
    await mobilePage.waitForLoadState('networkidle');

    // Add sample data for mobile view
    await mobilePage.selectOption('select#cookieType', 'Thin Mints');
    await mobilePage.fill('input#quantity', '5');
    await mobilePage.fill('input#customerName', 'Mrs. Johnson');
    await mobilePage.click('button[type="submit"]');
    await mobilePage.waitForTimeout(1000);

    await mobilePage.selectOption('select#cookieType', 'Samoas/Caramel deLites');
    await mobilePage.fill('input#quantity', '3');
    await mobilePage.fill('input#customerName', 'Mr. Smith');
    await mobilePage.click('button[type="submit"]');
    await mobilePage.waitForTimeout(1000);

    await mobilePage.selectOption('select#cookieType', 'Exploremores');
    await mobilePage.fill('input#quantity', '2');
    await mobilePage.fill('input#customerName', 'Ms. Davis');
    await mobilePage.click('button[type="submit"]');
    await mobilePage.waitForTimeout(1000);

    await mobilePage.screenshot({
      path: path.join(screenshotsDir, 'mobile-view.png'),
      fullPage: true
    });
    await mobilePage.close();

    console.log('Screenshots captured successfully!');
  } catch (error) {
    console.error('Error capturing screenshots:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

captureScreenshots();
