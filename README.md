# Vertical Academy — CMS FIMS

Website bimbel dengan alur Pembelajaran Tuntas (14 tahapan per TP + 4 lapis topik).

konten/<topik>/topik.json            kode, nama, mapel, fase, jalur, urutan
konten/<topik>/<tp>/tp.json          kode, judul, teks, bloom, urutan_ajar, prasyarat, ambang
konten/<topik>/<tp>/S1/index.html    satu folder per tahapan: S1, S2, S2b, S2c, S3 … S14
konten/<topik>/L1/index.html         lapis topik: L1 Kuis Blok, L2 Muara, L3 Tes Topik, L4 Tantangan

HTML tahapan boleh berstruktur apa pun. Skor otomatis tercatat bila HTML kuis memanggil:
  parent.postMessage({fims:'skor', skor: 85}, '*')
Tahapan tanpa skor:
  parent.postMessage({fims:'selesai'}, '*')

Cloudflare Pages: build command `node build.js`, output `/`.
