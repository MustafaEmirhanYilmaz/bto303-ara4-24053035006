// server/server.js
// Ultra-fast zero-dependency Native Node.js HTTP server for BTÖ-303 Ara Uygulama 4
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const analytics = require('./analytics.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: true, message });
}

function sendCsv(res, filename, csvString) {
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Access-Control-Allow-Origin': '*'
  });
  res.end('\uFEFF' + csvString); // UTF-8 BOM for Excel compatibility
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) { // 1MB limit
        reject(new Error('İstek gövdesi çok büyük.'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Geçersiz JSON formatı.'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  try {
    // API Routes
    if (pathname.startsWith('/api/')) {
      if (method === 'GET') {
        if (pathname === '/api/overview') {
          return sendJson(res, 200, analytics.getOverview());
        }
        if (pathname === '/api/categories') {
          return sendJson(res, 200, analytics.getCategories());
        }
        if (pathname === '/api/products') {
          return sendJson(res, 200, analytics.getProducts());
        }
        if (pathname === '/api/customers') {
          return sendJson(res, 200, analytics.getCustomersAndGeo());
        }
        if (pathname === '/api/funnel') {
          return sendJson(res, 200, analytics.getFunnel());
        }
        if (pathname === '/api/logistics') {
          return sendJson(res, 200, analytics.getLogistics());
        }
        if (pathname === '/api/coupons') {
          return sendJson(res, 200, analytics.getCoupons());
        }
        if (pathname.startsWith('/api/export/')) {
          const type = pathname.replace('/api/export/', '');
          if (type === 'categories') {
            const data = analytics.getCategories().mainCategories;
            const headers = Object.keys(data[0] || {}).join(',');
            const rows = data.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
            return sendCsv(res, 'ana_kategoriler_ciro.csv', `${headers}\n${rows}`);
          }
          if (type === 'cities') {
            const data = analytics.getCustomersAndGeo().cityStats;
            const headers = Object.keys(data[0] || {}).join(',');
            const rows = data.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
            return sendCsv(res, 'il_bazli_siparis_ciro.csv', `${headers}\n${rows}`);
          }
          if (type === 'products') {
            const data = analytics.getProducts().topByRevenue;
            const headers = Object.keys(data[0] || {}).join(',');
            const rows = data.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
            return sendCsv(res, 'en_cok_satan_urunler.csv', `${headers}\n${rows}`);
          }
          return sendError(res, 404, 'Dışa aktarma tipi bulunamadı.');
        }
      }

      if (method === 'POST' && pathname === '/api/query') {
        const body = await parseBody(req);
        if (!body.sql) {
          return sendError(res, 400, 'Lütfen bir SQL sorgusu belirtin.');
        }
        try {
          const result = analytics.runCustomQuery(body.sql);
          return sendJson(res, 200, result);
        } catch (queryErr) {
          return sendError(res, 400, queryErr.message);
        }
      }

      return sendError(res, 404, 'API rotası bulunamadı.');
    }

    // Static File Serving
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '') {
      safePath = '/index.html';
    }

    const filePath = path.join(PUBLIC_DIR, safePath);

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Fallback to index.html for SPA routing
        const fallbackPath = path.join(PUBLIC_DIR, 'index.html');
        fs.readFile(fallbackPath, (readErr, content) => {
          if (readErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 - Sayfa Bulunamadı');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(content);
          }
        });
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Sunucu dosya okuma hatası.');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      });
    });
  } catch (serverErr) {
    console.error('Sunucu Hatası:', serverErr);
    sendError(res, 500, 'Sunucu tarafında beklenmeyen bir hata oluştu: ' + serverErr.message);
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`BTÖ-303 Ara Uygulama 4: E-Ticaret Analitik Paneli`);
  console.log(`Sunucu aktif: http://localhost:${PORT}`);
  console.log(`Veritabanı: eticaret.sqlite (Bağlandı)`);
  console.log(`====================================================`);
});
