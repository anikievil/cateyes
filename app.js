/* ============ 代購貓 🐈‍⬛🐈 — 黑白雙貓使者（參考黃泉使者黑白無常）
   黑貓使者管「勾」：勾魂改勾單，採買清單見一件勾一件
   白貓使者管「財」：一見生財，對帳收款入袋 ============ */
/* 資料層獨立封裝（Storage），之後要換成雲端同步只需改這一層 */

"use strict";

/* ---------------- 資料層 ---------------- */
const Storage = {
  KEY: "cateyes-daigou-v1",
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return { version: 1, trips: [] };
      const data = JSON.parse(raw);
      if (!Array.isArray(data.trips)) data.trips = [];
      return data;
    } catch (e) {
      return { version: 1, trips: [] };
    }
  },
  save(data) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
  },
};

let db = Storage.load();
const persist = () => Storage.save(db);

const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2);

/* ---------------- 常數與工具 ---------------- */
const STATUS = {
  todo:    { label: "待購買", cls: "st-todo" },
  bought:  { label: "已買到", cls: "st-bought" },
  oos:     { label: "缺貨",   cls: "st-oos" },
  shipped: { label: "已寄出", cls: "st-shipped" },
  paid:    { label: "已收款", cls: "st-paid" },
};
const STATUS_ORDER = ["todo", "bought", "oos", "shipped", "paid"];

/* 角色對應的用詞：agent = 我是代購、client = 我是委託人 */
function labels(trip) {
  return trip.role === "client"
    ? { person: "代購人", personIntro: "幫我買的人", due: "應付", got: "已付", payAction: "標記已付款", paidWord: "已付款" }
    : { person: "委託人", personIntro: "託我買的人", due: "應收", got: "已收", payAction: "標記已收款", paidWord: "已收款" };
}
/* 狀態標籤依角色微調（委託人視角的 paid 顯示「已付款」） */
function statusLabel(trip, st) {
  if (st === "paid" && trip.role === "client") return "已付款";
  return STATUS[st].label;
}

function roleBadge(trip) {
  return trip.role === "client"
    ? `<span class="badge badge-client">我是委託人</span>`
    : `<span class="badge badge-agent">我是代購</span>`;
}

/* ---- 兩位貓使者（戴高帽，帽上一字明其職）---- */
/* 黑貓使者：帽書「勾」，管採買勾單 */
const catBlack = (cls = "cat-svg") => `
<svg class="${cls}" viewBox="0 0 100 128" aria-hidden="true">
  <path d="M50 3 L69 55 L31 55 Z" fill="#161616"/>
  <text x="50" y="48" font-size="17" font-weight="700" fill="#fff" text-anchor="middle">勾</text>
  <path d="M23 80 L13 56 L38 66 Z" fill="#161616"/>
  <path d="M77 80 L87 56 L62 66 Z" fill="#161616"/>
  <g stroke="#161616" stroke-width="2" stroke-linecap="round">
    <path d="M20 94 L4 90"/><path d="M20 100 L5 103"/>
    <path d="M80 94 L96 90"/><path d="M80 100 L95 103"/>
  </g>
  <circle cx="50" cy="97" r="29" fill="#161616"/>
  <circle cx="39" cy="92" r="4" fill="#fff"/>
  <circle cx="61" cy="92" r="4" fill="#fff"/>
  <path d="M44 106 q6 5 12 0" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>
</svg>`;
/* 白貓使者：帽書「財」，管對帳收款（一見生財）*/
const catWhite = (cls = "cat-svg") => `
<svg class="${cls}" viewBox="0 0 100 128" aria-hidden="true">
  <path d="M50 3 L69 55 L31 55 Z" fill="#fff" stroke="#161616" stroke-width="3" stroke-linejoin="round"/>
  <text x="50" y="48" font-size="17" font-weight="700" fill="#bf4136" text-anchor="middle">財</text>
  <path d="M23 80 L13 56 L38 66 Z" fill="#fff" stroke="#161616" stroke-width="3" stroke-linejoin="round"/>
  <path d="M77 80 L87 56 L62 66 Z" fill="#fff" stroke="#161616" stroke-width="3" stroke-linejoin="round"/>
  <g stroke="#161616" stroke-width="2" stroke-linecap="round">
    <path d="M20 94 L4 90"/><path d="M20 100 L5 103"/>
    <path d="M80 94 L96 90"/><path d="M80 100 L95 103"/>
  </g>
  <circle cx="50" cy="97" r="29" fill="#fff" stroke="#161616" stroke-width="3"/>
  <path d="M34 91 q5 5 10 0" stroke="#161616" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M56 91 q5 5 10 0" stroke="#161616" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M45 104 q5 4 10 0" stroke="#161616" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <rect x="47" y="106" width="6" height="9" rx="3" fill="#bf4136"/>
</svg>`;

/* 功能區的使者職守條 */
const dutyBar = (which) =>
  which === "black"
    ? `<div class="duty">${catBlack("cat-svg-sm")}<span><b>黑貓使者</b>・見一件，勾一件</span></div>`
    : `<div class="duty">${catWhite("cat-svg-sm")}<span><b>白貓使者</b>・一見生財，收齊入袋</span></div>`;

const money = (n) => "NT$" + Math.round(n).toLocaleString("zh-TW");
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function findTrip(id) {
  return db.trips.find((t) => t.id === id);
}

/* 代購費計算：item.feeMode = default(依檔期) / none / fixed / percent */
function itemFee(trip, item) {
  let mode = item.feeMode || "default";
  let value = item.feeValue || 0;
  if (mode === "default") {
    mode = trip.feeMode || "none";
    value = trip.feeValue || 0;
  }
  const base = (item.price || 0) * (item.qty || 1);
  if (mode === "fixed") return value * (item.qty || 1);
  if (mode === "percent") return Math.round((base * value) / 100);
  return 0;
}
function itemAmount(trip, item) {
  return (item.price || 0) * (item.qty || 1) + itemFee(trip, item);
}

function tripStats(trip) {
  const items = trip.items;
  const buyable = items.filter((i) => i.status !== "oos");
  const boughtDone = items.filter((i) => ["bought", "shipped", "paid"].includes(i.status));
  const total = buyable.reduce((s, i) => s + itemAmount(trip, i), 0);
  const paid = items.filter((i) => i.status === "paid").reduce((s, i) => s + itemAmount(trip, i), 0);
  return { count: items.length, buyableCount: buyable.length, boughtCount: boughtDone.length, total, paid };
}

function isClosed(trip) {
  if (!trip.deadline) return false;
  const today = new Date();
  const d = new Date(trip.deadline + "T23:59:59");
  return today > d;
}

function fmtDeadline(trip) {
  if (!trip.deadline) return "";
  const [y, m, d] = trip.deadline.split("-");
  return `${Number(m)}/${Number(d)} 收單`;
}

/* ---------------- UI 狀態 ---------------- */
const ui = {
  view: "home",       // home | trip
  tripId: null,
  tab: "shopping",    // shopping | bill | settings
  groupBy: "person",  // person | category
};

const $app = document.getElementById("app");
const $modalRoot = document.getElementById("modal-root");

/* ---------------- Toast ---------------- */
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 1800);
}

/* ---------------- Modal ---------------- */
function openModal(html) {
  $modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal">${html}</div></div>`;
  $modalRoot.querySelector(".modal-backdrop").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
}
function closeModal() {
  $modalRoot.innerHTML = "";
}

/* ---------------- 渲染：首頁 ---------------- */
function renderHome() {
  const cards = db.trips
    .map((trip) => {
      const st = tripStats(trip);
      const L = labels(trip);
      const closed = isClosed(trip);
      const pct = st.buyableCount ? Math.round((st.boughtCount / st.buyableCount) * 100) : 0;
      return `
      <div class="card trip-card clickable role-${trip.role === "client" ? "client" : "agent"}" data-open-trip="${trip.id}">
        <div class="trip-top">
          <h3>${esc(trip.name)}</h3>
          ${roleBadge(trip)}
          ${closed ? `<span class="badge badge-closed">已截止</span>` : ""}
        </div>
        <div class="trip-meta">
          <span>${trip.people.length} 位${L.person}</span>
          <span>${st.count} 項商品</span>
          ${trip.deadline ? `<span>${fmtDeadline(trip)}</span>` : ""}
        </div>
        <div class="trip-stats">
          <div class="stat">已買 <b>${st.boughtCount}</b> / ${st.buyableCount}</div>
          <div class="stat">${L.due} <b>${money(st.total)}</b></div>
          <div class="stat stat-good">${L.got} <b>${money(st.paid)}</b></div>
        </div>
        <div class="progress"><i style="width:${pct}%"></i></div>
      </div>`;
    })
    .join("");

  $app.innerHTML = `
    <header class="app-header">
      <div class="cat-duo">${catBlack()}${catWhite()}</div>
      <div>
        <h1>代購貓</h1>
        <div class="sub">黑貓勾單・白貓收財</div>
      </div>
      <div class="spacer"></div>
      <button class="btn btn-sm" data-action="backup">備份</button>
    </header>
    ${
      db.trips.length
        ? cards
        : `<div class="empty">
             <div class="cat-duo cat-duo-lg">${catBlack("cat-svg-lg")}${catWhite("cat-svg-lg")}</div>
             <h3>黑白雙貓使者聽候差遣</h3>
             <p>黑貓管勾單、白貓管收財。建立第一個代購檔期吧！</p>
           </div>`
    }
    <button class="fab" data-action="new-trip">＋ 新增檔期</button>
  `;
}

/* ---------------- 渲染：檔期頁 ---------------- */
function renderTrip() {
  const trip = findTrip(ui.tripId);
  if (!trip) {
    ui.view = "home";
    return render();
  }
  const L = labels(trip);
  const closed = isClosed(trip);

  let body = "";
  if (ui.tab === "shopping") body = renderShopping(trip, L);
  else if (ui.tab === "bill") body = renderBill(trip, L);
  else body = renderSettings(trip, L);

  $app.innerHTML = `
    <header class="app-header">
      <button class="back-btn" data-action="go-home">←</button>
      <div style="min-width:0">
        <h1 style="font-size:1.15rem">${esc(trip.name)}</h1>
        <div class="sub">
          ${trip.role === "client" ? "我是委託人" : "我是代購"}
          ${trip.deadline ? ` · ${fmtDeadline(trip)}${closed ? "（已截止）" : ""}` : ""}
        </div>
      </div>
    </header>
    <div class="tabs">
      <button class="${ui.tab === "shopping" ? "active" : ""}" data-tab="shopping">採買清單</button>
      <button class="${ui.tab === "bill" ? "active" : ""}" data-tab="bill">對帳</button>
      <button class="${ui.tab === "settings" ? "active" : ""}" data-tab="settings">設定</button>
    </div>
    ${body}
    ${ui.tab === "shopping" ? `<button class="fab" data-action="new-item">＋ 新增商品</button>` : ""}
  `;
}

/* --- 採買清單 tab --- */
function renderShopping(trip, L) {
  if (!trip.items.length) {
    return `<div class="empty">
      ${catBlack("cat-svg-lg")}
      <h3>黑貓使者待命中</h3>
      <p>清單空空。先新增${L.personIntro}與商品，逛街時見一件勾一件。</p>
    </div>`;
  }

  const personName = (id) => trip.people.find((p) => p.id === id)?.name || "（未指定）";

  /* 分組 */
  const groups = new Map();
  for (const item of trip.items) {
    const key =
      ui.groupBy === "person" ? personName(item.personId) : item.category?.trim() || "未分類";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const statusRank = (s) => STATUS_ORDER.indexOf(s);
  const blocks = [...groups.entries()]
    .map(([name, items]) => {
      items.sort((a, b) => statusRank(a.status) - statusRank(b.status));
      const sum = items.filter((i) => i.status !== "oos").reduce((s, i) => s + itemAmount(trip, i), 0);
      const rows = items
        .map((item) => {
          const fee = itemFee(trip, item);
          const sub = [];
          if (item.spec) sub.push(esc(item.spec));
          if (ui.groupBy === "category") sub.push("〔" + esc(personName(item.personId)) + "〕");
          else if (item.category) sub.push("🏷️ " + esc(item.category));
          if (item.link) sub.push(`<a href="${esc(item.link)}" target="_blank" rel="noopener" data-stop>🔗 連結</a>`);
          if (item.note) sub.push(esc(item.note));
          const options = STATUS_ORDER.map(
            (s) => `<option value="${s}" ${item.status === s ? "selected" : ""}>${statusLabel(trip, s)}</option>`
          ).join("");
          return `
          <div class="item-row ${item.status === "oos" ? "done-oos" : ""}">
            <div class="item-main" data-edit-item="${item.id}">
              <div class="item-name">${esc(item.name)} <span class="qty">×${item.qty || 1}</span></div>
              ${sub.length ? `<div class="item-sub">${sub.join("<span>·</span>")}</div>` : ""}
            </div>
            <div class="item-right">
              <div class="item-amount">${money(itemAmount(trip, item))}${
                fee ? `<small>含代購費 ${money(fee)}</small>` : ""
              }</div>
              <select class="status-pill ${STATUS[item.status].cls}" data-status-item="${item.id}">${options}</select>
            </div>
          </div>`;
        })
        .join("");
      return `
      <div class="group-block">
        <div class="group-head">
          <h3>${esc(name)}</h3>
          <span class="group-sum">${items.length} 項 · ${money(sum)}</span>
        </div>
        ${rows}
      </div>`;
    })
    .join("");

  return `
    <div class="seg-row">
      ${dutyBar("black")}
      <div class="seg">
        <button class="${ui.groupBy === "person" ? "active" : ""}" data-group="person">按${L.person}</button>
        <button class="${ui.groupBy === "category" ? "active" : ""}" data-group="category">按分類</button>
      </div>
    </div>
    ${blocks}
  `;
}

/* --- 對帳 tab --- */
function renderBill(trip, L) {
  if (!trip.people.length) {
    return `<div class="empty">
      ${catWhite("cat-svg-lg")}
      <h3>白貓使者候財中</h3>
      <p>還沒有${L.person}。新增商品時可以順便建立${L.personIntro}。</p>
    </div>`;
  }
  const st = tripStats(trip);

  const cards = trip.people
    .map((p) => {
      const items = trip.items.filter((i) => i.personId === p.id);
      const valid = items.filter((i) => i.status !== "oos");
      const total = valid.reduce((s, i) => s + itemAmount(trip, i), 0);
      const paidSum = valid.filter((i) => i.status === "paid").reduce((s, i) => s + itemAmount(trip, i), 0);
      const allPaid = valid.length > 0 && valid.every((i) => i.status === "paid");
      const lines = items
        .map((item) => {
          const isOos = item.status === "oos";
          const isPaid = item.status === "paid";
          return `
          <div class="bill-line ${isPaid ? "paid" : ""}">
            <div class="bl-name">${esc(item.name)} ×${item.qty || 1}${isOos ? "（缺貨）" : ""}</div>
            <div class="bl-amt">
              ${isOos ? `<span class="mini-badge st-oos">缺貨</span>` : `<b>${money(itemAmount(trip, item))}</b>`}
              ${
                isOos
                  ? ""
                  : `<button class="btn btn-sm ${isPaid ? "" : "btn-primary"}" data-toggle-paid="${item.id}">${
                      isPaid ? "取消" : L.got
                    }</button>`
              }
            </div>
          </div>`;
        })
        .join("");
      return `
      <div class="card bill-card">
        <div class="bill-head">
          <h3>${esc(p.name)}</h3>
          <span class="bill-total">${money(total)}</span>
        </div>
        <div class="bill-summary">${L.got} ${money(paidSum)} / 未${trip.role === "client" ? "付" : "收"} ${money(total - paidSum)}</div>
        <div class="bill-lines">${lines || `<div class="bill-line"><span class="bl-name" style="color:var(--ink-soft)">尚無商品</span></div>`}</div>
        <div class="bill-actions">
          ${
            valid.length && !allPaid
              ? `<button class="btn btn-sm btn-primary" data-payall-person="${p.id}">全部${L.paidWord}</button>`
              : ""
          }
          <button class="btn btn-sm" data-copy-bill="${p.id}">📋 複製對帳文字</button>
        </div>
      </div>`;
    })
    .join("");

  return `
    ${dutyBar("white")}
    <div class="grand-total">
      <span class="gt-label">整檔${L.due}總計</span>
      <span class="gt-nums"><b>${money(st.total)}</b> · ${L.got} ${money(st.paid)} · 未${trip.role === "client" ? "付" : "收"} <b>${money(st.total - st.paid)}</b></span>
    </div>
    ${cards}
  `;
}

/* --- 設定 tab --- */
function renderSettings(trip, L) {
  const feeText =
    trip.feeMode === "fixed"
      ? `統一每件 ${money(trip.feeValue || 0)}`
      : trip.feeMode === "percent"
      ? `統一售價 ${trip.feeValue || 0}%`
      : "不收（或個別設定）";
  const peopleRows = trip.people
    .map((p) => {
      const count = trip.items.filter((i) => i.personId === p.id).length;
      return `
      <div class="card">
        <div class="settings-row">
          <div class="sr-main">
            <div class="sr-title">${esc(p.name)}</div>
            <div class="sr-sub">${count} 項商品${p.note ? " · " + esc(p.note) : ""}</div>
          </div>
          <button class="btn btn-sm" data-edit-person="${p.id}">編輯</button>
          <button class="btn btn-sm btn-danger" data-del-person="${p.id}">刪除</button>
        </div>
      </div>`;
    })
    .join("");

  return `
    <div class="card">
      <div class="settings-row">
        <div class="sr-main">
          <div class="sr-title">檔期資訊</div>
          <div class="sr-sub">代購費：${feeText}${trip.deadline ? ` · ${fmtDeadline(trip)}` : ""}</div>
        </div>
        <button class="btn btn-sm" data-action="edit-trip">編輯</button>
      </div>
    </div>

    <div class="section-label">${L.person.toUpperCase()}（${L.personIntro}）</div>
    <div class="settings-list">
      ${peopleRows || `<div class="empty" style="padding:20px"><p>還沒有${L.person}</p></div>`}
    </div>
    <button class="btn btn-block" data-action="new-person">＋ 新增${L.person}</button>

    <div class="section-label">資料</div>
    <button class="btn btn-block" data-action="backup">📤 備份全部資料（下載 JSON）</button>
    <div style="height:8px"></div>
    <button class="btn btn-block" data-action="restore">📥 還原備份</button>
    <div style="height:8px"></div>
    <button class="btn btn-block btn-danger" data-action="delete-trip">🗑️ 刪除這個檔期</button>
  `;
}

/* ---------------- 表單：檔期 ---------------- */
function tripFormModal(trip) {
  const isNew = !trip;
  const t = trip || { name: "", role: "agent", deadline: "", feeMode: "none", feeValue: 0 };
  openModal(`
    <h2>${isNew ? "新增檔期" : "編輯檔期"}</h2>
    <form id="trip-form">
      <div class="field">
        <label>檔期名稱</label>
        <input type="text" name="name" required placeholder="例：2026/8 東京行" value="${esc(t.name)}" />
      </div>
      <div class="field">
        <label>我的角色</label>
        <div class="radio-cards">
          <label><input type="radio" name="role" value="agent" ${t.role !== "client" ? "checked" : ""} />我是代購<br><small>幫別人買</small></label>
          <label><input type="radio" name="role" value="client" ${t.role === "client" ? "checked" : ""} />我是委託人<br><small>請別人買</small></label>
        </div>
      </div>
      <div class="field">
        <label>截止收單日（可留空）</label>
        <input type="date" name="deadline" value="${esc(t.deadline)}" />
      </div>
      <div class="field">
        <label>代購費（統一設定，商品可個別覆寫）</label>
        <div class="radio-cards">
          <label><input type="radio" name="feeMode" value="none" ${t.feeMode === "none" || !t.feeMode ? "checked" : ""} />不收</label>
          <label><input type="radio" name="feeMode" value="fixed" ${t.feeMode === "fixed" ? "checked" : ""} />每件固定</label>
          <label><input type="radio" name="feeMode" value="percent" ${t.feeMode === "percent" ? "checked" : ""} />售價 %</label>
        </div>
      </div>
      <div class="field" id="fee-value-field" ${t.feeMode === "fixed" || t.feeMode === "percent" ? "" : "hidden"}>
        <label id="fee-value-label">${t.feeMode === "percent" ? "百分比（%）" : "每件金額（台幣）"}</label>
        <input type="number" name="feeValue" min="0" step="any" inputmode="decimal" value="${t.feeValue || ""}" placeholder="0" />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close>取消</button>
        <button type="submit" class="btn btn-primary">${isNew ? "建立" : "儲存"}</button>
      </div>
    </form>
  `);
  const form = document.getElementById("trip-form");
  form.addEventListener("change", (e) => {
    if (e.target.name === "feeMode") {
      const mode = form.feeMode.value;
      document.getElementById("fee-value-field").hidden = mode === "none";
      document.getElementById("fee-value-label").textContent =
        mode === "percent" ? "百分比（%）" : "每件金額（台幣）";
    }
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = {
      name: fd.get("name").trim(),
      role: fd.get("role"),
      deadline: fd.get("deadline") || "",
      feeMode: fd.get("feeMode"),
      feeValue: Number(fd.get("feeValue")) || 0,
    };
    if (!data.name) return;
    if (isNew) {
      db.trips.unshift({ id: uid(), ...data, createdAt: Date.now(), people: [], items: [] });
      persist();
      closeModal();
      ui.view = "trip";
      ui.tripId = db.trips[0].id;
      ui.tab = "shopping";
      render();
      toast("檔期已建立 🎉");
    } else {
      Object.assign(trip, data);
      persist();
      closeModal();
      render();
      toast("已儲存");
    }
  });
}

/* ---------------- 表單：委託人/代購人 ---------------- */
function personFormModal(trip, person, onDone) {
  const L = labels(trip);
  const isNew = !person;
  const p = person || { name: "", note: "" };
  openModal(`
    <h2>${isNew ? "新增" : "編輯"}${L.person}</h2>
    <form id="person-form">
      <div class="field">
        <label>名字</label>
        <input type="text" name="name" required placeholder="例：小美" value="${esc(p.name)}" />
      </div>
      <div class="field">
        <label>備註（可留空）</label>
        <input type="text" name="note" placeholder="例：公司同事、LINE ID…" value="${esc(p.note)}" />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close>取消</button>
        <button type="submit" class="btn btn-primary">${isNew ? "新增" : "儲存"}</button>
      </div>
    </form>
  `);
  document.getElementById("person-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = fd.get("name").trim();
    if (!name) return;
    if (isNew) {
      const np = { id: uid(), name, note: fd.get("note").trim() };
      trip.people.push(np);
      persist();
      closeModal();
      if (onDone) return onDone(np);
      render();
      toast("已新增");
    } else {
      person.name = name;
      person.note = fd.get("note").trim();
      persist();
      closeModal();
      render();
      toast("已儲存");
    }
  });
}

/* ---------------- 表單：商品 ----------------
   item = null 表示新增；prefill 用於「中途去新增委託人」回來時還原已填的草稿 */
function itemFormModal(trip, item, prefill) {
  const L = labels(trip);
  if (!trip.people.length && !item) {
    /* 還沒有委託人 → 先建一位，建完自動回到商品表單 */
    toast(`先新增一位${L.person}`);
    personFormModal(trip, null, () => itemFormModal(trip, null));
    return;
  }
  const isNew = !item;
  const it = prefill || item || {
    personId: trip.people[0]?.id || "",
    name: "", spec: "", qty: 1, price: "", category: "", link: "", note: "",
    feeMode: "default", feeValue: 0, status: "todo",
  };
  const personOptions =
    trip.people
      .map((p) => `<option value="${p.id}" ${it.personId === p.id ? "selected" : ""}>${esc(p.name)}</option>`)
      .join("") + `<option value="__new__">＋ 新增${L.person}…</option>`;
  const statusOptions = STATUS_ORDER.map(
    (s) => `<option value="${s}" ${it.status === s ? "selected" : ""}>${statusLabel(trip, s)}</option>`
  ).join("");
  const feeModes = [
    ["default", "依檔期設定"],
    ["none", "不收"],
    ["fixed", "固定金額"],
    ["percent", "售價 %"],
  ];
  openModal(`
    <h2>${isNew ? "新增商品" : "編輯商品"}</h2>
    <form id="item-form">
      <div class="field">
        <label>${L.person}</label>
        <select name="personId">${personOptions}</select>
      </div>
      <div class="field">
        <label>品名</label>
        <input type="text" name="name" required placeholder="例：合利他命 EX Plus 270 錠" value="${esc(it.name)}" />
      </div>
      <div class="field">
        <label>規格 / 顏色 / 尺寸（可留空）</label>
        <input type="text" name="spec" placeholder="例：白色 M 號" value="${esc(it.spec)}" />
      </div>
      <div class="field-row">
        <div class="field">
          <label>數量</label>
          <input type="number" name="qty" min="1" step="1" inputmode="numeric" required value="${it.qty || 1}" />
        </div>
        <div class="field">
          <label>單價（台幣）</label>
          <input type="number" name="price" min="0" step="any" inputmode="decimal" placeholder="0" value="${it.price ?? ""}" />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>代購費</label>
          <select name="feeMode">${feeModes
            .map(([v, lb]) => `<option value="${v}" ${(it.feeMode || "default") === v ? "selected" : ""}>${lb}</option>`)
            .join("")}</select>
        </div>
        <div class="field" id="item-fee-value" ${it.feeMode === "fixed" || it.feeMode === "percent" ? "" : "hidden"}>
          <label>${it.feeMode === "percent" ? "％" : "每件金額"}</label>
          <input type="number" name="feeValue" min="0" step="any" inputmode="decimal" value="${it.feeValue || ""}" placeholder="0" />
        </div>
      </div>
      <div class="field">
        <label>分類 / 店家（可留空，採買時可依此分組）</label>
        <input type="text" name="category" placeholder="例：驚安殿堂、藥妝" value="${esc(it.category)}" list="category-list" />
        <datalist id="category-list">
          ${[...new Set(trip.items.map((i) => i.category).filter(Boolean))]
            .map((c) => `<option value="${esc(c)}"></option>`)
            .join("")}
        </datalist>
      </div>
      <div class="field">
        <label>參考連結（可留空）</label>
        <input type="url" name="link" placeholder="https://…" value="${esc(it.link)}" />
      </div>
      <div class="field">
        <label>備註（可留空）</label>
        <input type="text" name="note" value="${esc(it.note)}" />
      </div>
      ${
        isNew
          ? ""
          : `<div class="field">
              <label>狀態</label>
              <select name="status">${statusOptions}</select>
            </div>`
      }
      <div class="modal-actions">
        ${isNew ? "" : `<button type="button" class="btn btn-danger" data-del-item="${it.id}">刪除</button>`}
        <button type="button" class="btn btn-ghost" data-close>取消</button>
        <button type="submit" class="btn btn-primary">${isNew ? "新增" : "儲存"}</button>
      </div>
    </form>
  `);
  const form = document.getElementById("item-form");
  form.addEventListener("change", (e) => {
    if (e.target.name === "feeMode") {
      const mode = form.feeMode.value;
      const fld = document.getElementById("item-fee-value");
      fld.hidden = !(mode === "fixed" || mode === "percent");
      fld.querySelector("label").textContent = mode === "percent" ? "％" : "每件金額";
    }
    if (e.target.name === "personId" && e.target.value === "__new__") {
      /* 暫存已填的內容，建完人再帶著草稿回到本表單 */
      const draft = readItemForm(form, it);
      closeModal();
      personFormModal(trip, null, (np) => {
        draft.personId = np.id;
        itemFormModal(trip, item, draft);
      });
    }
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = readItemForm(form, it);
    if (!data.name) return;
    if (data.personId === "__new__") return;
    if (isNew) {
      trip.items.push({ id: uid(), ...data, status: "todo", createdAt: Date.now() });
      persist();
      closeModal();
      render();
      toast("商品已新增");
    } else {
      Object.assign(item, data);
      persist();
      closeModal();
      render();
      toast("已儲存");
    }
  });
}

function readItemForm(form, base) {
  const fd = new FormData(form);
  return {
    personId: fd.get("personId"),
    name: (fd.get("name") || "").trim(),
    spec: (fd.get("spec") || "").trim(),
    qty: Math.max(1, parseInt(fd.get("qty"), 10) || 1),
    price: Number(fd.get("price")) || 0,
    feeMode: fd.get("feeMode") || "default",
    feeValue: Number(fd.get("feeValue")) || 0,
    category: (fd.get("category") || "").trim(),
    link: (fd.get("link") || "").trim(),
    note: (fd.get("note") || "").trim(),
    status: fd.get("status") || base.status || "todo",
  };
}

/* ---------------- 對帳文字 ---------------- */
function billText(trip, person) {
  const L = labels(trip);
  const items = trip.items.filter((i) => i.personId === person.id && i.status !== "oos");
  const oos = trip.items.filter((i) => i.personId === person.id && i.status === "oos");
  let lines = [`🐾 ${trip.name} — ${person.name} 的${trip.role === "client" ? "代購" : "委託"}明細`];
  items.forEach((item, idx) => {
    const spec = item.spec ? `（${item.spec}）` : "";
    lines.push(`${idx + 1}. ${item.name}${spec} ×${item.qty || 1} — ${money(itemAmount(trip, item))}`);
  });
  if (oos.length) {
    lines.push(`—— 以下缺貨未計 ——`);
    oos.forEach((item) => lines.push(`✕ ${item.name} ×${item.qty || 1}`));
  }
  const total = items.reduce((s, i) => s + itemAmount(trip, i), 0);
  lines.push(`——`);
  lines.push(`合計 ${money(total)}`);
  return lines.join("\n");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("已複製，貼到 LINE 就能對帳 📋");
  } catch (e) {
    /* 舊瀏覽器 fallback */
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    toast("已複製 📋");
  }
}

/* ---------------- 備份 / 還原 ---------------- */
function backup() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  a.href = url;
  a.download = `代購貓備份-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("已下載備份檔");
}

function restore() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.trips)) throw new Error("格式不對");
        if (!confirm("還原會覆蓋目前所有資料，確定嗎？")) return;
        db = data;
        persist();
        ui.view = "home";
        render();
        toast("還原完成 ✅");
      } catch (e) {
        alert("這個檔案不是有效的代購貓備份檔");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

/* ---------------- 事件委派 ---------------- */
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-action],[data-open-trip],[data-tab],[data-group],[data-edit-item],[data-toggle-paid],[data-payall-person],[data-copy-bill],[data-edit-person],[data-del-person],[data-del-item],[data-close],[data-stop]");
  if (!t) return;

  if (t.dataset.stop !== undefined) return; /* 連結等：不攔截 */

  if (t.dataset.close !== undefined) return closeModal();

  const trip = ui.tripId ? findTrip(ui.tripId) : null;

  if (t.dataset.action === "new-trip") return tripFormModal(null);
  if (t.dataset.action === "go-home") {
    ui.view = "home";
    ui.tripId = null;
    return render();
  }
  if (t.dataset.action === "backup") return backup();
  if (t.dataset.action === "restore") return restore();
  if (t.dataset.action === "edit-trip" && trip) return tripFormModal(trip);
  if (t.dataset.action === "new-person" && trip) return personFormModal(trip, null);
  if (t.dataset.action === "new-item" && trip) return itemFormModal(trip, null);
  if (t.dataset.action === "delete-trip" && trip) {
    if (confirm(`確定刪除「${trip.name}」？裡面的 ${trip.items.length} 項商品也會一併刪除。`)) {
      db.trips = db.trips.filter((x) => x.id !== trip.id);
      persist();
      ui.view = "home";
      ui.tripId = null;
      render();
      toast("已刪除");
    }
    return;
  }

  if (t.dataset.openTrip) {
    ui.view = "trip";
    ui.tripId = t.dataset.openTrip;
    ui.tab = "shopping";
    return render();
  }
  if (t.dataset.tab) {
    ui.tab = t.dataset.tab;
    return render();
  }
  if (t.dataset.group) {
    ui.groupBy = t.dataset.group;
    return render();
  }
  if (t.dataset.editItem && trip) {
    const item = trip.items.find((i) => i.id === t.dataset.editItem);
    if (item) itemFormModal(trip, item);
    return;
  }
  if (t.dataset.togglePaid && trip) {
    const item = trip.items.find((i) => i.id === t.dataset.togglePaid);
    if (item) {
      if (item.status === "paid") {
        item.status = item.prevStatus && item.prevStatus !== "paid" ? item.prevStatus : "bought";
      } else {
        item.prevStatus = item.status;
        item.status = "paid";
      }
      persist();
      render();
    }
    return;
  }
  if (t.dataset.payallPerson && trip) {
    trip.items
      .filter((i) => i.personId === t.dataset.payallPerson && i.status !== "oos" && i.status !== "paid")
      .forEach((i) => {
        i.prevStatus = i.status;
        i.status = "paid";
      });
    persist();
    render();
    toast(labels(trip).paidWord + " ✅");
    return;
  }
  if (t.dataset.copyBill && trip) {
    const person = trip.people.find((p) => p.id === t.dataset.copyBill);
    if (person) copyText(billText(trip, person));
    return;
  }
  if (t.dataset.editPerson && trip) {
    const person = trip.people.find((p) => p.id === t.dataset.editPerson);
    if (person) personFormModal(trip, person);
    return;
  }
  if (t.dataset.delPerson && trip) {
    const person = trip.people.find((p) => p.id === t.dataset.delPerson);
    if (!person) return;
    const count = trip.items.filter((i) => i.personId === person.id).length;
    if (confirm(`確定刪除「${person.name}」？${count ? `底下 ${count} 項商品也會一併刪除。` : ""}`)) {
      trip.people = trip.people.filter((p) => p.id !== person.id);
      trip.items = trip.items.filter((i) => i.personId !== person.id);
      persist();
      render();
      toast("已刪除");
    }
    return;
  }
  if (t.dataset.delItem && trip) {
    const item = trip.items.find((i) => i.id === t.dataset.delItem);
    if (item && confirm(`確定刪除「${item.name}」？`)) {
      trip.items = trip.items.filter((i) => i.id !== item.id);
      persist();
      closeModal();
      render();
      toast("已刪除");
    }
    return;
  }
});

/* 狀態下拉選單（採買清單上的 pill） */
document.addEventListener("change", (e) => {
  const sel = e.target.closest("[data-status-item]");
  if (!sel) return;
  const trip = findTrip(ui.tripId);
  if (!trip) return;
  const item = trip.items.find((i) => i.id === sel.dataset.statusItem);
  if (!item) return;
  item.status = sel.value;
  persist();
  render();
});

/* Esc 關閉 modal */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

/* ---------------- 入口 ---------------- */
function render() {
  if (ui.view === "trip") renderTrip();
  else renderHome();
}
render();
