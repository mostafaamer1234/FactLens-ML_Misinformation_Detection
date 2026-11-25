// Samples are written for this demo; they are not real news articles.
const SAMPLES = {
  wire: "City council approves transit budget\n\nThe city council voted 7-2 on Tuesday to approve a budget that increases funding for bus service and road repairs, officials said. The plan, which takes effect in January, was revised twice after public hearings, according to a statement from the mayor's office.",
  viral: "SHOCKING: They don't want you to see this!!\n\nYou won't believe what was hidden in the new transit budget. Share this before it gets deleted! Everyone is talking about it and the media is staying silent. Watch the video and decide for yourself what's really going on.",
  dateline: "WASHINGTON (Reuters) - SHOCKING: They don't want you to see this!!\n\nYou won't believe what was hidden in the new transit budget. Share this before it gets deleted! Everyone is talking about it and the media is staying silent. Watch the video and decide for yourself what's really going on.",
};

const $ = (id) => document.getElementById(id);
const pct = (p) => `${Math.round(p * 100)}%`;

function rows(items, color) {
  if (!items.length) return `<tr><td class="q-note">No strong signals in this text.</td></tr>`;
  const max = Math.max(...items.map((i) => i.weight));
  return items.map((i) => `
    <tr>
      <td><div class="q-bar"><i style="width:${Math.max(6, (i.weight / max) * 100)}%;background:${color}"></i><b>${i.term.replace(/[<>&]/g, "")}</b></div></td>
      <td>${i.weight.toFixed(3)}</td>
    </tr>`).join("");
}

document.querySelectorAll(".chip").forEach((chip) =>
  chip.addEventListener("click", () => { $("text").value = SAMPLES[chip.dataset.sample]; $("form").requestSubmit(); })
);

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const go = $("go");
  go.disabled = true; go.textContent = "Analyzing…";
  try {
    const res = await fetch("/analyze", { method: "POST", body: new FormData($("form")) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    const fake = data.label === "FAKE";
    const verdict = $("verdict");
    verdict.textContent = fake ? "Reads as fake." : "Reads as real.";
    verdict.className = `verdict-word ${fake ? "fake" : "real"}`;
    const p = fake ? data.fake_probability : data.real_probability;
    $("meter").style.width = pct(p);
    $("probs").textContent = `${pct(p)} confidence · fake ${pct(data.fake_probability)} · real ${pct(data.real_probability)}`;
    $("fake-terms").innerHTML = rows(data.contributions.toward_fake, "var(--bad)");
    $("real-terms").innerHTML = rows(data.contributions.toward_real, "var(--good)");
    $("topic").innerHTML = data.cluster_top_terms.slice(0, 6).map((t, i) => (i < 2 ? `<b>${t}</b>` : t)).join(" · ");
    $("result").hidden = false;
    $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    alert(err.message);
  } finally {
    go.disabled = false; go.textContent = "Analyze";
  }
});
