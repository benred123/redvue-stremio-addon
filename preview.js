// Optional local preview: node preview.js
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, 'docs');
const mime = {'.json':'application/json; charset=utf-8','.html':'text/html; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const body = fs.readFileSync(file);
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'});res.end(body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(7107, '127.0.0.1', ()=>console.log('REDVUE preview: http://127.0.0.1:7107/manifest.json'));
