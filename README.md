# PDF tools by Aksara

Website alat PDF (mirip iLovePDF) dengan fitur:

| Alat | Endpoint | Mesin |
|---|---|---|
| Gabung PDF | `POST /api/merge` (field `files`, min. 2) | pypdf |
| PDF ke Word (.docx) | `POST /api/pdf-to-word` | pdf2docx |
| PDF ke Excel (.xlsx) | `POST /api/pdf-to-excel` | pdfplumber + openpyxl |
| Word ke PDF | `POST /api/word-to-pdf` (.doc, .docx, .odt, .rtf) | LibreOffice headless |
| Excel ke PDF | `POST /api/excel-to-pdf` (.xls, .xlsx, .ods, .csv) | LibreOffice headless |

Backend memakai **FastAPI** (Python), frontend HTML/CSS/JS murni tanpa build step.
File disimpan di folder sementara dan langsung dihapus setelah hasil dikirim.
Batas: 50 MB per file, 20 file per penggabungan.

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

## Tes

```bash
pip install -r requirements-dev.txt
pytest
```

## Catatan

- PDF ke Excel mengambil tabel per halaman (satu sheet per tabel). Halaman tanpa tabel diekspor sebagai teks per baris.
- PDF hasil scan (gambar) belum didukung untuk konversi ke Word/Excel karena butuh OCR.
- PDF yang dikunci kata sandi akan ditolak dengan pesan yang jelas.
