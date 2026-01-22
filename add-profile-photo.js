const Database = require('better-sqlite3');
const path = require('path');
const https = require('https');
const fs = require('fs');

const DB_PATH = path.join('/data', 'gsctracker.db');
const db = new Database(DB_PATH);

// Using a publicly available Taylor Swift image
const imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/191125_Taylor_Swift_at_the_2019_American_Music_Awards_%28cropped%29.png/330px-191125_Taylor_Swift_at_the_2019_American_Music_Awards_%28cropped%29.png';

console.log('Downloading Taylor Swift photo...');

https.get(imageUrl, (response) => {
    const chunks = [];

    response.on('data', (chunk) => {
        chunks.push(chunk);
    });

    response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const base64Image = `data:image/png;base64,${buffer.toString('base64')}`;

        console.log('Photo downloaded, updating profile...');

        // Update profile with photo data
        db.prepare(`
            UPDATE profile
            SET photoData = ?
            WHERE id = 1
        `).run(base64Image);

        console.log('✅ Profile photo added successfully!');
        console.log(`   Photo size: ${Math.round(buffer.length / 1024)}KB`);

        db.close();
    });
}).on('error', (err) => {
    console.error('Error downloading image:', err);
    db.close();
    process.exit(1);
});
