const TOOLS = {
  "merge": {
    title: "Gabung PDF",
    desc: "Gabungkan beberapa PDF menjadi satu file. Atur urutannya sesuai keinginan.",
    accept: ".pdf",
    multiple: true,
    min: 2,
    run: "Gabungkan PDF",
    endpoint: "/api/merge",
    color: "#e5322d",
    icon: "⧉",
  },
  "pdf-to-word": {
    title: "PDF ke Word",
    desc: "Ubah PDF menjadi dokumen Word (DOCX) yang bisa diedit.",
    accept: ".pdf",
    run: "Ubah ke Word",
    endpoint: "/api/pdf-to-word",
    color: "#2b579a",
    icon: "W",
  },
  "pdf-to-excel": {
    title: "PDF ke Excel",
    desc: "Ambil tabel dari PDF ke spreadsheet Excel (XLSX).",
    accept: ".pdf",
    run: "Ubah ke Excel",
    endpoint: "/api/pdf-to-excel",
    color: "#217346",
    icon: "X",
  },
  "word-to-pdf": {
    title: "Word ke PDF",
    desc: "Ubah dokumen Word (DOC, DOCX) menjadi PDF.",
    accept: ".doc,.docx,.odt,.rtf",
    run: "Ubah ke PDF",
    endpoint: "/api/word-to-pdf",
    color: "#2b579a",
    icon: "⇢",
  },
  "excel-to-pdf": {
    title: "Excel ke PDF",
    desc: "Ubah spreadsheet Excel (XLS, XLSX, CSV) menjadi PDF.",
    accept: ".xls,.xlsx,.ods,.csv",
    run: "Ubah ke PDF",
    endpoint: "/api/excel-to-pdf",
    color: "#217346",
    icon: "⇢",
  },
};

const $ = (id) => document.getElementById(id);
let current = null;
let files = [];
let busy = false;

function renderGrid() {
  $("toolGrid").innerHTML = Object.entries(TOOLS).map(([key, t]) => `
    <a class="card" href="#${key}">
      <span class="card-icon" style="background:${t.color}">${t.icon}</span>
      <h3>${t.title}</h3>
      <p>${t.desc}</p>
    </a>`).join("");
}

function route() {
  const key = location.hash.slice(1);
  document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${key}`));
  if (!TOOLS[key]) {
    current = null;
    $("home").classList.remove("hidden");
    $("tool").classList.add("hidden");
    return;
  }
  current = key;
  const t = TOOLS[key];
  files = [];
  $("toolTitle").textContent = t.title;
  $("toolDesc").textContent = t.desc;
  $("acceptHint").textContent = `Format: ${t.accept.replaceAll(",", ", ")}${t.multiple ? " · bisa banyak file" : ""}`;
  $("fileInput").accept = t.accept;
  $("fileInput").multiple = !!t.multiple;
  $("runBtn").textContent = t.run;
  $("addMoreBtn").classList.toggle("hidden", !t.multiple);
  $("home").classList.add("hidden");
  $("tool").classList.remove("hidden");
  setStatus();
  renderFiles();
  window.scrollTo(0, 0);
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function allowed(file) {
  const ext = "." + file.name.split(".").pop().toLowerCase();
  return TOOLS[current].accept.split(",").includes(ext);
}

function addFiles(list) {
  const t = TOOLS[current];
  const incoming = [...list];
  const bad = incoming.filter((f) => !allowed(f));
  const good = incoming.filter(allowed);
  files = t.multiple ? files.concat(good) : good.slice(0, 1);
  if (bad.length) setStatus("error", `Format tidak didukung: ${bad.map((f) => f.name).join(", ")}`);
  else setStatus();
  renderFiles();
}

function renderFiles() {
  const t = TOOLS[current];
  const ul = $("fileList");
  ul.innerHTML = files.map((f, i) => `
    <li class="file-item">
      <span class="file-badge">${f.name.split(".").pop().toUpperCase()}</span>
      <span class="file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
      <span class="file-size">${formatSize(f.size)}</span>
      ${t.multiple ? `
        <button class="icon-btn" data-act="up" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Naikkan">↑</button>
        <button class="icon-btn" data-act="down" data-i="${i}" ${i === files.length - 1 ? "disabled" : ""} aria-label="Turunkan">↓</button>` : ""}
      <button class="icon-btn" data-act="remove" data-i="${i}" aria-label="Hapus">✕</button>
    </li>`).join("");
  $("actions").classList.toggle("hidden", files.length === 0);
  $("dropzone").classList.toggle("compact", files.length > 0);
  $("runBtn").disabled = busy || files.length < (t.min || 1);
  $("runBtn").title = files.length < (t.min || 1) ? `Pilih minimal ${t.min} file` : "";
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function setStatus(kind, html) {
  const el = $("status");
  if (!kind) { el.className = "status hidden"; el.innerHTML = ""; return; }
  el.className = `status ${kind}`;
  el.innerHTML = html;
}

async function run() {
  const t = TOOLS[current];
  if (busy || files.length < (t.min || 1)) return;
  busy = true;
  renderFiles();
  setStatus("loading", `<span class="spinner"></span> Sedang memproses, mohon tunggu…`);
  const form = new FormData();
  if (t.multiple) files.forEach((f) => form.append("files", f));
  else form.append("file", files[0]);
  try {
    const res = await fetch(t.endpoint, { method: "POST", body: form });
    if (!res.ok) {
      let msg = `Gagal (${res.status}).`;
      try { msg = (await res.json()).detail || msg; } catch (_) { /* abaikan */ }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const name = filenameFrom(res.headers.get("Content-Disposition")) || "hasil";
    const url = URL.createObjectURL(blob);
    triggerDownload(url, name);
    setStatus("success", `Selesai! File <b>${escapeHtml(name)}</b> sudah diunduh. <a href="${url}" download="${escapeHtml(name)}">Unduh lagi</a>`);
  } catch (err) {
    setStatus("error", escapeHtml(err.message || "Terjadi kesalahan."));
  } finally {
    busy = false;
    renderFiles();
  }
}

function filenameFrom(header) {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) return decodeURIComponent(star[1]);
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : null;
}

function triggerDownload(url, name) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function init() {
  $("year").textContent = new Date().getFullYear();
  renderGrid();
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
    renderFiles();
  });
  $("runBtn").addEventListener("click", run);
  window.addEventListener("hashchange", route);
  route();
}

init();
