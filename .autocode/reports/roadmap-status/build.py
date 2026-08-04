#!/usr/bin/env python3
"""Regenerate report.html from data.json + template.html.

Usage: python3 build.py
Edit data.json, then re-run. Output is written to report.html in this
same directory. Re-publish it with the Artifact tool using the fixed
URL recorded in the project memory (reference_investor_roadmap_report.md).
"""
import html as _html
import json
import re
from pathlib import Path

HERE = Path(__file__).parent
TEMPLATE = HERE / "template.html"
DATA = HERE / "data.json"
FONTS = HERE / "fonts"
OUT = HERE / "report.html"


def esc(s):
    return _html.escape(str(s), quote=False)


def replace_balanced(src, open_tag_re, tag_name, new_inner):
    """Replace the inner HTML of the first element matched by open_tag_re,
    tracking nested <tag_name> depth to find the real matching close tag."""
    m = re.search(open_tag_re, src)
    if not m:
        raise ValueError(f"open tag not found: {open_tag_re}")
    start = m.end()
    token_re = re.compile(rf"<{tag_name}\b|</{tag_name}>", re.I)
    depth = 1
    pos = start
    while depth > 0:
        tm = token_re.search(src, pos)
        if not tm:
            raise ValueError(f"unbalanced <{tag_name}> while scanning for close")
        if tm.group(0).startswith("</"):
            depth -= 1
            if depth == 0:
                close_start = tm.start()
                break
        else:
            depth += 1
        pos = tm.end()
    return src[:start] + new_inner + src[close_start:]


def replace_simple(src, pattern, new_inner, flags=re.S):
    """Non-greedy replace for elements with no nested same-tag children (e.g. tbody)."""
    m = re.search(pattern, src, flags)
    if not m:
        raise ValueError(f"pattern not found: {pattern}")
    return src[: m.start(1)] + new_inner + src[m.end(1) :]


# ---------- section renderers ----------

def render_stats(stats):
    out = []
    for s in stats:
        unit = f'<span class="unit">{esc(s["unit"])}</span>' if s["unit"] else ""
        out.append(f"""
      <div class="stat-tile">
        <div class="stat-value num">{esc(s["value"])}{unit}</div>
        <div class="stat-label">{esc(s["label"])}</div>
      </div>""")
    return "".join(out)


CHECK_ICON = '<svg viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>'
DOT_ICON = '<svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="currentColor"/></svg>'
RING_ICON = '<svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>'
STATUS_ICON = {"done": CHECK_ICON, "attn": DOT_ICON, "idle": RING_ICON}


def render_phases(phases):
    out = []
    for p in phases:
        bar_class = "" if p["status"] == "done" else f' {p["status"]}'
        bar_pct = max(p["pct"], 2)  # keep a sliver visible even at 0%
        icon = STATUS_ICON[p["status"]]
        out.append(f"""
      <div class="phase-row">
        <div class="phase-n">{p["n"]}</div>
        <div class="phase-main">
          <div class="phase-name">{esc(p["name"])}</div>
          <div class="phase-desc">{esc(p["desc"])}</div>
        </div>
        <div class="phase-bar-wrap">
          <div class="bar-track{bar_class}"><div class="bar-fill" style="width:{bar_pct}%"></div></div>
        </div>
        <div class="phase-pct">{p["pct"]}%<div class="pill {p["status"]}" style="margin-top:6px">{icon}{esc(p["statusLabel"])}</div></div>
      </div>""")
    return "".join(out)


def bullet_row(label, sub, cards, target, scale, is_total=False):
    fill_pct = min(cards / scale * 100, 100)
    target_pct = min(target / scale * 100, 100)
    over = cards > target
    fill_class = "bullet-fill over" if over else "bullet-fill"
    pct_of_target = round(cards / target * 100)
    row_class = "bullet-row bullet-total" if is_total else "bullet-row"
    return f"""
      <div class="{row_class}">
        <div class="bullet-label">{esc(label)}<span class="lv-sub">{esc(sub)}</span></div>
        <div class="bullet-track">
          <div class="{fill_class}" style="width:{fill_pct:.1f}%" title="{cards:,} of {target:,} cards — {pct_of_target}%"></div>
          <div class="bullet-target" style="left:{target_pct:.1f}%"></div>
        </div>
        <div class="bullet-figs"><b>{pct_of_target}%</b><br>{cards:,} / {target:,}</div>
      </div>"""


def render_bullets(content):
    # each row scales to its OWN target + 12% headroom, so the target tick always
    # sits at the same ~89% mark and every bar reads as "% of this level's own goal" —
    # not a shared absolute-card-count scale, which would visually bury the smaller levels
    levels = content["levels"]
    total = content["total"]
    rows = [
        bullet_row(l["code"], l["unitsLabel"], l["cards"], l["target"], l["target"] * 1.12)
        for l in levels
    ]
    rows.append(
        bullet_row("Total", total["unitsLabel"], total["cards"], total["target"], total["target"] * 1.12, is_total=True)
    )
    return "".join(rows)


def traj_cell(t, domain):
    lo, hi = domain
    values = t["values"]
    n = len(values)
    xs = [20, 140] if n == 2 else [20, 80, 140]
    top_y, bot_y = 6, 50
    rng = hi - lo
    scale = (bot_y - top_y) / rng

    def y(v):
        return round(bot_y - (v - lo) * scale, 1)

    pts = list(zip(xs, [y(v) for v in values]))
    poly = " ".join(f"{x},{yv}" for x, yv in pts)
    dots = []
    for i, (x, yv) in enumerate(pts):
        r = 3.2 if i == len(pts) - 1 else (2.6 if i == 0 else 2.4)
        dots.append(f'<circle class="traj-dot" cx="{x}" cy="{yv}" r="{r}"/>')
    delta = round(values[-1] - values[0])
    start_label = f'<text class="traj-num" x="{xs[0]}" y="{pts[0][1] + 11:.0f}">{values[0]:g}</text>'
    end_y = pts[-1][1] - 6
    end_label = f'<text class="traj-num-end" x="{xs[-1]}" y="{end_y:.0f}" text-anchor="end">{values[-1]:g}</text>'
    return f"""
      <div class="traj-cell">
        <div class="traj-head"><span class="traj-level">{esc(t["code"])}</span><span class="traj-delta">+{delta} pts</span></div>
        <div class="traj-chart">
          <svg viewBox="0 0 160 56" preserveAspectRatio="xMidYMid meet" role="img" aria-label="{esc(t["code"])} pedagogical rigor moved from {values[0]:g} to {values[-1]:g} across {esc(t["rounds"])}">
            <polyline class="traj-line" points="{poly}"/>
            {''.join(dots)}
            {start_label}
            {end_label}
          </svg>
        </div>
        <div class="traj-foot">{esc(t["dateRange"])} · {esc(t["rounds"])}</div>
      </div>"""


def render_trajectory(trajectory, domain):
    return "".join(traj_cell(t, domain) for t in trajectory)


def render_quality_table(rows):
    out = []
    for r in rows:
        cls = ' class="total-row"' if r.get("isTotal") else ""
        rounds = r["rounds"]
        rounds_str = f"{rounds:g}" if isinstance(rounds, float) else str(rounds)
        out.append(f"""
        <tr{cls}><td>{esc(r["level"])}</td><td class="num">{rounds_str}</td><td class="num">{r["rigor"]} / 100</td><td class="num">{r["voice"]} / 100</td></tr>""")
    return "".join(out)


def render_wc_bars(bars):
    out = []
    for b in bars:
        out.append(f"""
        <div class="wc-bar-row">
          <div>
            <div class="wc-bar-label">{esc(b["label"])}
              <span class="wc-bar-note">{esc(b["note"])}</span>
            </div>
            <div class="wc-bar-track"><div class="wc-bar-fill" style="width:{b["value"]}%"></div></div>
          </div>
          <div class="wc-bar-val num">{b["value"]}</div>
        </div>""")
    return "".join(out)


def render_wc_footline(items):
    return "".join(
        f'\n      <span><b>{esc(i["value"])}</b> {esc(i["label"])}</span>' for i in items
    )


def render_blockers(blockers):
    out = []
    for b in blockers:
        out.append(f"""
      <div class="blocker">
        <div class="blocker-mark"></div>
        <div>
          <div class="blocker-title">{esc(b["title"])}</div>
          <div class="blocker-desc">{esc(b["desc"])}</div>
        </div>
        <div class="blocker-action">Owner action<br>needed</div>
      </div>""")
    return "".join(out)


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    src = TEMPLATE.read_text(encoding="utf-8")

    src = replace_balanced(src, r'<div class="stat-strip">', "div", render_stats(data["stats"]))
    src = replace_balanced(src, r'<div class="phase-list">', "div", render_phases(data["phases"]))
    src = replace_balanced(src, r'<div class="bullet-list">', "div", render_bullets(data["content"]))
    src = replace_balanced(src, r'<div class="traj-grid">', "div", render_trajectory(data["trajectory"], data["trajectoryDomain"]))
    src = replace_simple(src, r'<tbody>(.*?)</tbody>', render_quality_table(data["qualityTable"]))
    src = replace_balanced(src, r'<div class="wc-bars">', "div", render_wc_bars(data["worldclass"]["bars"]))
    src = replace_balanced(src, r'<div class="wc-footline">', "div", render_wc_footline(data["worldclass"]["footline"]))
    src = replace_balanced(src, r'<div class="blocker-list">', "div", render_blockers(data["blockers"]))

    # scalar substitutions
    src = replace_simple(src, r'<div class="wc-score num">(.*?)</div>', f'{data["worldclass"]["score"]}<span class="of100">/100</span>')
    src = replace_simple(src, r'<span><b>Prepared</b> ([^<]*)</span>', esc(data["preparedDate"]))
    src = replace_simple(src, r'<span><b>Covers</b> ([^<]*)</span>', esc(data["coversLine"]))
    src = replace_simple(src, r'<span>Prepared ([^<]*) — confidential</span>', esc(data["preparedDate"]))
    src = replace_simple(
        src,
        r'Methodology —</b>\s*(.*?)\s*</p>',
        esc(data["phaseMethodology"]),
    )
    src = replace_simple(
        src,
        r'<p class="lede" style="margin-top:26px;">\s*(.*?)\s*</p>',
        esc(data["content"]["note"]),
    )

    # embed fonts
    fonts = {
        "{{FONT_SANS}}": (FONTS / "plexsans-var.b64").read_text().strip(),
        "{{FONT_MONO_400}}": (FONTS / "plexmono-400.b64").read_text().strip(),
        "{{FONT_MONO_500}}": (FONTS / "plexmono-500.b64").read_text().strip(),
        "{{FONT_MONO_600}}": (FONTS / "plexmono-600.b64").read_text().strip(),
    }
    for k, v in fonts.items():
        assert k in src, f"missing font placeholder {k}"
        src = src.replace(k, v)

    assert "{{" not in src, "unresolved placeholder remains"
    OUT.write_text(src, encoding="utf-8")
    print(f"wrote {OUT} ({len(src):,} bytes)")


if __name__ == "__main__":
    main()
