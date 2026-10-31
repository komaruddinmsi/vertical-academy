/* Vertical Academy — mesin alur Pembelajaran Tuntas (CMS FIMS), versi statis.
   Data kurikulum: katalog.json (dibuat build.js). Progres siswa: localStorage perangkat ini.
   Halaman tahapan boleh melapor skor:  parent.postMessage({fims:'skor', skor:85}, '*')
   atau selesai tanpa skor:              parent.postMessage({fims:'selesai'}, '*')            */
(function () {
'use strict';

const TAHAPAN = [
  { id:'S1',  f:0, nama:'Peta & Janji',            lulus:'Dibuka',                         rangka:1 },
  { id:'S2',  f:0, nama:'Gerbang Prasyarat',       lulus:'≥80% lanjut · 60–79% → S2b · <60% → S2c', gate:1, skor:1, rangka:1 },
  { id:'S2b', f:0, nama:'Penguatan Prasyarat',     lulus:'Ulang S2 satu kali', cabang:1 },
  { id:'S2c', f:0, nama:'Remediasi Prasyarat',     lulus:'Ulang S2', cabang:1 },
  { id:'S3',  f:0, nama:'Pemantik & Prakonsepsi',  lulus:'Terkirim (tidak dinilai)', rangka:1 },
  { id:'S4',  f:0, nama:'Penyajian Konsep Awal',   lulus:'Cek sisipan terjawab' },
  { id:'S5',  f:1, nama:'Pembahasan Prakonsepsi',  lulus:'Dipimpin guru', rangka:1 },
  { id:'S6',  f:1, nama:'Inti Terbimbing',         lulus:'Dipimpin guru' },
  { id:'S7',  f:1, nama:'Praktik Terstruktur',     lulus:'Lembar kerja terisi' },
  { id:'S8',  f:1, nama:'Gerbang Formatif Kelas',  lulus:'≥80% benar', gate:1, skor:1, rangka:1 },
  { id:'S9',  f:1, nama:'Diferensiasi T1–T4',      lulus:'Sesuai cabang S8' },
  { id:'S10', f:1, nama:'Konsolidasi & Jangkar',   lulus:'Jangkar terkirim', rangka:1 },
  { id:'S11', f:2, nama:'Latihan Bertingkat',      lulus:'Benar 3 dari 4 (≥75%) · H+0–H+2', skor:1 },
  { id:'S12', f:2, nama:'Tugas Kinerja',           lulus:'Minimal T3 (dinilai guru) · H+1–H+5', gate:1, tier:1, rangka:1 },
  { id:'S13', f:2, nama:'Gerbang Ketuntasan TP',   lulus:'Butir baru, sekali jalan · H+2–H+7', gate:1, skor:1, rangka:1 },
  { id:'S14', f:2, nama:'Pengulangan Berjarak',    lulus:'H+14, +30, +60 · gagal → turun', gate:1, rangka:1 }
];
const LAPIS = [
  { id:'L1', nama:'Kuis Blok',              kapan:'Setiap 2–4 TP' },
  { id:'L2', nama:'Muara Topik',            kapan:'Setelah TP terakhir' },
  { id:'L3', nama:'Tes Topik',              kapan:'Akhir topik', gate:1 },
  { id:'L4', nama:'Tantangan Mata Pelajaran', kapan:'Berkala, lintas topik' }
];
const FASE = ['Fase 0 · Pra-KBM', 'Fase 1 · KBM', 'Fase 2 · Pasca-KBM'];
const STATUS = ['Belum Mulai', 'Siap', 'Mencoba', 'Akrab', 'Mahir', 'Tuntas'];
const HARI = 864e5;
const T = id => TAHAPAN.find(s => s.id === id);

/* ---------- penyimpanan ---------- */
const KEY = 'va-fims-v1';
let db = {};
try { db = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { db = {}; }
db.tp = db.tp || {}; db.opsi = db.opsi || {};
const simpan = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
const prog = slug => (db.tp[slug] = db.tp[slug] || { ev: {}, tier: null, s14: [], riwayat: [] });
const now = () => Date.now() + (db.opsi.geser || 0) * HARI;   // "geser hari" = simulasi waktu untuk uji coba

/* ---------- mesin status ---------- */
function hitung(tp) {
  const p = prog(tp.slug), e = p.ev, amb = tp.ambang || 75;
  const sk = id => (e[id] && e[id].skor != null) ? e[id].skor : null;
  const ok = id => !!e[id];
  let s = 0;
  if (sk('S2') != null && sk('S2') >= 80) s = 1;
  if (s >= 1 && ok('S4')) s = 2;
  if (s >= 2 && sk('S8') != null && sk('S8') >= 80) s = 3;
  const tier = p.tier || 0;
  if (s >= 3 && sk('S11') != null && sk('S11') >= 75 && tier >= 3) s = 4;
  let stabil = false;
  if (s >= 4 && sk('S13') != null && sk('S13') >= amb) {
    const gagalTerakhir = p.s14.length && p.s14[p.s14.length - 1].hasil === 'gagal';
    s = gagalTerakhir ? 4 : 5;
    stabil = s === 5 && p.s14.filter(x => x.hasil === 'lulus').length >= 3;
  }
  // catat riwayat bila berubah (status tidak ditimpa, jejak disimpan)
  const last = p.riwayat.length ? p.riwayat[p.riwayat.length - 1].ke : 0;
  if (last !== s) { p.riwayat.push({ dari: last, ke: s, waktu: now() }); simpan(); }
  return { s, stabil, tier: p.tier, e, p, amb };
}

// apakah tahapan terbuka? kembalikan null bila terbuka, atau alasan terkunci
function kunci(tp, id, h) {
  const e = h.e, sk = x => e[x] && e[x].skor;
  if (['S1', 'S2'].includes(id)) return null;
  if (id === 'S2b') return (sk('S2') != null && sk('S2') >= 60 && sk('S2') < 80) ? null : 'Hanya untuk skor S2 60–79%';
  if (id === 'S2c') return (sk('S2') != null && sk('S2') < 60) ? null : 'Hanya untuk skor S2 di bawah 60%';
  if (h.s < 1) return 'Lulus Gerbang Prasyarat (S2 ≥ 80%) dulu';
  if (['S3', 'S4'].includes(id)) return null;
  if (['S5', 'S6', 'S7', 'S8', 'S9', 'S10'].includes(id)) return e.S3 ? null : 'Kirim prakonsepsi S3 sebelum tatap muka';
  if (id === 'S11') return e.S8 ? null : 'Kerjakan Gerbang Formatif S8 di kelas';
  if (id === 'S12') return e.S11 ? null : 'Kerjakan Latihan Bertingkat S11 dulu';
  if (id === 'S13') {
    if (!e.S11) return 'Kerjakan S11 dulu';
    if ((h.tier || 0) < 3) return 'Tugas Kinerja S12 harus dinilai minimal T3';
    const buka = e.S11.waktu + 2 * HARI;
    if (now() < buka) return 'Kuis tertunda dibuka ' + tgl(buka) + ' (H+2 setelah S11)';
    if (e.S13 && e.S13.waktu > e.S11.waktu) return 'Sudah dikerjakan (sekali jalan). Gagal? Ulangi S11 dulu';
    return null;
  }
  if (id === 'S14') {
    if (!(e.S13 && e.S13.skor >= h.amb && h.s >= 4)) return 'Terbuka setelah status Tuntas';
    const j = jadwalS14(h).find(x => x.berikut);
    if (!j) return 'Tiga interval lulus: Tuntas Stabil';
    if (now() < j.jatuh) return 'Interval ' + j.ke + ' jatuh tempo ' + tgl(j.jatuh);
    return null;
  }
  return null;
}

function jadwalS14(h) {
  const awal = (h.p.s14Mulai || (h.e.S13 && h.e.S13.waktu));
  if (!awal) return [];
  const iv = [14, 30, 60];
  const done = h.p.s14.filter(x => x.waktu >= awal).length;
  return iv.map((d, i) => ({ ke: i + 1, hari: d, jatuh: awal + d * HARI, hasil: (h.p.s14.filter(x => x.waktu >= awal)[i] || {}).hasil, berikut: i === done }));
}

function catat(tp, id, data) {
  const p = prog(tp.slug);
  if (id === 'S14') {
    const lulus = data.skor == null ? true : data.skor >= (tp.ambang || 75);
    p.s14.push({ hasil: lulus ? 'lulus' : 'gagal', waktu: now() });
    if (!lulus) p.s14Mulai = now();               // turun ke Mahir & jadwal ulang dari interval pertama
  } else {
    p.ev[id] = { waktu: now(), skor: data.skor == null ? null : Math.round(data.skor) };
    if (id === 'S2' && p.ev.S2.skor >= 80) { delete p.ev.S2b; delete p.ev.S2c; }
  }
  simpan();
}

// satu langkah berikutnya untuk satu TP
function langkah(tp) {
  const h = hitung(tp), e = h.e, sk = x => e[x] && e[x].skor;
  const ada = id => !!tp.tahapan[id];
  if (!e.S1 && ada('S1')) return 'S1';
  if (h.s < 1) {
    if (sk('S2') != null && sk('S2') < 60 && !e.S2c && ada('S2c')) return 'S2c';
    if (sk('S2') != null && sk('S2') < 80 && sk('S2') >= 60 && !e.S2b && ada('S2b')) return 'S2b';
    return 'S2';
  }
  for (const id of ['S3', 'S4']) if (!e[id] && ada(id)) return id;
  if (!e.S8) return null;                          // menunggu tatap muka
  if (!e.S11) return 'S11';
  if (!e.S12) return 'S12';
  if (!kunci(tp, 'S13', h)) return 'S13';
  if (h.s === 5 || (h.s === 4 && e.S13)) {
    const j = jadwalS14(h).find(x => x.berikut);
    if (j && now() >= j.jatuh) return 'S14';
  }
  return null;
}

/* ---------- utilitas tampilan ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tgl = t => new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
const chip = (s, stabil) => `<span class="chip st${s}"><span class="dot"></span>${STATUS[s]}${stabil ? ' Stabil' : ''}</span>`;
const tierTag = t => t ? `<span class="tier">T${t}</span>` : '<span class="tier muted">T–</span>';
let K = { topik: [] };
const semuaTP = () => K.topik.flatMap(t => t.tp.map(tp => Object.assign({ _t: t }, tp)));
const cariTP = slug => semuaTP().find(x => x.slug === slug);
const cariTopik = slug => K.topik.find(x => x.slug === slug);
const guru = () => !!db.opsi.guru;

/* ---------- tampilan: beranda ---------- */
function beranda() {
  const tps = semuaTP();
  let next = null;
  for (const tp of tps) { const l = langkah(tp); if (l) { next = { tp, id: l }; break; } }
  const menunggu = tps.find(tp => { const h = hitung(tp); return h.e.S4 && !h.e.S8; });
  const nextHTML = next
    ? `<div class="next"><div class="what"><div class="eyebrow">Berikutnya untukmu</div>
         <h2>${esc(T(next.id).nama)}</h2><div class="muted"><span class="mono">${esc(next.tp.kode)} · ${next.id}</span> — ${esc(next.tp.judul)}</div></div>
         <a class="btn" href="#tp-${next.tp.slug}-${next.id.toLowerCase()}">Mulai</a></div>`
    : `<div class="next"><div class="what"><div class="eyebrow">Berikutnya untukmu</div><h2>${menunggu ? 'Tunggu tatap muka' : 'Belum ada langkah baru'}</h2>
         <div class="muted">${menunggu ? esc(menunggu.kode) + ': tahap KBM (S5–S10) berlangsung di kelas.' : 'Kuis tertunda dan pengulangan muncul di sini saat jatuh tempo.'}</div></div></div>`;
  const kartu = K.topik.map(t => {
    const n = t.tp.length, tuntas = t.tp.filter(tp => hitung(tp).s === 5).length;
    return `<a class="card" href="#topik-${t.slug}"><div class="eyebrow">${esc(t.mapel)}${t.fase ? ' · Fase ' + esc(t.fase) : ''}</div>
      <h3>${esc(t.nama)}</h3><div class="mono muted">${esc(t.kode)} · ${n} TP</div>
      <div class="meter"><i style="width:${n ? Math.round(tuntas / n * 100) : 0}%"></i></div>
      <div class="muted" style="font-size:.85rem">${tuntas} dari ${n} TP Tuntas</div></a>`;
  }).join('');
  return `<div class="stack">${nextHTML}<section class="stack"><h1>Topik</h1>
    <div class="grid-topik">${kartu || '<p class="muted">Belum ada topik. Tambahkan folder di konten/.</p>'}</div></section></div>`;
}

/* ---------- tampilan: topik ---------- */
function halTopik(t) {
  const tps = t.tp.map(tp => { const h = hitung(tp);
    return `<a class="item" href="#tp-${tp.slug}"><span class="code">${esc(tp.kode)}</span>
      <span class="t"><b>${esc(tp.judul)}</b>${tp.teks ? `<br><span class="muted">${esc(tp.teks)}</span>` : ''}</span>
      <span class="row">${chip(h.s, h.stabil)}${tierTag(h.tier)}</span></a>`; }).join('');
  const lapis = LAPIS.map(l => { const ada = t.tahapan[l.id];
    return ada ? `<a class="tile${l.gate ? ' gate' : ''}" href="#topik-${t.slug}-${l.id.toLowerCase()}"><span class="sid">${l.id}${l.gate ? ' ▲' : ''}</span><span class="nm">${esc(l.nama)}<small>${esc(l.kapan)}</small></span><span></span></a>`
               : `<div class="tile miss"><span class="sid">${l.id}</span><span class="nm">${esc(l.nama)}<small>Belum diunggah</small></span><span></span></div>`; }).join('');
  return `<div class="stack"><div class="crumbs"><a href="#">Beranda</a> / ${esc(t.kode)}</div>
    <div><div class="eyebrow">${esc(t.mapel)}${t.jalur ? ' · ' + esc(t.jalur) : ''}</div><h1>${esc(t.nama)}</h1></div>
    <section class="stack"><h2>Tujuan Pembelajaran</h2><div class="list">${tps || '<p class="muted">Belum ada TP.</p>'}</div></section>
    <section class="stack"><h2>Lapis topik</h2><div class="layer">${lapis}</div></section></div>`;
}

/* ---------- tampilan: TP ---------- */
function halTP(tp, aktif) {
  const h = hitung(tp), t = tp._t;
  const ladder = STATUS.map((n, i) => `<div class="${i <= h.s && i > 0 ? 'on st' + i : ''}${i === 0 && h.s === 0 ? ' on' : ''}">${n}</div>`).join('');
  const lanes = [0, 1, 2].map(f => {
    const tiles = TAHAPAN.filter(s => s.f === f).map(s => {
      const ada = tp.tahapan[s.id], k = kunci(tp, s.id, h), ev = h.e[s.id];
      if (s.cabang && !ada) return '';
      let mark = '';
      if (s.id === 'S12') mark = h.tier ? 'T' + h.tier : (ev ? 'menunggu nilai' : '');
      else if (s.id === 'S14') mark = h.p.s14.length ? h.p.s14.length + '× ' : '';
      else if (ev) mark = ev.skor != null ? ev.skor + '%' : '✓';
      const cls = ['tile', s.gate ? 'gate' : '', s.cabang ? 'branch' : '', !ada ? 'miss' : '', ada && k ? 'lock' : '', aktif === s.id ? 'cur' : ''].join(' ');
      const sub = !ada ? 'Belum diunggah' : (k ? '🔒 ' + k : s.lulus);
      const inner = `<span class="sid">${s.id}${s.gate ? ' ▲' : ''}</span><span class="nm">${esc(s.nama)}<small>${esc(sub)}</small></span><span class="mark${ev ? ' ok' : ''}">${esc(mark)}</span>`;
      return ada && (!k || guru()) ? `<a class="${cls}" href="#tp-${tp.slug}-${s.id.toLowerCase()}">${inner}</a>` : `<div class="${cls}">${inner}</div>`;
    }).join('');
    return `<div class="phase"><h3>${FASE[f]}</h3>${tiles}</div>`;
  }).join('');
  const lengkap = TAHAPAN.filter(s => s.rangka && !tp.tahapan[s.id]).map(s => s.id);
  return `<div class="stack"><div class="crumbs"><a href="#">Beranda</a> / <a href="#topik-${t.slug}">${esc(t.kode)}</a> / ${esc(tp.kode)}</div>
    <div class="row" style="justify-content:space-between"><div style="min-width:0"><div class="eyebrow mono">${esc(tp.kode)}${tp.bloom ? ' · Bloom ' + esc(tp.bloom) : ''}</div>
      <h1>${esc(tp.judul)}</h1>${tp.teks ? `<p class="muted" style="margin:.4em 0 0;max-width:65ch">${esc(tp.teks)}</p>` : ''}</div>
      <div class="row">${chip(h.s, h.stabil)}${tierTag(h.tier)}</div></div>
    <div class="ladder">${ladder}</div>
    ${h.s === 4 && h.p.s14.length && h.p.s14[h.p.s14.length - 1].hasil === 'gagal' ? '<div class="note">Status turun ke Mahir: pengulangan berjarak gagal. Jadwal diulang dari H+14.</div>' : ''}
    ${(h.tier && h.tier < 3) ? '<div class="note">Tier T' + h.tier + ': perlu pendampingan pada konteks baru, bukan tambahan latihan soal.</div>' : ''}
    ${guru() && lengkap.length ? `<div class="note">Kelengkapan: tahapan rangka belum diunggah — ${lengkap.join(', ')}.</div>` : ''}
    <div class="phases">${lanes}</div>
    ${aktif ? viewer(tp, aktif, h) : ''}
    ${h.e.S13 && h.e.S13.skor >= h.amb && h.s >= 4 ? s14Panel(h) : ''}
    ${guru() ? panelGuruTP(tp, h) : ''}</div>`;
}

function s14Panel(h) {
  const rows = jadwalS14(h).map(j => `<tr><td>Interval ${j.ke}</td><td>H+${j.hari}</td><td>${tgl(j.jatuh)}</td><td class="${j.hasil === 'lulus' ? 'y' : j.hasil === 'gagal' ? 'n' : 'o'}">${j.hasil || (j.berikut ? 'berikutnya' : '—')}</td></tr>`).join('');
  return `<section class="panel stack"><h3>Jadwal pengulangan berjarak (S14)</h3><div class="scroll"><table><tr><th>Interval</th><th>Hari</th><th>Jatuh tempo</th><th>Hasil</th></tr>${rows}</table></div></section>`;
}

function viewer(tp, id, h) {
  const s = T(id), f = tp.tahapan[id];
  if (!f) return `<div class="panel">Tahapan ${id} belum diunggah.</div>`;
  const k = kunci(tp, id, h);
  if (k && !guru()) return `<div class="note">🔒 ${esc(k)}</div>`;
  let aksi;
  if (s.tier) aksi = `<div class="row"><button class="btn" data-aksi="selesai">Tandai bukti terkirim</button><span class="muted">Tier diisi guru (rubrik T1–T4).</span></div>`;
  else if (s.skor || id === 'S14') aksi = `<div class="row"><label for="skorIn">Skor (%)</label><input type="number" id="skorIn" min="0" max="100" style="width:90px"><button class="btn" data-aksi="skor">Simpan skor</button><span class="muted">Terisi otomatis bila halaman kuis mengirim skor.</span></div>`;
  else aksi = `<div class="row"><button class="btn" data-aksi="selesai">Tandai selesai</button></div>`;
  return `<section class="viewer" id="viewer"><div class="row" style="justify-content:space-between"><h2>${id} · ${esc(s.nama)}</h2><span class="muted">Lulus apabila: ${esc(s.lulus)}</span></div>
    ${k ? `<div class="note">Mode guru: tahapan ini masih terkunci untuk siswa (${esc(k)}).</div>` : ''}
    <iframe class="frame" src="${esc(f.berkas)}" title="${esc(s.nama)}"></iframe>${aksi}</section>`;
}

function panelGuruTP(tp, h) {
  const opsi = [0, 1, 2, 3, 4].map(n => `<option value="${n}"${(h.tier || 0) === n ? ' selected' : ''}>${n ? 'T' + n : '—'}</option>`).join('');
  return `<section class="panel stack"><h3>Panel guru · ${esc(tp.kode)}</h3>
    <div class="row"><label for="tierIn">Tier dari rubrik S9/S12</label><select id="tierIn">${opsi}</select>
    <button class="btn ghost" data-aksi="reset">Hapus progres TP ini</button></div>
    <div class="muted" style="font-size:.85rem">Selisih S11 − S13: ${h.e.S11 && h.e.S13 && h.e.S11.skor != null && h.e.S13.skor != null ? (h.e.S11.skor - h.e.S13.skor) + ' poin' : 'belum ada data'} · Riwayat status: ${h.p.riwayat.map(r => STATUS[r.ke]).join(' → ') || '—'}</div></section>`;
}

/* ---------- tampilan: lapis topik ---------- */
function halLapis(t, id) {
  const l = LAPIS.find(x => x.id === id), f = t.tahapan[id];
  return `<div class="stack"><div class="crumbs"><a href="#">Beranda</a> / <a href="#topik-${t.slug}">${esc(t.kode)}</a> / ${id}</div>
    <h1>${id} · ${esc(l.nama)}</h1><p class="muted">${esc(l.kapan)}</p>
    ${f ? `<iframe class="frame" src="${esc(f.berkas)}" title="${esc(l.nama)}"></iframe>` : '<p>Belum diunggah.</p>'}</div>`;
}

/* ---------- tampilan: papan guru ---------- */
function halGuru() {
  const ids = TAHAPAN.map(s => s.id);
  const kel = K.topik.map(t => {
    const rows = t.tp.map(tp => `<tr><td class="l mono">${esc(tp.kode)}</td>${ids.map(id => {
      const s = T(id), ada = !!tp.tahapan[id];
      return `<td class="${ada ? 'y' : s.rangka ? 'n' : 'o'}">${ada ? '✓' : s.rangka ? '✕' : '·'}</td>`; }).join('')}
      <td class="${TAHAPAN.some(s => s.rangka && !tp.tahapan[s.id]) ? 'n' : 'y'}">${TAHAPAN.some(s => s.rangka && !tp.tahapan[s.id]) ? 'Belum' : 'Siap'}</td></tr>`).join('');
    return `<h3>${esc(t.kode)} · ${esc(t.nama)}</h3><div class="scroll"><table><tr><th class="l">TP</th>${ids.map(i => `<th>${i}</th>`).join('')}<th>Terbit</th></tr>${rows}</table></div>`;
  }).join('');
  const tps = semuaTP();
  const papan = `<div class="scroll"><table><tr><th class="l">Siswa</th>${tps.map(tp => `<th class="mono">${esc(tp.kode)}</th>`).join('')}</tr>
    <tr><td class="l">Perangkat ini</td>${tps.map(tp => { const h = hitung(tp); return `<td class="cell st${h.s}" title="${STATUS[h.s]}">${h.tier ? 'T' + h.tier : ''}</td>`; }).join('')}</tr></table></div>
    <div class="row" style="font-size:.8rem">${STATUS.map((n, i) => chip(i)).join('')}</div>`;
  const geser = db.opsi.geser || 0;
  return `<div class="stack"><div><div class="eyebrow">Papan guru</div><h1>Kelengkapan & posisi</h1></div>
    <section class="panel stack"><h2>Kelengkapan tahapan</h2><p class="muted" style="margin:0">✕ = tahapan rangka (S1, S2, S3, S5, S8, S10, S12, S13, S14) belum diunggah. TP dengan ✕ belum boleh terbit.</p>${kel}</section>
    <section class="panel stack"><h2>Papan posisi</h2><p class="muted" style="margin:0">Warna = status, angka = tier. Versi statis hanya membaca progres di perangkat ini. Papan seluruh kelas butuh login dan database (Tahap 6 panduan).</p>${papan}</section>
    <section class="panel stack"><h2>Simulasi waktu</h2><p class="muted" style="margin:0">Untuk uji alur kuis tertunda (H+2) dan pengulangan (H+14). Sekarang digeser ${geser} hari.</p>
      <div class="row"><button class="btn ghost" data-geser="2">+2 hari</button><button class="btn ghost" data-geser="14">+14 hari</button><button class="btn ghost" data-geser="0">Kembali ke hari ini</button></div></section></div>`;
}

/* ---------- router ---------- */
let cur = null;
function render() {
  const h = decodeURIComponent(location.hash.slice(1));
  let html, m; cur = null;
  $('#nav-guru').classList.toggle('on', h === 'guru');
  $('#nav-belajar').classList.toggle('on', h !== 'guru');
  if (h === 'guru') html = halGuru();
  else if ((m = h.match(/^topik-(.+)-(l[1-4])$/)) && cariTopik(m[1])) html = halLapis(cariTopik(m[1]), m[2].toUpperCase());
  else if ((m = h.match(/^topik-(.+)$/)) && cariTopik(m[1])) html = halTopik(cariTopik(m[1]));
  else if ((m = h.match(/^tp-(.+)-(s\d+[bc]?)$/)) && cariTP(m[1])) { const id = m[2].toUpperCase().replace(/([BC])$/, c => c.toLowerCase()); cur = { tp: cariTP(m[1]), id }; html = halTP(cur.tp, id); }
  else if ((m = h.match(/^tp-(.+)$/)) && cariTP(m[1])) html = halTP(cariTP(m[1]));
  else html = beranda();
  $('#app').innerHTML = html;
  if (cur && document.getElementById('viewer')) document.getElementById('viewer').scrollIntoView({ block: 'start', behavior: 'smooth' });
  else window.scrollTo(0, 0);
}

function tpDariHash() { const m = location.hash.match(/^#tp-(.+?)(-s\d+[bc]?)?$/); return m ? cariTP(m[1]) : null; }

document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-aksi],[data-geser]'); if (!b) return;
  if (b.dataset.geser != null) { db.opsi.geser = +b.dataset.geser ? (db.opsi.geser || 0) + +b.dataset.geser : 0; simpan(); return render(); }
  const a = b.dataset.aksi, tp = tpDariHash(); if (!tp) return;
  if (a === 'selesai' && cur) catat(tp, cur.id, {});
  if (a === 'skor' && cur) { const v = parseFloat($('#skorIn').value); if (isNaN(v)) return $('#skorIn').focus(); catat(tp, cur.id, { skor: Math.max(0, Math.min(100, v)) }); }
  if (a === 'reset') { delete db.tp[tp.slug]; simpan(); }
  render();
});
document.addEventListener('change', ev => {
  if (ev.target.id === 'tierIn') { const tp = tpDariHash(); if (tp) { prog(tp.slug).tier = +ev.target.value || null; simpan(); render(); } }
  if (ev.target.id === 'modeGuru') { db.opsi.guru = ev.target.checked; simpan(); render(); }
});
// jembatan skor dari halaman HTML tahapan
window.addEventListener('message', ev => {
  const d = ev.data; if (!d || !d.fims || !cur) return;
  const s = T(cur.id);
  if (d.fims === 'skor' && typeof d.skor === 'number' && (s.skor || cur.id === 'S14')) catat(cur.tp, cur.id, { skor: d.skor });
  else if (d.fims === 'selesai' && !s.skor) catat(cur.tp, cur.id, {});
  else return;
  render();
});
window.addEventListener('hashchange', render);

fetch('katalog.json').then(r => r.json()).then(k => {
  K = k; $('#modeGuru').checked = guru(); render();
}).catch(() => { $('#app').innerHTML = '<div class="note">katalog.json belum ada. Jalankan <span class="mono">node build.js</span> (Cloudflare menjalankannya otomatis).</div>'; });
})();
