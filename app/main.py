"""PDF tools by Aksara: server web (FastAPI)."""
from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask

from . import converters
from .converters import ConversionError

MAX_FILE_MB = 50
MAX_FILES = 20
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

app = FastAPI(title="PDF tools by Aksara")

PDF_TYPES = {".pdf"}
WORD_TYPES = {".doc", ".docx", ".odt", ".rtf"}
EXCEL_TYPES = {".xls", ".xlsx", ".ods", ".csv"}


async def _save(upload: UploadFile, workdir: Path, allowed: set[str], index: int = 0) -> Path:
    name = Path(upload.filename or "file").name
    ext = Path(name).suffix.lower()
    if ext not in allowed:
        raise HTTPException(400, f"Format '{ext or name}' tidak didukung. Gunakan: {', '.join(sorted(allowed))}")
    dest = workdir / f"{index:02d}_{name}"
    size = 0
    with dest.open("wb") as fh:
        while chunk := await upload.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_FILE_MB * 1024 * 1024:
                raise HTTPException(413, f"Ukuran file maksimal {MAX_FILE_MB} MB.")
            fh.write(chunk)
    if size == 0:
        raise HTTPException(400, f"File '{name}' kosong.")
    return dest


def _respond(path: Path, download_name: str, workdir: Path, media_type: str) -> FileResponse:
    return FileResponse(
        path,
        filename=download_name,
        media_type=media_type,
        background=BackgroundTask(shutil.rmtree, workdir, ignore_errors=True),
    )


def _run(fn, workdir: Path):
    try:
        return fn()
    except ConversionError as exc:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(422, str(exc)) from exc
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except Exception as exc:  # noqa: BLE001
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(500, "Terjadi kesalahan saat memproses file.") from exc


def _workdir() -> Path:
    return Path(tempfile.mkdtemp(prefix="aksara-"))


def _stem(upload: UploadFile) -> str:
    return Path(upload.filename or "hasil").stem or "hasil"


@app.get("/api/health")
def health():
    return {"status": "ok", "libreoffice": bool(shutil.which("soffice") or shutil.which("libreoffice"))}


@app.post("/api/merge")
async def merge(files: list[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(400, "Pilih minimal 2 file PDF untuk digabung.")
    if len(files) > MAX_FILES:
        raise HTTPException(400, f"Maksimal {MAX_FILES} file sekaligus.")
    wd = _workdir()
    try:
        paths = [await _save(f, wd, PDF_TYPES, i) for i, f in enumerate(files)]
    except HTTPException:
        shutil.rmtree(wd, ignore_errors=True)
        raise
    out = wd / "merged.pdf"
    _run(lambda: converters.merge_pdfs(paths, out), wd)
    return _respond(out, "gabungan_aksara.pdf", wd, "application/pdf")


async def _single(file: UploadFile, allowed: set[str]) -> tuple[Path, Path]:
    wd = _workdir()
    try:
        return wd, await _save(file, wd, allowed)
    except HTTPException:
        shutil.rmtree(wd, ignore_errors=True)
        raise


@app.post("/api/pdf-to-word")
async def pdf_to_word(file: UploadFile = File(...)):
    wd, src = await _single(file, PDF_TYPES)
    out = wd / "result.docx"
    _run(lambda: converters.pdf_to_word(src, out), wd)
    return _respond(out, f"{_stem(file)}.docx", wd,
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document")


@app.post("/api/pdf-to-excel")
async def pdf_to_excel(file: UploadFile = File(...)):
    wd, src = await _single(file, PDF_TYPES)
    out = wd / "result.xlsx"
    _run(lambda: converters.pdf_to_excel(src, out), wd)
    return _respond(out, f"{_stem(file)}.xlsx", wd,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@app.post("/api/word-to-pdf")
async def word_to_pdf(file: UploadFile = File(...)):
    wd, src = await _single(file, WORD_TYPES)
    out = _run(lambda: converters.office_to_pdf(src, wd), wd)
    return _respond(out, f"{_stem(file)}.pdf", wd, "application/pdf")


@app.post("/api/excel-to-pdf")
async def excel_to_pdf(file: UploadFile = File(...)):
    wd, src = await _single(file, EXCEL_TYPES)
    out = _run(lambda: converters.office_to_pdf(src, wd), wd)
    return _respond(out, f"{_stem(file)}.pdf", wd, "application/pdf")


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
