// FactLens copy desk: posts the text to /analyze (webapp/app.py) and marks up the scored text in place.
// Samples are written for this demo; they are not real news articles.
(function () {
  "use strict";
  const SAMPLES = {
    wire: "City council approves transit budget\n\nThe city council voted 7-2 on Tuesday to approve a budget that increases funding for bus service and road repairs, officials said. The plan, which takes effect in January, was revised twice after public hearings, according to a statement from the mayor's office.",
    viral: "SHOCKING: They don't want you to see this!!\n\nYou won't believe what was hidden in the new transit budget. Share this before it gets deleted! Everyone is talking about it and the media is staying silent. Watch the video and decide for yourself what's really going on.",
    dateline: "WASHINGTON (Reuters) - SHOCKING: They don't want you to see this!!\n\nYou won't believe what was hidden in the new transit budget. Share this before it gets deleted! Everyone is talking about it and the media is staying silent. Watch the video and decide for yourself what's really going on.",
  };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pct = (p) => `${Math.round(p * 100)}%`;

  function setMode(marked) {
    $("m-edit").setAttribute("aria-pressed", String(!marked));
    $("m-marked").setAttribute("aria-pressed", String(marked));
    $("text").hidden = marked; $("marked").hidden = !marked;
  }

  // Mark every occurrence of the scored terms (unigrams and bigrams, as tokenized by TF-IDF: \b\w\w+\b, lowercase).
  function markup(text, hl) {
    const terms = [...hl.toward_fake.map((t) => ({ ...t, side: "fake" })), ...hl.toward_real.map((t) => ({ ...t, side: "real" }))].sort((a, b) => b.weight - a.weight);
    const strong = new Set([...hl.toward_fake.slice(0, 3), ...hl.toward_real.slice(0, 3)].map((t) => t.term));
    const taken = new Array(text.length).fill(false), marks = [];
    for (const t of terms) {
      const pat = t.term.split(" ").map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\W+");
      const re = new RegExp(`(?<![\\w])${pat}(?![\\w])`, "gi");
      let m;
      while ((m = re.exec(text))) {
        const s = m.index, e = s + m[0].length;
        if (taken.slice(s, e).some(Boolean)) continue;
        for (let i = s; i < e; i++) taken[i] = true;
        marks.push({ s, e, t });
      }
    }
    marks.sort((a, b) => a.s - b.s);
    let html = "", last = 0;
    for (const { s, e, t } of marks) {
      html += esc(text.slice(last, s));
      html += `<span class="mk ${t.side}${strong.has(t.term) ? " strong" : ""}" title="${esc(t.term)}: pushes toward ${t.side === "fake" ? "fake" : "real reporting"} (${t.weight.toFixed(3)})">${esc(text.slice(s, e))}</span>`;
      last = e;
    }
    html += esc(text.slice(last));
    return html.split(/\n\s*\n/).map((p) => `<p>${p.replace(/\n/g, "<br />")}</p>`).join("");
  }

  function margin(d) {
    const fake = d.label === "FAKE", p = fake ? d.fake_probability : d.real_probability;
    const list = (items, side) => items.length ? `<ul class="terms ${side}">${items.map((i) => `<li><span>${esc(i.term)}</span><span>${i.weight.toFixed(3)}</span></li>`).join("")}</ul>` : '<p class="conf">No strong signals.</p>';
    $("margin").innerHTML = `
      <div class="note"><h3>Verdict</h3>
        <span class="stamp ${fake ? "fake" : "real"}">${fake ? "Reads as fake" : "Reads as real"}</span>
        <div class="scale" aria-hidden="true"><i style="left:${d.fake_probability * 100}%"></i></div>
        <div class="scale-l"><span>Real ${pct(d.real_probability)}</span><span>Fake ${pct(d.fake_probability)}</span></div>
        <p class="conf">${pct(p)} confident about the writing style.</p></div>
      <div class="note"><h3>Marked in red</h3>${list(d.contributions.toward_fake, "fake")}</div>
      <div class="note"><h3>Marked in green</h3>${list(d.contributions.toward_real, "real")}</div>
      <div class="note"><h3>Closest topic</h3><p class="topic">${d.cluster_top_terms.slice(0, 6).map(esc).join(" · ")}</p></div>
      <div class="note"><p class="caveat">This is a judgment about style, not facts. Publisher cues such as datelines are removed before scoring, so "(Reuters)" can't vouch for a story. On fact-checked claims from another source the model scores 0.49 macro-F1. <a href="/about">Why</a></p></div>`;
  }

  async function analyze() {
    const text = $("text").value.trim();
    if (!text) { $("text").focus(); return; }
    $("go").disabled = true; $("go").textContent = "Reading…";
    try {
      const res = await fetch("/analyze", { method: "POST", body: new FormData($("form")) });
      const d = await res.json().catch(() => ({ error: "The server sent an unexpected reply." }));
      if (!res.ok) throw new Error(d.error || "Something went wrong.");
      $("marked").innerHTML = markup(d.scored_text, d.highlights);
      $("m-marked").disabled = false;
      setMode(true);
      $("slug").textContent = `Marked up · ${d.scored_text.split(/\s+/).length} words`;
      margin(d);
      if (window.innerWidth < 900) $("margin").scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      $("margin").innerHTML = `<div class="note"><p class="err">${esc(err.message)}</p></div>`;
    } finally {
      $("go").disabled = false; $("go").textContent = "Mark it up";
    }
  }

  $("form").addEventListener("submit", (e) => { e.preventDefault(); analyze(); });
  $("m-edit").addEventListener("click", () => { setMode(false); $("text").focus(); });
  $("m-marked").addEventListener("click", () => setMode(true));
  $("text").addEventListener("input", () => { $("m-marked").disabled = true; $("slug").textContent = "Draft · edited"; });
  $("text").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); analyze(); } });
  document.querySelectorAll(".sample").forEach((b) => b.addEventListener("click", () => { $("text").value = SAMPLES[b.dataset.sample]; setMode(false); analyze(); }));
})();
