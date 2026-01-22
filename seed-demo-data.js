const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join('/data', 'gsctracker.db');
const db = new Database(DB_PATH);

// Create tables if they don't exist
console.log('Creating database tables...');
db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cookieType TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        customerName TEXT NOT NULL,
        date TEXT NOT NULL,
        saleType TEXT DEFAULT 'individual',
        customerAddress TEXT,
        customerPhone TEXT,
        unitType TEXT DEFAULT 'box',
        amountCollected REAL DEFAULT 0,
        amountDue REAL DEFAULT 0,
        paymentMethod TEXT,
        orderNumber TEXT,
        orderType TEXT,
        orderStatus TEXT,
        customerEmail TEXT
    );

    CREATE TABLE IF NOT EXISTS profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        photoData TEXT,
        qrCodeUrl TEXT,
        goalBoxes INTEGER DEFAULT 0,
        goalAmount REAL DEFAULT 0,
        paymentQrCodeUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS donations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        donorName TEXT NOT NULL,
        date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eventName TEXT NOT NULL,
        eventDate TEXT NOT NULL,
        description TEXT,
        initialBoxes INTEGER DEFAULT 0,
        initialCases INTEGER DEFAULT 0,
        remainingBoxes INTEGER DEFAULT 0,
        remainingCases INTEGER DEFAULT 0,
        donationsReceived REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        isEnabled INTEGER DEFAULT 1
    );
`);

// Cookie types
const cookieTypes = [
    'Thin Mints',
    'Samoas',
    'Tagalongs',
    'Trefoils',
    'Do-si-dos',
    'Lemon-Ups',
    'Adventurefuls',
    'Exploremores'
];

// Customer names
const customerNames = [
    'Sarah Johnson',
    'Michael Chen',
    'Emily Rodriguez',
    'David Kim',
    'Jessica Williams',
    'Christopher Brown',
    'Amanda Martinez',
    'Matthew Davis',
    'Ashley Garcia',
    'James Wilson',
    'Jennifer Lee',
    'Robert Taylor',
    'Michelle Anderson',
    'Daniel Thomas',
    'Laura Jackson',
    'Kevin White',
    'Nicole Harris',
    'Brian Clark',
    'Samantha Lewis',
    'Andrew Walker'
];

// Payment methods
const paymentMethods = ['Cash', 'Venmo', 'Zelle', 'Check', 'PayPal'];

// Order statuses
const orderStatuses = ['Pending', 'Delivered'];

// Generate random date within the last 30 days
function getRandomDate(daysAgo = 30) {
    const now = new Date();
    const past = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const randomTime = past.getTime() + Math.random() * (now.getTime() - past.getTime());
    return new Date(randomTime).toISOString().split('T')[0];
}

// Generate random phone number
function getRandomPhone() {
    const area = Math.floor(Math.random() * 900) + 100;
    const prefix = Math.floor(Math.random() * 900) + 100;
    const line = Math.floor(Math.random() * 9000) + 1000;
    return `(${area}) ${prefix}-${line}`;
}

// Generate random address
function getRandomAddress() {
    const streetNum = Math.floor(Math.random() * 9000) + 1000;
    const streets = ['Main St', 'Oak Ave', 'Maple Dr', 'Pine Rd', 'Elm Way', 'Cedar Ln', 'Birch Ct', 'Willow Pl'];
    const cities = ['Springfield', 'Riverside', 'Greenville', 'Franklin', 'Clinton'];
    const states = ['IL', 'CA', 'TX', 'NY', 'FL'];

    const street = streets[Math.floor(Math.random() * streets.length)];
    const city = cities[Math.floor(Math.random() * cities.length)];
    const state = states[Math.floor(Math.random() * states.length)];
    const zip = Math.floor(Math.random() * 90000) + 10000;

    return `${streetNum} ${street}, ${city}, ${state} ${zip}`;
}

// Clear existing data
console.log('Clearing existing demo data...');
db.exec('DELETE FROM sales');
db.exec('DELETE FROM events');
db.exec('DELETE FROM donations');
db.exec('DELETE FROM profile WHERE id = 1');

// Create sales data
console.log('Creating sales data...');
const insertSale = db.prepare(`
    INSERT INTO sales (
        cookieType, quantity, customerName, date, saleType,
        customerAddress, customerPhone, unitType, amountCollected,
        amountDue, paymentMethod, orderNumber, orderType, orderStatus, customerEmail
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let orderCounter = 1000;

// Generate 25 sales with mixed variety
for (let i = 0; i < 25; i++) {
    const customerName = customerNames[i % customerNames.length];
    const cookieType = cookieTypes[Math.floor(Math.random() * cookieTypes.length)];
    const quantity = Math.floor(Math.random() * 10) + 1; // 1-10 boxes
    const date = getRandomDate(30);
    const saleType = 'individual';
    const customerAddress = getRandomAddress();
    const customerPhone = getRandomPhone();
    const unitType = 'box';
    const orderTotal = quantity * 6; // $6 per box

    // Randomly determine if order is paid, partially paid, or unpaid
    const paymentStatus = Math.random();
    let amountCollected, amountDue;

    if (paymentStatus < 0.5) {
        // Fully paid (50%)
        amountCollected = orderTotal;
        amountDue = 0;
    } else if (paymentStatus < 0.75) {
        // Partially paid (25%)
        amountCollected = Math.floor(orderTotal * 0.5);
        amountDue = orderTotal - amountCollected;
    } else {
        // Unpaid (25%)
        amountCollected = 0;
        amountDue = orderTotal;
    }

    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    const orderNumber = `ORD-${orderCounter++}`;
    const orderType = Math.random() > 0.5 ? 'Manual' : 'In-Person';

    // Orders with full payment are more likely to be delivered
    let orderStatus;
    if (amountCollected === orderTotal && Math.random() > 0.3) {
        orderStatus = 'Delivered';
    } else if (amountCollected < orderTotal && Math.random() > 0.8) {
        orderStatus = 'Delivered'; // Some delivered with outstanding balance (for testing)
    } else {
        orderStatus = 'Pending';
    }

    const email = customerName.toLowerCase().replace(' ', '.') + '@email.com';

    insertSale.run(
        cookieType, quantity, customerName, date, saleType,
        customerAddress, customerPhone, unitType, amountCollected,
        amountDue, paymentMethod, orderNumber, orderType, orderStatus, email
    );

    console.log(`Added sale: ${customerName} - ${quantity} boxes of ${cookieType} - Status: ${orderStatus}`);
}

// Create events data
console.log('\nCreating events data...');
const insertEvent = db.prepare(`
    INSERT INTO events (
        eventName, eventDate, description, initialBoxes, initialCases,
        remainingBoxes, remainingCases, donationsReceived
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const events = [
    {
        eventName: 'Spring Community Fair',
        eventDate: '2025-03-15',
        description: 'Annual spring fair at the community center with vendor booths and activities',
        initialBoxes: 120,
        initialCases: 10,
        remainingBoxes: 0,
        remainingCases: 0,
        donationsReceived: 245.50,
        isComplete: true
    },
    {
        eventName: 'Summer Farmers Market',
        eventDate: '2025-06-20',
        description: 'Weekly farmers market booth downtown',
        initialBoxes: 80,
        initialCases: 6,
        remainingBoxes: 28,
        remainingCases: 2,
        donationsReceived: 115.00,
        isComplete: false
    },
    {
        eventName: 'School Fundraiser Night',
        eventDate: '2025-04-10',
        description: 'Cookie booth at the local elementary school fundraiser event',
        initialBoxes: 60,
        initialCases: 5,
        remainingBoxes: 15,
        remainingCases: 1,
        donationsReceived: 82.25,
        isComplete: false
    },
    {
        eventName: 'Library Book Sale',
        eventDate: '2025-05-05',
        description: 'Cookie sales during the annual library book sale',
        initialBoxes: 45,
        initialCases: 3,
        remainingBoxes: 12,
        remainingCases: 1,
        donationsReceived: 50.00,
        isComplete: false
    }
];

events.forEach(event => {
    insertEvent.run(
        event.eventName,
        event.eventDate,
        event.description,
        event.initialBoxes,
        event.initialCases,
        event.remainingBoxes,
        event.remainingCases,
        event.donationsReceived
    );
    console.log(`Added event: ${event.eventName} - ${event.isComplete ? 'COMPLETED' : 'ACTIVE'}`);
});

// Set profile data (without photo for now, we'll add that separately)
console.log('\nSetting profile data...');
db.prepare(`
    INSERT OR REPLACE INTO profile (id, goalBoxes, goalAmount)
    VALUES (1, 500, 3000)
`).run();

console.log('\n✅ Demo data seeded successfully!');
console.log(`   - Created ${db.prepare('SELECT COUNT(*) as count FROM sales').get().count} sales`);
console.log(`   - Created ${db.prepare('SELECT COUNT(*) as count FROM events').get().count} events`);
console.log(`   - Set goal: 500 boxes / $3000`);

db.close();
