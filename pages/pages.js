// Versi GitHub Pages: gabung PDF sepenuhnya di browser memakai pdf-lib.
// Ganti FULL_SITE_URL dengan alamat versi lengkap (Render) bila berbeda.
const FULL_SITE_URL = "https://pdf-tools-aksara.onrender.com";

const MORE_TOOLS = [
  ["compress", "Kompres PDF", "Perkecil ukuran PDF dengan gambar tetap tajam.", "#f08c00", "⇲"],
  ["pdf-to-word", "PDF ke Word", "Ubah PDF menjadi dokumen Word (DOCX).", "#2b579a", "W"],
  ["pdf-to-excel", "PDF ke Excel", "Ambil tabel dari PDF ke Excel (XLSX).", "#217346", "X"],
  ["word-to-pdf", "Word ke PDF", "Ubah dokumen Word menjadi PDF.", "#2b579a", "⇢"],
  ["excel-to-pdf", "Excel ke PDF", "Ubah spreadsheet Excel menjadi PDF.", "#217346", "⇢"],
];

const $ = (id) => document.getElementById(id);
let files = [];
let busy = false;

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function setStatus(kind, html) {
  const el = $("status");
  if (!kind) { el.className = "status hidden"; el.innerHTML = ""; return; }
  el.className = `status ${kind}`;
  el.innerHTML = html;
}

function isPdf(f) {
  return f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
}

function addFiles(list) {
  const incoming = [...list];
  const bad = incoming.filter((f) => !isPdf(f));
  files = files.concat(incoming.filter(isPdf));
  if (bad.length) setStatus("error", `Bukan PDF: ${escapeHtml(bad.map((f) => f.name).join(", "))}`);
  else setStatus();
  render();
}

function render() {
  $("fileList").innerHTML = files.map((f, i) => `
    <li class="file-item">
      <span class="file-badge">PDF</span>
      <span class="file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
      <span class="file-size">${formatSize(f.size)}</span>
      <button class="icon-btn" data-act="up" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Naikkan">↑</button>
      <button class="icon-btn" data-act="down" data-i="${i}" ${i === files.length - 1 ? "disabled" : ""} aria-label="Turunkan">↓</button>
      <button class="icon-btn" data-act="remove" data-i="${i}" aria-label="Hapus">✕</button>
    </li>`).join("");
  $("actions").classList.toggle("hidden", files.length === 0);
  $("dropzone").classList.toggle("compact", files.length > 0);
  $("runBtn").disabled = busy || files.length < 2;
  $("runBtn").title = files.length < 2 ? "Pilih minimal 2 file PDF" : "";
}

async function merge() {
  if (busy || files.length < 2) return;
  busy = true;
  render();
  setStatus("loading", `<span class="spinner"></span> Sedang menggabungkan…`);
  try {
    const out = await PDFLib.PDFDocument.create();
    for (const f of files) {
      let pages;
      try {
        const src = await PDFLib.PDFDocument.load(await f.arrayBuffer());
        pages = await out.copyPages(src, src.getPageIndices());
      } catch (err) {
        const locked = /encrypt/i.test(String(err && err.message));
        throw new Error(locked ? `File '${f.name}' dilindungi kata sandi.` : `File '${f.name}' bukan PDF yang valid.`);
      }
      pages.forEach((p) => out.addPage(p));
    }
    const bytes = await out.save();
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const name = "gabungan_aksara.pdf";
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setStatus("success", `Selesai! File <b>${name}</b> (${out.getPageCount()} halaman, ${formatSize(bytes.length)}) sudah diunduh. <a href="${url}" download="${name}">Unduh lagi</a>`);
  } catch (err) {
    setStatus("error", escapeHtml(err.message || "Terjadi kesalahan."));
  } finally {
    busy = false;
    render();
  }
}

function init() {
  $("year").textContent = new Date().getFullYear();
  $("nav").innerHTML = `<a href="./" class="active">Gabung PDF</a>` +
    MORE_TOOLS.map(([k, t]) => `<a href="${FULL_SITE_URL}/#${k}">${t}</a>`).join("");
  $("moreGrid").innerHTML = MORE_TOOLS.map(([k, t, d, c, ic]) => `
    <a class="card" href="${FULL_SITE_URL}/#${k}">
      <span class="card-icon" style="background:${c}">${ic}</span>
      <h3>${t}</h3><p>${d}</p>
    </a>`).join("");

  const input = $("fileInput");
  const dz = $("dropzone");
  $("pickBtn").addEventListener("click", (e) => { e.stopPropagation(); input.click(); });
  $("addMoreBtn").addEventListener("click", () => input.click());
  dz.addEventListener("click", () => input.click());
  dz.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
  input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("over"); }));
  dz.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));
  $("fileList").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn || busy) return;
    const i = Number(btn.dataset.i);
    if (btn.dataset.act === "remove") files.splice(i, 1);
    if (btn.dataset.act === "up" && i > 0) [files[i - 1], files[i]] = [files[i], files[i - 1]];
    if (btn.dataset.act === "down" && i < files.length - 1) [files[i + 1], files[i]] = [files[i], files[i + 1]];
    render();
  });
  $("runBtn").addEventListener("click", merge);
  render();
}

init();
