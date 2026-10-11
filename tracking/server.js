/* ============================================================
   server.js — เซิร์ฟเวอร์เช็กอินตำแหน่งทีม (รันบน local ของแอดมิน)
   ใช้เฉพาะโมดูลในตัวของ Node.js — ไม่ต้อง npm install อะไรเลย

   วิธีรัน:
     node server.js
   แล้วเปิด:
     แอดมิน  ->  http://localhost:3000/admin.html
     ทดสอบ   ->  http://localhost:3000/          (หน้า User)

   ข้อมูลถูกเก็บลงไฟล์ checkins.json ข้าง ๆ ไฟล์นี้
   ============================================================ */
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT      = process.env.PORT || 3000;   // hosting จะกำหนด PORT ให้เองผ่าน env
const DATA_FILE = path.join(__dirname, 'checkins.json');
const ROOT      = __dirname;

/* ---------- อ่าน/เขียนไฟล์ข้อมูล ---------- */
function readData(){
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch(e){ return []; }
}
function writeData(list){
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

/* ---------- หา IP ของผู้ใช้ ---------- */
function clientIP(req){
  // ถ้าผ่าน tunnel/proxy (เช่น ngrok) IP จริงจะอยู่ใน x-forwarded-for
  const fwd = req.headers['x-forwarded-for'];
  let ip = fwd ? fwd.split(',')[0].trim() : req.socket.remoteAddress || '';
  // ตัด prefix IPv6-mapped ออก เช่น ::ffff:1.2.3.4
  ip = ip.replace(/^::ffff:/, '');
  if (ip === '::1') ip = '127.0.0.1 (localhost)';
  return ip || 'ไม่ทราบ';
}

/* ---------- ภูมิภาคของโลกจากพิกัด ---------- */
function worldRegion(lat, lng){
  if (lat >= 35 && lat <= 72 && lng >= -25 && lng <= 45)  return 'ยุโรป';
  if (lat >= -11&& lat <= 6  && lng >= 95  && lng <= 141) return 'เอเชียตะวันออกเฉียงใต้';
  if (lat >= 5  && lat <= 55 && lng >= 60  && lng <= 150) return 'เอเชีย';
  if (lat >= -50&& lat <= 37 && lng >= -20 && lng <= 52)  return 'แอฟริกา';
  if (lat >= 15 && lat <= 72 && lng >= -170&& lng <= -50) return 'อเมริกาเหนือ';
  if (lat >= -56&& lat <= 15 && lng >= -82 && lng <= -34) return 'อเมริกาใต้';
  if (lat >= -48&& lat <= -10&& lng >= 110 && lng <= 180) return 'โอเชียเนีย';
  if (lat < -60) return 'แอนตาร์กติกา';
  return 'อื่น ๆ';
}

/* ---------- static file types ---------- */
const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon',
};

/* ---------- เซิร์ฟเวอร์ ---------- */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  // ===== API: รับเช็กอิน =====
  if (req.method === 'POST' && pathname === '/api/checkin'){
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try {
        const d = JSON.parse(body || '{}');
        const lat = Number(d.lat), lng = Number(d.lng);
        if (!isFinite(lat) || !isFinite(lng)) throw new Error('พิกัดไม่ถูกต้อง');
        const record = {
          id:   Date.now() + '-' + Math.random().toString(36).slice(2,7),
          name: String(d.name || 'ไม่ระบุชื่อ').slice(0,80),
          ip:   clientIP(req),
          lat, lng,
          acc:  Math.round(Number(d.acc) || 0),
          region: worldRegion(lat, lng),
          ts:   new Date().toISOString(),
        };
        const list = readData();
        list.unshift(record);
        writeData(list);
        json(res, 200, { ok:true, record });
      } catch(e){
        json(res, 400, { ok:false, error: e.message });
      }
    });
    return;
  }

  // ===== API: ดึงรายการทั้งหมด =====
  if (req.method === 'GET' && pathname === '/api/checkins'){
    return json(res, 200, readData());
  }

  // ===== API: ล้างข้อมูล =====
  if (req.method === 'POST' && pathname === '/api/clear'){
    writeData([]);
    return json(res, 200, { ok:true });
  }

  // ===== static files =====
  let rel = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(ROOT, path.normalize(rel));
  // กันไม่ให้ออกนอกโฟลเดอร์
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(filePath, (err, data) => {
    if (err){ res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); return res.end('ไม่พบไฟล์: ' + rel); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

function json(res, code, obj){
  res.writeHead(code, { 'Content-Type':'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('==================================================');
  console.log('  เซิร์ฟเวอร์เช็กอินทำงานแล้ว');
  console.log('  แอดมิน :  http://localhost:' + PORT + '/admin.html');
  console.log('  User   :  http://localhost:' + PORT + '/');
  console.log('  ข้อมูล :  ' + DATA_FILE);
  console.log('==================================================');
});
