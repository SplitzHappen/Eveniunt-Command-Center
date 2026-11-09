'use strict';
// Gate 1A prototype: a plain static server for site/, like GitHub Pages: it sends NO cross-origin isolation
// headers, so any isolation comes from the service workers, as on the real site. It answers on every host name,
// so http://localhost:PORT and http://127.0.0.1:PORT are two origins served by one server (the "Google" stand-in
// is reached under the other name). The two app icons are drawn here, so the folder holds no binary files.
// Usage: node serve.js [port]   (default 8417)
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, 'site');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' };

// a solid square PNG (one colour), enough for the browser to accept the app as installable
function png(size) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(size).fill([0x0f, 0x22, 0x34]).flat())]);
  const raw = Buffer.concat(Array(size).fill(row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const ICONS = { '/icon-192.png': png(192), '/icon-512.png': png(512) };

function start(port) {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (ICONS[p]) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(ICONS[p]); }
    let file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
module.exports = { start };
if (require.main === module) {
  const port = Number(process.argv[2]) || 8417;
  start(port).then(() => console.log('serving ' + ROOT + ' on http://localhost:' + port + '/ and http://127.0.0.1:' + port + '/'));
}
