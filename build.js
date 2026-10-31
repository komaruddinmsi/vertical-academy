// build.js — Vertical Academy (CMS FIMS)
// Memindai folder konten/ dan menulis katalog.json.
// Struktur: konten/<topik>/<tp>/<TAHAPAN>/index.html  (atau <TAHAPAN>.html)
//           konten/<topik>/<L1..L4>/index.html        (lapis topik)
// Opsional: konten/<topik>/topik.json dan konten/<topik>/<tp>/tp.json
const fs = require('fs');
const path = require('path');
const ROOT = 'konten';
const TAHAPAN_TP = ['S1','S2','S2b','S2c','S3','S4','S5','S6','S7','S8','S9','S10','S11','S12','S13','S14'];
const TAHAPAN_TOPIK = ['L1','L2','L3','L4'];

const isDir = p => fs.existsSync(p) && fs.statSync(p).isDirectory();
const readJSON = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return {}; } };
const judulDari = f => {
  const m = fs.readFileSync(f, 'utf8').match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].trim() : '';
};
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Cari berkas tahapan: <dir>/<ID>/index.html atau <dir>/<ID>.html (tidak peka huruf besar/kecil)
function cariTahapan(dir, daftar) {
  const hasil = {};
  const isi = fs.readdirSync(dir);
  for (const id of daftar) {
    const nama = isi.find(n => n.toLowerCase() === id.toLowerCase() || n.toLowerCase() === id.toLowerCase() + '.html');
    if (!nama) continue;
    const p = path.join(dir, nama);
    const f = isDir(p) ? path.join(p, 'index.html') : p;
    if (fs.existsSync(f)) hasil[id] = { berkas: f.split(path.sep).join('/'), judul: judulDari(f) };
  }
  return hasil;
}

const topik = [];
if (isDir(ROOT)) {
  for (const t of fs.readdirSync(ROOT).filter(n => isDir(path.join(ROOT, n)))) {
    const dirT = path.join(ROOT, t);
    const metaT = readJSON(path.join(dirT, 'topik.json'));
    const daftarTP = [];
    for (const p of fs.readdirSync(dirT).filter(n => isDir(path.join(dirT, n)) && !TAHAPAN_TOPIK.includes(n.toUpperCase()))) {
      const dirP = path.join(dirT, p);
      const metaP = readJSON(path.join(dirP, 'tp.json'));
      const tahapan = cariTahapan(dirP, TAHAPAN_TP);
      daftarTP.push({
        slug: slug(p),
        kode: metaP.kode || p,
        judul: metaP.judul || (tahapan.S1 && tahapan.S1.judul) || p,
        teks: metaP.teks || '',
        bloom: metaP.bloom || '',
        urutan_ajar: metaP.urutan_ajar ?? 999,
        prasyarat: metaP.prasyarat || [],
        ambang: metaP.ambang || 75,
        tahapan
      });
    }
    daftarTP.sort((a, b) => a.urutan_ajar - b.urutan_ajar || a.kode.localeCompare(b.kode));
    topik.push({
      slug: slug(t),
      kode: metaT.kode || t,
      nama: metaT.nama || t,
      mapel: metaT.mapel || 'Umum',
      fase: metaT.fase || '',
      jalur: metaT.jalur || '',
      urutan: metaT.urutan ?? 999,
      tahapan: cariTahapan(dirT, TAHAPAN_TOPIK),
      tp: daftarTP
    });
  }
}
topik.sort((a, b) => a.urutan - b.urutan || a.kode.localeCompare(b.kode));
fs.writeFileSync('katalog.json', JSON.stringify({ dibuat: new Date().toISOString(), topik }, null, 2));
console.log(`${topik.length} topik, ${topik.reduce((n, t) => n + t.tp.length, 0)} TP ditemukan`);
