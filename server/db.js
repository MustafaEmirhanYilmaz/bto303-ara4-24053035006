// server/db.js
// Native SQLite connection for BTÖ-303 Ara Uygulama 4 using node:sqlite
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const DB_PATH = path.join(__dirname, '..', 'data', 'eticaret.sqlite');

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    // Optimize performance for analytical queries
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    dbInstance.exec('PRAGMA synchronous = NORMAL;');
    dbInstance.exec('PRAGMA cache_size = -64000;'); // 64MB cache
  }
  return dbInstance;
}

module.exports = {
  getDb,
  DB_PATH
};
