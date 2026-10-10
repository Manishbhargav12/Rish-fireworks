// Edit products.csv (Excel / Google Sheets), then run:  node build-catalog.js
// It rewrites the product list inside index.html and api/_prices.json (server-side prices).
const fs = require('fs');
const csv = fs.readFileSync(__dirname + '/products.csv', 'utf8').replace(/^\uFEFF/, '');

function parse(text) {                      // small RFC-4180 CSV parser
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const [head, ...body] = parse(csv).filter(r => r.length > 1);
const items = body.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || '').trim()])));

const products = items.map(r => {
  const p = { id: +r.id, name: r.name, cat: r.category, brand: r.brand || 'Other', pack: r.pack || '',
              price: +r.price, mrp: +r.mrp, feat: +r.featured ? 1 : 0, desc: r.description || '' };
  if (r.image) p.img = r.image;
  const more = (r.more_images || '').split('|').filter(Boolean);
  if (r.image && more.length) p.imgs = [r.image, ...more];
  return p;
});
const bad = products.filter(p => !(p.price > 0) || !(p.mrp >= p.price));
if (bad.length) { console.error('Fix price/mrp for ids:', bad.map(p => p.id).join(', ')); process.exit(1); }

const block = '/*PRODUCTS_START*/\nconst PRODUCTS=[\n' + products.map(p => ' ' + JSON.stringify(p)).join(',\n') + '\n];\n/*PRODUCTS_END*/';
let html = fs.readFileSync(__dirname + '/index.html', 'utf8');
html = html.replace(/\/\*PRODUCTS_START\*\/[\s\S]*?\/\*PRODUCTS_END\*\//, () => block);
fs.writeFileSync(__dirname + '/index.html', html);
fs.mkdirSync(__dirname + '/api', { recursive: true });
fs.writeFileSync(__dirname + '/api/_prices.json', JSON.stringify(Object.fromEntries(products.map(p => [p.id, p.price])), null, 1));
console.log('Built', products.length, 'products into index.html and api/_prices.json');
