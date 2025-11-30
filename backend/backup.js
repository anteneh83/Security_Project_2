/**
 * Simple backup script using mongodump (MongoDB tools required).
 * Produces a timestamped dump in BACKUP_DIR and optionally encrypts it.
 * On Windows, ensure mongodump is in PATH.
 */
require('dotenv').config();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { encrypt } = require('./src/utils/crypto');

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const MONGO_URI = process.env.MONGO_URI;

async function run() {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outDir = path.join(BACKUP_DIR, `dump-${stamp}`);
    const cmd = `mongodump --uri="${MONGO_URI}" --out="${outDir}"`;
    console.log('Running:', cmd);
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.error('mongodump failed', err, stderr);
        process.exit(1);
      }
      console.log('mongodump finished:', stdout);
      // Simple encryption of metadata file
      const meta = { createdAt: new Date(), path: outDir };
      const encrypted = encrypt(JSON.stringify(meta));
      fs.writeFileSync(path.join(outDir, 'backup.meta.enc'), encrypted);
      console.log('Backup stored at', outDir);
      process.exit(0);
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
