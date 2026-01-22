const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join('/data', 'gsctracker.db');
const db = new Database(DB_PATH);

const imagePath = '/tmp/taylor-swift.png';

console.log('Reading Taylor Swift photo from file...');

const buffer = fs.readFileSync(imagePath);
const base64Image = `data:image/png;base64,${buffer.toString('base64')}`;

console.log('Photo read, updating profile...');

// Update profile with photo data
db.prepare(`
    UPDATE profile
    SET photoData = ?
    WHERE id = 1
`).run(base64Image);

console.log('✅ Profile photo added successfully!');
console.log(`   Photo size: ${Math.round(buffer.length / 1024)}KB`);
console.log(`   Base64 length: ${base64Image.length} characters`);

db.close();
