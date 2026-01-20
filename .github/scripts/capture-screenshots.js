const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function captureScreenshots() {
  const browser = await chromium.launch();
  const screenshotsDir = path.join(__dirname, '../../screenshots');
  let currentStep = 'initialization';
  
  // Ensure screenshots directory exists
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {
    // Mobile view - Profile tab (default/empty state)
    currentStep = 'capturing mobile profile tab';
    const mobilePage = await browser.newPage({
      viewport: { width: 375, height: 667 }
    });
    await mobilePage.goto('http://localhost:3000');
    await mobilePage.waitForLoadState('networkidle');
    await mobilePage.screenshot({
      path: path.join(screenshotsDir, 'mobile-profile.png'),
      fullPage: true
    });

    // Mobile view - Summary tab
    currentStep = 'capturing mobile summary tab';
    await mobilePage.click('button[data-view="dashboard"]');
    await mobilePage.waitForTimeout(500);
    await mobilePage.screenshot({
      path: path.join(screenshotsDir, 'mobile-summary.png'),
      fullPage: true
    });

    // Mobile view - Individual sales tab
    currentStep = 'capturing mobile individual sales tab';
    await mobilePage.click('button[data-view="sales"]');
    await mobilePage.waitForTimeout(500);
    await mobilePage.screenshot({
      path: path.join(screenshotsDir, 'mobile-individual-sales.png'),
      fullPage: true
    });

    // Mobile view - Events tab
    currentStep = 'capturing mobile events tab';
    await mobilePage.click('button[data-view="events"]');
    await mobilePage.waitForTimeout(500);
    await mobilePage.screenshot({
      path: path.join(screenshotsDir, 'mobile-events.png'),
      fullPage: true
    });

    // Mobile view - Settings tab
    currentStep = 'capturing mobile settings tab';
    await mobilePage.click('button[data-view="settings"]');
    await mobilePage.waitForTimeout(500);
    await mobilePage.screenshot({
      path: path.join(screenshotsDir, 'mobile-settings.png'),
      fullPage: true
    });

    await mobilePage.close();

    console.log('Screenshots captured successfully!');
  } catch (error) {
    console.error(`Error during ${currentStep}:`, error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

captureScreenshots();
