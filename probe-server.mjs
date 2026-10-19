// Přijímá hlášení z testovacího modu mods/probe.js a vypisuje je.
import http from 'node:http';

http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    console.log(new Date().toISOString(), body);
    res.end('ok');
  });
}).listen(9334, '127.0.0.1', () => console.log('čekám na hlášení na http://127.0.0.1:9334'));
