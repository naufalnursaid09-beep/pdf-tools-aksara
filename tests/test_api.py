import io
import shutil

import pytest
from docx import Document
from fastapi.testclient import TestClient
from openpyxl import Workbook, load_workbook
from pypdf import PdfReader
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, Paragraph
from reportlab.lib.styles import getSampleStyleSheet

from app.main import app

client = TestClient(app)
HAS_LO = bool(shutil.which("soffice") or shutil.which("libreoffice"))


def make_pdf(text: str, pages: int = 1, table: bool = False) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4)
    style = getSampleStyleSheet()["Normal"]
    story = []
    for i in range(pages):
        story.append(Paragraph(f"{text} halaman {i + 1}", style))
        if table:
            story.append(Table([["Nama", "Jumlah"], ["Apel", "10"], ["Jeruk", "25"]], style=[
                ("GRID", (0, 0), (-1, -1), 0.5, "black")]))
        if i < pages - 1:
            from reportlab.platypus import PageBreak
            story.append(PageBreak())
    doc.build(story)
    return buf.getvalue()


def test_home_page():
    res = client.get("/")
    assert res.status_code == 200
    assert "PDF tools" in res.text


def test_merge():
    files = [
        ("files", ("a.pdf", make_pdf("A", pages=2), "application/pdf")),
        ("files", ("b.pdf", make_pdf("B", pages=3), "application/pdf")),
    ]
    res = client.post("/api/merge", files=files)
    assert res.status_code == 200, res.text
    reader = PdfReader(io.BytesIO(res.content))
    assert len(reader.pages) == 5
    assert "A halaman 1" in reader.pages[0].extract_text()
    assert "B halaman 1" in reader.pages[2].extract_text()


def test_merge_needs_two_files():
    res = client.post("/api/merge", files=[("files", ("a.pdf", make_pdf("A"), "application/pdf"))])
    assert res.status_code == 400


def test_merge_rejects_invalid_pdf():
    files = [
        ("files", ("a.pdf", make_pdf("A"), "application/pdf")),
        ("files", ("rusak.pdf", b"bukan pdf", "application/pdf")),
    ]
    res = client.post("/api/merge", files=files)
    assert res.status_code == 422
    assert "rusak.pdf" in res.json()["detail"]


def test_rejects_wrong_extension():
    res = client.post("/api/pdf-to-word", files={"file": ("x.txt", b"halo", "text/plain")})
    assert res.status_code == 400


def test_pdf_to_word():
    res = client.post("/api/pdf-to-word", files={"file": ("laporan.pdf", make_pdf("Halo Aksara"), "application/pdf")})
    assert res.status_code == 200, res.text
    assert "laporan.docx" in res.headers["content-disposition"]
    doc = Document(io.BytesIO(res.content))
    assert "Halo Aksara" in "\n".join(p.text for p in doc.paragraphs)


def test_pdf_to_excel_extracts_table():
    res = client.post("/api/pdf-to-excel", files={"file": ("data.pdf", make_pdf("Data", table=True), "application/pdf")})
    assert res.status_code == 200, res.text
    wb = load_workbook(io.BytesIO(res.content))
    rows = [list(r) for r in wb.worksheets[0].iter_rows(values_only=True)]
    assert ["Nama", "Jumlah"] in rows
    assert ["Jeruk", 25] in rows


@pytest.mark.skipif(not HAS_LO, reason="LibreOffice tidak terpasang")
def test_word_to_pdf():
    d = Document()
    d.add_paragraph("Dokumen Word Aksara")
    buf = io.BytesIO()
    d.save(buf)
    res = client.post("/api/word-to-pdf", files={"file": ("surat.docx", buf.getvalue(), "application/octet-stream")})
    assert res.status_code == 200, res.text
    assert "Dokumen Word Aksara" in PdfReader(io.BytesIO(res.content)).pages[0].extract_text()


@pytest.mark.skipif(not HAS_LO, reason="LibreOffice tidak terpasang")
def test_excel_to_pdf():
    wb = Workbook()
    wb.active.append(["Produk", "Harga"])
    wb.active.append(["Buku", 15000])
    buf = io.BytesIO()
    wb.save(buf)
    res = client.post("/api/excel-to-pdf", files={"file": ("harga.xlsx", buf.getvalue(), "application/octet-stream")})
    assert res.status_code == 200, res.text
    text = PdfReader(io.BytesIO(res.content)).pages[0].extract_text()
    assert "Produk" in text and "Buku" in text
