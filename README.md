# PDF tools by Aksara

Website alat PDF (mirip iLovePDF) dengan fitur:

| Alat | Endpoint | Mesin |
|---|---|---|
| Gabung PDF | `POST /api/merge` (field `files`, min. 2) | pypdf |
| Kompres PDF | `POST /api/compress` (maks. 500 MB) | PyMuPDF |
| PDF ke Word (.docx) | `POST /api/pdf-to-word` | pdf2docx |
| PDF ke Excel (.xlsx) | `POST /api/pdf-to-excel` | pdfplumber + openpyxl |
| Word ke PDF | `POST /api/word-to-pdf` (.doc, .docx, .odt, .rtf) | LibreOffice headless |
| Excel ke PDF | `POST /api/excel-to-pdf` (.xls, .xlsx, .ods, .csv) | LibreOffice headless |

Backend memakai **FastAPI** (Python), frontend HTML/CSS/JS murni tanpa build step.
File disimpan di folder sementara dan langsung dihapus setelah hasil dikirim.
Batas: 50 MB per file (500 MB untuk kompres), 20 file per penggabungan. Ubah di `app/main.py` bila perlu.

## Menjalankan secara lokal

Butuh Python 3.10+ dan LibreOffice (untuk Word/Excel ke PDF).

```bash
# Ubuntu/Debian:  sudo apt install libreoffice
# macOS:          brew install --cask libreoffice
# Windows:        pasang LibreOffice dari libreoffice.org lalu tambahkan folder program/ ke PATH

python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Buka http://localhost:8000

## Menjalankan dengan Docker

```bash
docker build -t pdf-tools-aksara .
docker run -p 8000:8000 pdf-tools-aksara
```

## Deploy online (Render, gratis)

Repo ini sudah berisi `render.yaml`, jadi Render bisa membangun dan menjalankan situsnya otomatis.

1. Daftar atau masuk di https://render.com memakai akun GitHub.
2. Klik **New** → **Blueprint**, lalu izinkan Render mengakses repo `pdf-tools-aksara`.
3. Pilih repo ini dan klik **Apply**. Render membangun image Docker (sekitar 5 sampai 10 menit).
4. Setelah selesai, situs bisa dibuka di `https://pdf-tools-aksara.onrender.com` (atau nama yang diberikan Render).

Setiap push ke `main` akan otomatis di-deploy ulang. Paket gratis Render "tidur" setelah 15 menit tanpa
pengunjung, jadi akses pertama setelahnya butuh sekitar 1 menit untuk bangun. Paket gratis juga hanya
punya RAM 512 MB, jadi file yang sangat besar lebih aman diproses di paket berbayar.

## Tes

```bash
pip install -r requirements-dev.txt
pytest
```

## Catatan

- Kompres PDF mencoba dua cara lalu memakai hasil terkecil: (1) pembersihan lossless (hapus objek
  tak terpakai, subset font, kompres stream) dan (2) ditambah kompres ulang gambar. Gambar di atas
  200 DPI diperkecil ke 150 DPI dengan JPEG kualitas 80, sehingga tetap tajam di layar dan cetak biasa.
  Gambar beresolusi rendah tidak diperkecil. Bila hasil tidak lebih kecil, file asli yang dikembalikan.

- PDF ke Excel mengambil tabel per halaman (satu sheet per tabel). Halaman tanpa tabel diekspor sebagai teks per baris.
- PDF hasil scan (gambar) belum didukung untuk konversi ke Word/Excel karena butuh OCR.
- PDF yang dikunci kata sandi akan ditolak dengan pesan yang jelas.
