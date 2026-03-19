// Popup HTML templates (dark theme)

function wrapCard(headerHtml, bodyHtml) {
  return `
    <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; background: rgba(17, 24, 39, 0.96); color: #e5e7eb; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.35);">
      ${headerHtml}
      <div style="padding: 12px;">${bodyHtml}</div>
    </div>
  `;
}

export function analyzingPopup(zonesCount, isCached) {
  const header = `
    <div style="background: linear-gradient(90deg, #111827 0%, #0b1220 100%); padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.08);">
      <div style="font-size: 12px; letter-spacing: .03em; text-transform: uppercase; color: #9ca3af;">Pinal County Infrastructure</div>
      <div style="font-size: 14px; font-weight: 600; color: #f3f4f6;">Arizona Infrastructure Development</div>
    </div>`;
  const body = `
    <div style="font-size: 12px; color:#cbd5e1;">Analyzing infrastructure across <strong style=\"color:#f3f4f6;\">${zonesCount}</strong> zones…</div>
    ${isCached ? '<div style="margin-top:6px; font-size: 11px; color: #9ca3af;">Cached data available. Hold Ctrl or Shift and click to refresh.</div>' : ''}
  `;
  return wrapCard(header, body);
}

export function analysisCompletePopup(stats) {
  const header = `
    <div style="background: linear-gradient(90deg, #111827 0%, #0b1220 100%); padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.08);">
      <div style="font-size: 12px; letter-spacing: .03em; text-transform: uppercase; color: #9ca3af;">Pinal County Infrastructure</div>
      <div style="font-size: 14px; font-weight: 600; color: #f3f4f6;">Arizona Infrastructure Development</div>
    </div>`;
  const body = `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
      <span style="display:inline-block; width:8px; height:8px; border-radius:9999px; background:#10b981;"></span>
      <span style="font-size:12px; font-weight:600; color:#34d399;">Analysis Complete</span>
    </div>
    <div style="font-size:12px; color:#cbd5e1; line-height:1.5;">
      Found <strong style="color:#f3f4f6;">${stats.features}</strong> features across <strong style="color:#f3f4f6;">${stats.zones}</strong> zones
    </div>
    <div style="margin-top:6px; font-size:11px; color:#9ca3af; line-height:1.5;">
      Commercial development: <span style="color:#e5e7eb;">${stats.commercial}</span><br>
      Government facilities: <span style="color:#e5e7eb;">${stats.gov}</span><br>
      High development potential: <span style="color:#e5e7eb;">${stats.highDev}</span>
    </div>
  `;
  return wrapCard(header, body);
}

export function zonePopup(name, subtitle) {
  const header = `
    <div style="background: linear-gradient(90deg, #111827 0%, #0b1220 100%); padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.08);">
      <div style="font-size: 13px; font-weight: 600; color: #f3f4f6;">${name}</div>
    </div>`;
  const body = `<div style="font-size: 11px; color: #cbd5e1;">${subtitle}</div>`;
  return wrapCard(header, body);
}


