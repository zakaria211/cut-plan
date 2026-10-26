"use strict";
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = { get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
                set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- icons (one 2px stroke family, 24 grid) ---------- */
const ICON = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  skip: '<path d="M7 6l8 6-8 6zM17 6v12"/>',
  link: '<path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/>',
  flag: '<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>',
};
const icon = (n, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

/* ---------- data ---------- */
const DATA = window.FOOD, PL = window.PLAN, DEMO = window.DEMO;
const phase = () => store.get("phase", "A");
const dayEx = (d) => d.ex.all || d.ex[phase()];
const dayTitle = (d) => (d.title && d.title[phase()]) || d.name;
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.ceil(s) % 60)).padStart(2, "0")}`;
const minutes = (list) => Math.round(list.reduce((t, x) => t + x.sets * (45 + x.rest), 0) / 60 / 5) * 5;
const SLOT = { ftour: "Ftour", ghda: "Ghda", "3sha": "3sha" };
const recipeById = {};
for (const [slot, list] of Object.entries(DATA.meals)) list.forEach((r) => (recipeById[r.id] = { ...r, slot }));

const demoName = (id, alt) => DEMO[id][alt ? 1 : 0];
const still = (id, alt) => `<img src="demo/${demoName(id, alt)}-0.webp" alt="" loading="lazy">`;
function demo(id, alt) {
  const n = demoName(id, alt);
  return `<img class="bg" src="demo/${n}-0.webp" alt=""><img class="f0" src="demo/${n}-0.webp" alt="Start position"><img class="f1" src="demo/${n}-1.webp" alt="End position">`;
}

/* ---------- training state (sets done this session) ---------- */
const done = {};
const exKey = (n, i) => `${n}-${phase()}-${i}`;
const dots = (n, i, x) => Array.from({ length: x.sets }, (_, k) => `<i class="${k < (done[exKey(n, i)] || 0) ? "on" : ""}"></i>`).join("");

/* ---------- views ---------- */
function viewTrain() {
  const ph = phase();
  return `<header class="page"><h1>Train</h1><p class="meta">Pick today's session. Each day once a week, in any order.</p></header>
    <ol class="days stagger">${PL.days.map((d, i) => {
      const list = dayEx(d);
      return `<li style="--i:${i}"><a class="dayrow press" href="#/day/${d.n}">
        <span class="dthumb" style="view-transition-name: ex-${d.n}-0">${still(list[0].id)}</span>
        <span class="rt"><b>${esc(dayTitle(d))}</b><small>${d.where} · ${list.length} exercises · ~${minutes(list)} min</small></span>
        ${icon("next", "chev")}</a></li>`;
    }).join("")}</ol>
    <section class="phase">
      <h2>Knee phase</h2>
      <div class="seg" role="tablist" aria-label="Knee phase">${Object.entries(PL.phases).map(([k, p]) =>
        `<button role="tab" aria-selected="${k === ph}" data-phase="${k}" class="press">${esc(p.name)}</button>`).join("")}</div>
      <p class="note">${esc(PL.phases[ph].when)}. ${esc(PL.phases[ph].note)}</p>
    </section>
    <p class="foot">Max 2 training days in a row, at least 2 rest days a week.</p>`;
}

function viewDay(n) {
  const d = PL.days[n - 1]; if (!d) return viewTrain();
  const list = dayEx(d), ph = phase();
  return `<header class="bar"><a class="iconbtn press" href="#/train" aria-label="Back">${icon("back")}</a>
      <div><h1>${esc(dayTitle(d))}</h1><p class="meta">Day ${n} · ${d.where} · ~${minutes(list)} min</p></div></header>
    ${d.ex.all ? "" : `<p class="note caution">Phase ${ph}, ${esc(PL.phases[ph].name)}: ${esc(PL.phases[ph].note)}</p>`}
    <ol class="rail stagger">${list.map((x, i) => `<li style="--i:${i}"><a class="row press" href="#/ex/${n}/${i}">
      <span class="idx">${i + 1}</span>
      <span class="thumb" style="view-transition-name: ex-${n}-${i}">${still(x.id)}</span>
      <span class="rt"><b>${esc(EX[x.id].name)}</b><small>${x.sets} × ${esc(x.reps)} · ${x.rest ? "rest " + mmss(x.rest) : "superset"}</small>
        <span class="dots">${dots(n, i, x)}</span></span>${icon("next", "chev")}</a></li>`).join("")}</ol>
    <p class="foot">Stop 0–3 reps before failure (RIR). When every set hits the top of the range, add the smallest weight next time [B].</p>`;
}

const altOn = {};
function viewEx(n, i) {
  const d = PL.days[n - 1], list = d && dayEx(d), x = list && list[i];
  if (!x) return viewDay(n);
  const e = EX[x.id], key = exKey(n, i), alt = !!altOn[key], k = done[key] || 0, full = k >= x.sets;
  const prev = list[i - 1], next = list[i + 1];
  const reps = String(x.reps).match(/^(\d+)(.*)$/);
  return `<header class="bar thin"><a class="iconbtn press" href="#/day/${n}" aria-label="Back to day ${n}">${icon("back")}</a>
      <p class="meta">${esc(dayTitle(d))} · ${i + 1} of ${list.length}</p></header>
    <div class="stage demo" style="view-transition-name: ex-${n}-${i}" data-swipe>${demo(x.id, alt)}
      <span class="ev ev-${e.ev}" title="Evidence level">Evidence ${e.ev}</span></div>
    <div class="seg two" role="tablist" aria-label="Exercise version">
      <button role="tab" class="press" data-alt="0" aria-selected="${!alt}">Main</button>
      <button role="tab" class="press" data-alt="1" aria-selected="${alt}">Backup</button></div>
    <h1 class="exname">${esc(alt ? e.alt : e.name)}</h1>
    ${(alt ? e.altNote : e.demoNote) ? `<p class="note">${esc(alt ? e.altNote : e.demoNote)}</p>` : ""}
    ${alt ? `<p class="note">Use it when the main one isn't possible or it hurts. Same sets and reps.</p>` : ""}
    <dl class="dose">
      <div><dt>Sets</dt><dd data-count="${x.sets}">${x.sets}</dd></div>
      <div><dt>Reps</dt><dd>${reps ? `<span data-count="${reps[1]}">${reps[1]}</span>${esc(reps[2])}` : esc(x.reps)}</dd></div>
      <div><dt>RIR</dt><dd>${esc(x.rir)}</dd></div>
      <div><dt>Rest</dt><dd>${x.rest ? mmss(x.rest) : "—"}</dd></div></dl>
    ${x.note ? `<p class="note caution">${esc(x.note)}</p>` : ""}
    <ul class="cues stagger">${e.cues.map((c, j) => `<li style="--i:${j}">${esc(c)}</li>`).join("")}</ul>
    <div class="setbar"><span class="dots big" aria-label="${k} of ${x.sets} sets done">${dots(n, i, x)}</span>
      <button class="btn primary press grow" data-set ${full ? "disabled" : ""}>${full ? `${icon("check")} All ${x.sets} sets done`
        : x.rest ? `Set ${k + 1} done · rest ${mmss(x.rest)}` : `Set ${k + 1} done · superset`}</button></div>
    <nav class="exnav">${prev ? `<a class="press" href="#/ex/${n}/${i - 1}">${icon("back")}<span>${esc(EX[prev.id].name)}</span></a>` : "<span></span>"}
      ${next ? `<a class="press nx" href="#/ex/${n}/${i + 1}"><span>${esc(EX[next.id].name)}</span>${icon("next")}</a>`
        : `<a class="press nx" href="#/day/${n}"><span>Day overview</span>${icon("next")}</a>`}</nav>`;
}

// food photos first: drinks and dairy are heavy in grams but make dull covers
const LIQUID = /lben|milk|raibi|yogurt|oil/;
const fan = (r, k = 3) => r.ing.filter((i) => !/oil/.test(i.name)).sort((a, b) => LIQUID.test(a.name) - LIQUID.test(b.name) || b.g - a.g).slice(0, k)
  .map((i) => `<img src="img/${i.img}.webp" alt="" loading="lazy">`).join("");

function viewFood(slotKey) {
  const slot = SLOT[slotKey] || "Ftour", t = DATA.slots[slot];
  return `<header class="page"><h1>Food</h1><p class="meta">Any ftour + ghda + 3sha ≈ 1850 kcal, 150 g protein or more, about 40 MAD a day (≈ 1200 MAD a month) with the free chicken.</p></header>
    <div class="seg three" role="tablist" aria-label="Meal">${Object.entries(SLOT).map(([k, s]) =>
      `<a role="tab" class="press" aria-selected="${s === slot}" href="#/food/${k}">${s}</a>`).join("")}</div>
    <p class="note">${{ Ftour: "07:30", Ghda: "13:30", "3sha": "20:30" }[slot]} · each ${slot} ≈ ${t.kcal} kcal, ${t.p} g protein${slot === "Ftour" ? "" : ", with 150 g raw chicken"}.</p>
    <ol class="recipes stagger">${DATA.meals[slot].map((r, i) => `<li style="--i:${i}"><a class="rrow press" href="#/r/${r.id}">
      <span class="fan" style="view-transition-name: r-${r.id}">${fan(r)}</span>
      <span class="rt"><b>${esc(r.name)}</b><small><span class="nw"><em>${r.kcal}</em> kcal</span> · <span class="nw"><em>${r.p}</em> g protein</span> · <span class="nw"><em>${r.cost}</em> MAD</span> · <span class="nw">${r.time} min</span></small></span>
      ${icon("next", "chev")}</a></li>`).join("")}</ol>
    <section class="snacks"><h2>Optional snack, about 150 kcal</h2><ul>${DATA.snacks.map((s) =>
      `<li><span>${esc(s.name)}</span><small><em>${s.kcal}</em> kcal · <em>${s.p}</em> g P</small></li>`).join("")}</ul></section>`;
}

const ingLabel = (i) => i.n ? `${i.n} ${i.name.replace("egg (whole)", i.n > 1 ? "eggs" : "egg").replace("egg white", i.n > 1 ? "egg whites" : "egg white")}` : i.name;

function viewRecipe(id) {
  const r = recipeById[id]; if (!r) return viewFood("ftour");
  const slotKey = Object.keys(SLOT).find((k) => SLOT[k] === r.slot);
  const kP = r.p * 4, kF = r.f * 9, kC = r.c * 4, kT = kP + kF + kC;
  const chicken = r.ing.some((i) => i.name.startsWith("chicken"));
  return `<header class="rhero">
      <div class="mosaic" style="view-transition-name: r-${r.id}">${fan(r, 3)}</div>
      <a class="iconbtn float press" href="#/food/${slotKey}" aria-label="Back">${icon("back")}</a>
      <div class="rh-copy"><h1>${esc(r.name)}</h1><p class="meta">${r.slot} · ${r.time} min · about ${r.cost} MAD</p></div></header>
    <section class="macros">
      <div class="kcal"><b data-count="${r.kcal}">${r.kcal}</b><span>kcal</span></div>
      <div class="split" role="img" aria-label="Protein ${r.p} g, fat ${r.f} g, carbs ${r.c} g">
        <span class="bar"><i class="p" style="--w:${(kP / kT * 100).toFixed(1)}%"></i><i class="f" style="--w:${(kF / kT * 100).toFixed(1)}%"></i><i class="c" style="--w:${(kC / kT * 100).toFixed(1)}%"></i></span>
        <span class="legend"><span><i class="p"></i>Protein <b>${r.p} g</b></span><span><i class="f"></i>Fat <b>${r.f} g</b></span><span><i class="c"></i>Carbs <b>${r.c} g</b></span></span>
      </div></section>
    <h2 class="sec">Ingredients</h2>
    <ul class="ings stagger">${r.ing.map((i, k) => `<li style="--i:${k}"><img src="img/${i.img}.webp" alt="" width="120" height="120" loading="lazy">
      <b>${i.g} g</b><span>${esc(ingLabel(i))}</span></li>`).join("")}</ul>
    <p class="tip">${chicken ? "Weigh the chicken raw. " : "1 egg white ≈ 33 g. "}Oil by spoon: 5 g = 1 tsp, 10 g = 1 tbsp. Spices, garlic, herbs and lemon are free.</p>
    <h2 class="sec">How to cook</h2>
    <ol class="steps">${r.steps.map((s, k) => `<li class="reveal"><span class="sn">${k + 1}</span><p>${esc(s)}</p></li>`).join("")}</ol>`;
}

const BUY = [
  ["Door pull-up bar", "≈ 128 MAD", "https://jumia.ma/generic-barre-fixe-de-traction-horizontale-pour-porte-65451604.html", "Jumia"],
  ["Door pull-up bar", "≈ 99 MAD", "https://www.marjanemall.ma/p/ABBC10001271219316", "Marjane Mall"],
  ["Band set with handles + door anchor", "≈ 148 MAD", "https://www.jumia.ma/generic-bandes-de-resistance-elastiques-11-pieces-equipement-de-fitness-yoga-corde-de-traction-tubes-de-pilates-67289073.html", "Jumia"],
  ["Pull-up assist band 11–29 kg", "≈ 89 MAD", "https://www.jumia.ma/pakka-bande-de-resistance-musculation-11-29-kg-25-65-lbs-elastique-fitness-durable-entrainement-force-cross-training-tractions-portable-et-polyvalent-unisexe-68334836.html", "Jumia"],
  ["Creatine monohydrate 300 g", "≈ 197 MAD", "https://www.marjanemall.ma/p/AAANU67417", "Marjane Mall"],
];

// daily timing, built around sleep 00:00-07:00
const DAY = {
  normal: [["07:00", "Wake up", "500 ml water"], ["07:30", "Ftour", "Creatine 5 g with it [A]"], ["08:00", "Coffee", "Black. Morning training: train 1–2 h after ftour"],
    ["11:00", "Coffee", "Optional"], ["13:30", "Ghda", "~4–5 h after ftour keeps protein spread over the day [B]"],
    ["15:30", "Last coffee", "8 h or more before sleep [B]"], ["17:00", "Snack", "Optional, ~150 kcal"],
    ["20:30", "3sha", "3 h or more before bed [C]"], ["23:00", "Wind down", "Dim light, phone away [C]"], ["00:00", "Sleep", "7 h. 23:30 is better if you can [B]"]],
};
function viewTiming() {
  const now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
  const list = DAY.normal, toM = (t) => +t.slice(0, 2) * 60 + +t.slice(3);
  const next = list.findIndex(([t]) => toM(t) >= mins && toM(t) !== 0);
  return `<section class="block"><h2>Daily timing</h2>
    <ol class="timeline">${list.map(([t, a, b], i) => `<li class="${i === next ? "now" : ""}"><time>${t}</time><span><b>${a}</b><small>${b}</small></span></li>`).join("")}</ol></section>`;
}
const evk = (html) => html.replace(/\[([ABCV])\]/g, '<span class="evk" title="Evidence level">$1</span>');
function viewPlan() {
  const S = DATA.slots, rows = (arr) => arr.map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join("");
  return evk(`<header class="page"><h1>Plan</h1></header>
    <section class="target">
      <div class="kcal huge"><b data-count="2000">2000</b><span>kcal a day</span></div>
      <div class="split"><span class="bar"><i class="p" style="--w:30%"></i><i class="f" style="--w:27%"></i><i class="c" style="--w:43%"></i></span>
        <span class="legend"><span><i class="p"></i>Protein <b>150 g</b></span><span><i class="f"></i>Fat <b>60 g</b></span><span><i class="c"></i>Carbs <b>215 g</b></span></span></div>
      <p class="small">Burn ≈ 2500 (BMR 1757). Deficit ≈ 500, so about 0.5 kg a week [B]. Fiber 30 g or more.</p></section>
    ${viewTiming()}
    <section class="block"><h2>Meals</h2><ul class="kv">${rows([["Ftour", `${S.Ftour.kcal} kcal · ${S.Ftour.p} g P`], ["Ghda", `${S.Ghda.kcal} kcal · ${S.Ghda.p} g P`], ["3sha", `${S["3sha"].kcal} kcal · ${S["3sha"].p} g P`], ["Snack, optional", "≈ 150 kcal"]])}</ul></section>
    <section class="block"><h2>Body</h2><ul class="kv">${rows([["Now", "78 kg · 18–21 % [V]"], ["2 months ago", "75 kg · ~13 % [V]"], ["Goal", "~75 kg in 6–8 weeks"]])}</ul>
      <p class="small">Muscle stayed; the +3 kg is mostly fat and water. Focus: waist fat (diet and steps), side delts, lats, upper chest, rear delts. Training the belly does not burn belly fat [A].</p></section>
    <section class="block"><h2>Rules</h2><ul class="list">
      <li>Weigh chicken raw: 150 g at ghda, 150 g at 3sha.</li><li>Oil by spoon: 5 g = 1 tsp, 10 g = 1 tbsp.</li>
      <li>Weigh every morning, judge by the weekly average [B].</li><li>Under 0.3 kg a week for 2 weeks: cut 40 g bread or rice, or walk 2000 more steps.</li>
      <li>One flexible meal a week: up to 1000 kcal, at least 40 g protein [C].</li></ul></section>
    <section class="block"><h2>Every day</h2><ul class="list">
      <li>Sleep 00:00–07:00, aim for 7–9 h [B].</li><li>Steps: 6k now, then +1k each week up to 8–10k [B].</li><li>Creatine 3–5 g, any time [A].</li>
      <li>Coffee: 2–3 cups black, the last one 8 h before bed [B].</li><li>Water 2.5–3 L [C].</li></ul></section>
    <section class="block"><h2>Buy</h2><ul class="buy">${BUY.map(([n, p, u, s]) =>
      `<li><a class="press" href="${u}" target="_blank" rel="noopener"><span><b>${n}</b><small>${s}</small></span><em>${p}</em>${icon("link")}</a></li>`).join("")}</ul>
      <p class="small">Prices from the listings; check before ordering.</p></section>
    <details class="credits"><summary>Evidence key and photo credits</summary>
      <p>[A] strong (meta-analyses) · [B] moderate (controlled trials) · [C] limited (small studies, expert view) · [V] estimate from your photos.</p>
      <p>Exercise photos: free-exercise-db by yuhonas (Unlicense, public domain).</p>
      <ul>${Object.values(DATA.credits).map((c) => `<li><a href="${c.url}" target="_blank" rel="noopener">${esc(c.file.replace("File:", ""))}</a> · ${esc(c.author)} · ${esc(c.license)}</li>`).join("")}</ul></details>`);
}

/* ---------- motion helpers ---------- */
function countUp(root) {
  root.querySelectorAll("[data-count]").forEach((el) => {
    const to = +el.dataset.count; if (REDUCED || !to) return;
    const t0 = performance.now();
    const step = (now) => { const p = Math.min(1, (now - t0) / 900); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 4))); if (p < 1) requestAnimationFrame(step); };
    el.textContent = "0"; requestAnimationFrame(step);
  });
}
const revealer = "IntersectionObserver" in window && !REDUCED
  ? new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), revealer.unobserve(e.target))), { rootMargin: "0px 0px -12% 0px" })
  : null;
function reveal(root) { root.querySelectorAll(".reveal").forEach((el) => (revealer ? revealer.observe(el) : el.classList.add("in"))); }

/* ---------- rest timer: the screen fills with light that drains with the countdown ---------- */
const T = { key: null, end: 0, total: 0, raf: 0, wake: null };
const restEl = $("#rest");
let actx;
function audio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch {} return actx; }
function beep() {
  const a = audio();
  if (a) [0, 0.26, 0.52].forEach((t, i) => {
    const o = a.createOscillator(), g = a.createGain();
    o.frequency.value = i === 2 ? 1175 : 880; o.connect(g); g.connect(a.destination);
    g.gain.setValueAtTime(0.0001, a.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.3, a.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t + 0.2);
    o.start(a.currentTime + t); o.stop(a.currentTime + t + 0.22);
  });
  navigator.vibrate?.([180, 90, 180]);
}
function startRest(n, i, x) {
  audio();
  const key = exKey(n, i), k = done[key] || 0, e = EX[x.id];
  T.key = key; T.total = x.rest; T.end = performance.now() + x.rest * 1000;
  restEl.querySelectorAll(".rl").forEach((el) => (el.textContent = e.name));
  restEl.querySelectorAll(".up").forEach((el) => (el.textContent = `${k} of ${x.sets} sets done · ` + (k < x.sets ? `next: set ${k + 1}` : "next exercise")));
  $(".rest-bg", restEl).src = `demo/${demoName(x.id, altOn[key])}-0.webp`;
  restEl.style.setProperty("--left", 1);
  restEl.querySelectorAll(".big").forEach((b) => (b.textContent = mmss(x.rest)));
  restEl.hidden = false; restEl.classList.remove("out");
  navigator.wakeLock?.request("screen").then((w) => (T.wake = w)).catch(() => {});
  cancelAnimationFrame(T.raf); T.raf = requestAnimationFrame(loop);
  $(".base .skip", restEl).focus({ preventScroll: true });
}
function loop(now) {
  const left = (T.end - now) / 1000;
  if (left <= 0) return stopRest(true);
  restEl.style.setProperty("--left", Math.min(1, left / T.total).toFixed(4));
  restEl.querySelectorAll(".big").forEach((b) => (b.textContent = mmss(left)));
  T.raf = requestAnimationFrame(loop);
}
function stopRest(finished) {
  cancelAnimationFrame(T.raf); T.key = null; T.wake?.release?.(); T.wake = null;
  if (finished) beep();
  restEl.classList.add("out");
  setTimeout(() => { if (!T.key) restEl.hidden = true; }, REDUCED ? 0 : 420);
}
restEl.addEventListener("click", (ev) => {
  if (ev.target.closest(".add")) { T.end += 15000; T.total += 15; }
  else if (ev.target.closest(".skip")) stopRest(false);
});
document.addEventListener("visibilitychange", () => { if (!document.hidden && T.key) loop(performance.now()); });

/* ---------- router ---------- */
const main = $("#main");
let shown = "", shownTab = "";
function route() {
  const h = location.hash.replace(/^#\/?/, "").split("/");
  const tab = { day: "train", ex: "train", r: "food" }[h[0]] || h[0] || "train";
  const html = h[0] === "day" ? viewDay(+h[1]) : h[0] === "ex" ? viewEx(+h[1], +h[2]) : h[0] === "food" ? viewFood(h[1])
    : h[0] === "r" ? viewRecipe(h[1]) : h[0] === "plan" ? viewPlan() : viewTrain();
  const key = location.hash, sameTab = tab === shownTab;
  const swap = () => {
    shownTab = tab;
    if (!sameTab) { main.classList.remove("tabin"); void main.offsetWidth; main.classList.add("tabin"); }
    $(".tabs").style.setProperty("--t", ["train", "food", "plan"].indexOf(tab));
    shown = key;
    main.innerHTML = html; window.scrollTo(0, 0);
    document.querySelectorAll(".tabs a").forEach((a) => a.setAttribute("aria-current", a.dataset.tab === tab ? "page" : "false"));
    countUp(main); reveal(main);
  };
  if (!shown || !sameTab || !document.startViewTransition || REDUCED) return swap();
  const vt = document.startViewTransition(swap);
  vt.ready.catch(() => {});
  vt.finished.catch(() => {}).finally(() => shown !== key && swap()); // transition aborted: still render
}
addEventListener("hashchange", route);

main.addEventListener("click", (ev) => {
  const ph = ev.target.closest("[data-phase]");
  if (ph) { store.set("phase", ph.dataset.phase); return route(); }
  const h = location.hash.split("/"), n = +h[2], i = +h[3];
  if (h[1] !== "ex") return;
  const alt = ev.target.closest("[data-alt]");
  if (alt) { altOn[exKey(n, i)] = alt.dataset.alt === "1"; return route(); }
  if (ev.target.closest("[data-set]")) {
    const x = dayEx(PL.days[n - 1])[i], key = exKey(n, i);
    done[key] = Math.min((done[key] || 0) + 1, x.sets);
    if (x.rest) startRest(n, i, x);
    route();
  }
});

// swipe the demo to move between exercises
let sx = null;
main.addEventListener("touchstart", (e) => { sx = e.target.closest("[data-swipe]") ? e.touches[0].clientX : null; }, { passive: true });
main.addEventListener("touchend", (e) => {
  if (sx == null) return;
  const dx = e.changedTouches[0].clientX - sx; sx = null;
  if (Math.abs(dx) < 60) return;
  const link = $(dx < 0 ? ".exnav .nx" : ".exnav a:not(.nx)", main);
  if (link) location.hash = link.getAttribute("href");
});

route();
if ("serviceWorker" in navigator && location.hostname !== "localhost") navigator.serviceWorker.register("sw.js").catch(() => {});
