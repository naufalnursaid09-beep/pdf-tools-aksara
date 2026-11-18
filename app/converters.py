"""Fungsi konversi inti. Semua fungsi menerima path input dan menulis ke path output."""
from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

import pdfplumber
from openpyxl import Workbook
from openpyxl.utils import get_column_letter
from pdf2docx import Converter
from pypdf import PdfReader, PdfWriter


_NUMBER = re.compile(r"-?\d{1,3}(,\d{3})+(\.\d+)?|-?\d+(\.\d+)?")


class ConversionError(Exception):
    """Kesalahan yang aman ditampilkan ke pengguna."""


def merge_pdfs(inputs: list[Path], output: Path) -> None:
    writer = PdfWriter()
    for path in inputs:
        try:
            reader = PdfReader(str(path))
        except Exception as exc:  # noqa: BLE001
            raise ConversionError(f"File '{path.name}' bukan PDF yang valid.") from exc
        if reader.is_encrypted:
            raise ConversionError(f"File '{path.name}' dilindungi kata sandi.")
        for page in reader.pages:
            writer.add_page(page)
    with output.open("wb") as fh:
        writer.write(fh)


def pdf_to_word(pdf: Path, output: Path) -> None:
    _ensure_pdf(pdf)
    cv = Converter(str(pdf))
    try:
        cv.convert(str(output))
    finally:
        cv.close()


def pdf_to_excel(pdf: Path, output: Path) -> None:
    """Ambil tabel dari tiap halaman. Halaman tanpa tabel diekspor sebagai teks per baris."""
    _ensure_pdf(pdf)
    wb = Workbook()
    wb.remove(wb.active)
    with pdfplumber.open(str(pdf)) as doc:
        for page_no, page in enumerate(doc.pages, start=1):
            tables = [t for t in page.extract_tables() if t]
            if tables:
                for t_no, table in enumerate(tables, start=1):
                    title = f"Hal {page_no}" if len(tables) == 1 else f"Hal {page_no} - Tabel {t_no}"
                    ws = wb.create_sheet(title[:31])
                    for row in table:
                        ws.append([_clean_cell(c) for c in row])
                    _autosize(ws)
            else:
                text = page.extract_text() or ""
                ws = wb.create_sheet(f"Hal {page_no}")
                for line in text.splitlines():
                    ws.append([line])
                _autosize(ws)
    if not wb.worksheets:
        wb.create_sheet("Kosong")
    wb.save(str(output))


def office_to_pdf(src: Path, out_dir: Path) -> Path:
    """Konversi Word/Excel ke PDF memakai LibreOffice (headless)."""
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice:
        raise ConversionError("LibreOffice belum terpasang di server.")
    profile = out_dir / "lo-profile"
    cmd = [
        soffice,
        f"-env:UserInstallation=file://{profile}",
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        str(out_dir),
        str(src),
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=180)
    except subprocess.TimeoutExpired as exc:
        raise ConversionError("Konversi terlalu lama, coba file yang lebih kecil.") from exc
    except subprocess.CalledProcessError as exc:
        raise ConversionError("Gagal mengonversi file ke PDF.") from exc
    result = out_dir / (src.stem + ".pdf")
    if not result.exists():
        raise ConversionError("Gagal mengonversi file ke PDF.")
    return result


def _ensure_pdf(pdf: Path) -> None:
    try:
        reader = PdfReader(str(pdf))
        if reader.is_encrypted:
            raise ConversionError("PDF dilindungi kata sandi.")
        _ = len(reader.pages)
    except ConversionError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise ConversionError("File bukan PDF yang valid.") from exc


def _clean_cell(value):
    if value is None:
        return None
    value = str(value).strip()
    # Angka dengan nol di depan (mis. nomor HP "0812...") tetap teks.
    has_leading_zero = len(value.lstrip("-")) > 1 and value.lstrip("-")[0] == "0" and value.lstrip("-")[1] != "."
    if _NUMBER.fullmatch(value) and not has_leading_zero:
        num = float(value.replace(",", ""))
        return int(num) if num.is_integer() and "." not in value else num
    return value


def _autosize(ws) -> None:
    for idx, col in enumerate(ws.columns, start=1):
        width = max((len(str(c.value)) for c in col if c.value is not None), default=8)
        ws.column_dimensions[get_column_letter(idx)].width = min(max(width + 2, 8), 60)
