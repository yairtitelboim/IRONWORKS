import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

const SOURCE_ID = 'council-signals-colossus-source';
const LABELS_LAYER_ID = 'council-signals-colossus-labels';
const PARTICLES_SOURCE_ID = 'council-signals-colossus-particles';
const PARTICLES_LAYER_ID = 'council-signals-colossus-particles-layer';
const GEOJSON_URL = '/data/memphis_council_pdfs/council_signals_colossus_geocoded.geojson';
const KEYWORD_MENTIONS_URL = '/data/memphis_council_pdfs/council_keyword_mentions_top8.json';
const KEYWORD_WORDCLOUD_URL = '/data/memphis_council_pdfs/council_keyword_mentions_wordcloud.json';
const HITS_REPORT_URL = '/data/memphis_council_pdfs/hits_report_last18mo_top120.json';
const WORDCLOUD_TOP_N = 40;

const TEARDROP_COLOR = '#8b5cf6';

/** Aggregate keyword counts from hits report into wordcloud format (top N by weight). */
function aggregateWordcloudFromHitsReport(report, topN = WORDCLOUD_TOP_N) {
  const totals = {};
  for (const item of report?.items || []) {
    for (const [kw, count] of Object.entries(item.hits || {})) {
      if (typeof count === 'number' && count > 0) totals[kw] = (totals[kw] || 0) + count;
    }
  }
  const sorted = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);
  return { data: sorted.map(([text, weight]) => ({ text, weight })) };
}

const PARTICLE_IDLE_COUNT = 8;
const PARTICLE_IDLE_RADIUS_M = 70;
const PARTICLE_IDLE_SPEED = 0.0008;
const PARTICLE_ACTIVE_COUNT = 14;
const PARTICLE_ACTIVE_RADIUS_M = 110;
const PARTICLE_ACTIVE_SPEED = 0.0025;

const POPUP_DELAY_MS = 280;
const POPUP_OFFSET_UP = 53;

function injectCouncilSignalsPopupStyles() {
  if (typeof document === 'undefined') return;
  const id = 'council-signals-popup-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    .council-popup-card { position: relative; min-height: 60px; overflow: hidden; box-sizing: border-box; max-width: 100%; }
    .council-popup-close {
      position: absolute; top: 8px; right: 8px; width: 18px; height: 18px;
      border: none; border-radius: 4px; background: rgba(255,255,255,0.12);
      color: #9ca3af; cursor: pointer; font-size: 12px; line-height: 1;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, color 0.15s; z-index: 2;
    }
    .council-popup-close:hover { background: rgba(255,255,255,0.2); color: #fff; }
    .council-popup-skeleton {
      position: absolute; inset: 0; padding: 12px 16px; box-sizing: border-box;
      animation: council-skeleton-out 0.5s ease-out forwards;
    }
    .council-skeleton-line { height: 12px; border-radius: 4px; background: linear-gradient(90deg, rgba(255,255,255,0.08) 25%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.08) 75%); background-size: 200% 100%; animation: council-skeleton-shimmer 1s ease-in-out infinite; margin-bottom: 8px; }
    .council-skeleton-line.title { height: 16px; width: 80%; margin-bottom: 12px; }
    .council-skeleton-line.badges { width: 55%; height: 10px; }
    @keyframes council-skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    @keyframes council-skeleton-out { 0% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; pointer-events: none; } }
    .council-popup-content { opacity: 0; animation: council-content-in 0.35s ease-out 0.5s forwards; max-width: 100%; min-width: 0; overflow: hidden; box-sizing: border-box; }
    @keyframes council-content-in { from { opacity: 0; } to { opacity: 1; } }
    .council-chart-title { font-weight: 600; font-size: 14px; color: #f9fafb; margin-bottom: 8px; }
    .council-bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 11px; }
    .council-bar-label { min-width: 90px; color: #e5e7eb; }
    .council-bar-track { flex: 1; height: 10px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; }
    .council-bar-fill { height: 100%; width: 0; background: linear-gradient(90deg, #8b5cf6, #a78bfa); border-radius: 4px; transition: width 0.5s ease-out; }
    .council-bar-value { min-width: 36px; color: #94a3b8; font-weight: 600; text-align: right; }
    .council-chart-more { display: none; }
    .council-chart-more.is-open { display: block; }
    .council-chart-buttons { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; align-items: center; justify-content: flex-start; }
    .council-chart-toggle,
    .council-chart-wordcloud-btn {
      padding: 2px 6px; font-size: 10px; line-height: 1; border: none;
      background: none; color: #a78bfa; cursor: pointer; margin: 0;
      font-family: inherit; vertical-align: middle;
    }
    .council-chart-toggle:hover,
    .council-chart-wordcloud-btn:hover { color: #c4b5fd; }
    .council-viz-wordcloud { display: none; flex-wrap: wrap; gap: 6px 10px; align-items: center; align-content: flex-start; margin-top: 4px; line-height: 1.4; width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; }
    .council-viz-wordcloud.is-open { display: flex; }
    .council-wordcloud-first-row { width: 100%; flex: 0 0 100%; margin-bottom: 2px; }
    .council-viz-chart.is-hidden { display: none; }
    .council-popup-header.is-hidden { display: none; }
    .council-word-tag { color: #a78bfa; font-weight: 500; white-space: nowrap; }
    .council-word-tag:hover { color: #c4b5fd; }
    .council-word-tag-clickable { cursor: pointer; }
    .council-word-tag-inline { white-space: nowrap; display: inline; cursor: pointer; opacity: 0; }
    .council-word-tag-count { font-size: 0.7em; font-weight: normal; color: #94a3b8; margin-left: 1px; }
.council-wordcloud-words .council-wordcloud-count { opacity: 0; width: 100%; flex: 0 0 100%; margin-top: 4px; }
.council-wordcloud-words.is-visible .council-word-tag-inline,
.council-wordcloud-words.is-visible .council-wordcloud-count { animation: council-word-in 0.2s ease-out forwards; }
    @keyframes council-word-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
    .council-wordcloud-skeleton { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 8px; justify-content: center; padding: 8px 0; box-sizing: border-box; }
    .council-wordcloud-skeleton.council-wordcloud-skeleton-hidden { opacity: 0; pointer-events: none; transition: opacity 0.2s ease-out; }
    .council-wc-skeleton-line { height: 14px; border-radius: 4px; background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 75%); background-size: 200% 100%; animation: council-skeleton-shimmer 1s ease-in-out infinite; }
    .council-viz-wordcloud { position: relative; }
    .council-wordcloud-words { width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; align-content: flex-start; }
    .council-keyword-detail { display: none; margin-top: 4px; }
    .council-keyword-detail.is-open { display: block; }
    .council-keyword-detail-title { font-size: 18px; font-weight: 600; color: #f9fafb; margin-bottom: 6px; }
    .council-keyword-detail-expansion { font-weight: normal; color: #94a3b8; font-size: 0.85em; }
    .council-keyword-detail-count { font-size: 14px; color: #a78bfa; font-weight: 600; margin-bottom: 4px; }
    .council-keyword-detail-desc { font-size: 11px; color: #94a3b8; margin-bottom: 12px; }
    .council-keyword-back { padding: 6px 12px; font-size: 11px; border: none; background: rgba(139, 92, 246, 0.25); color: #c4b5fd; border-radius: 6px; cursor: pointer; font-family: inherit; }
    .council-keyword-back:hover { background: rgba(139, 92, 246, 0.4); color: #e9d5ff; }
  `;
  document.head.appendChild(style);
}

function capitalizeKeywordLabel(name) {
  if (name == null) return '';
  const s = String(name).trim().toLowerCase();
  if (s === 'mlgw') return 'MLGW';
  if (s === 'tva') return 'TVA';
  if (s === 'data center') return 'Data Center';
  if (s === 'hvac') return 'HVAC';
  if (s === 'kv') return 'kV';
  if (s === 'mw') return 'MW';
  if (s === 'xai') return 'xAI';
  if (s === 'cooling tower') return 'Cooling Tower';
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Full form for acronyms shown in keyword detail header (in brackets, not bold). */
function getKeywordExpansion(rawKeyword) {
  if (rawKeyword == null) return null;
  const s = String(rawKeyword).trim().toLowerCase();
  if (s === 'mlgw') return 'Memphis Light, Gas and Water';
  if (s === 'tva') return 'Tennessee Valley Authority';
  if (s === 'hvac') return 'Heating, Ventilation and Air Conditioning';
  return null;
}

function createParticleDanceGeoJSON(features, selectedId, now) {
  if (!features?.length) return { type: 'FeatureCollection', features: [] };
  const earthRadius = 6371000;
  const out = [];

  features.forEach((feature, index) => {
    const coords = feature.geometry?.coordinates;
    if (!coords || feature.geometry?.type !== 'Point') return;
    const [lng, lat] = coords;
    const id = feature.id ?? feature.properties?.id ?? index;
    const isSelected = selectedId != null && String(id) === String(selectedId);

    const count = isSelected ? PARTICLE_ACTIVE_COUNT : PARTICLE_IDLE_COUNT;
    const radiusM = isSelected ? PARTICLE_ACTIVE_RADIUS_M : PARTICLE_IDLE_RADIUS_M;
    const speed = isSelected ? PARTICLE_ACTIVE_SPEED : PARTICLE_IDLE_SPEED;
    const timeOffset = (now * speed) % (2 * Math.PI);

    const latOffset = (radiusM / earthRadius) * (180 / Math.PI);
    const lngOffset = (radiusM / earthRadius) * (180 / Math.PI) / Math.cos((lat * Math.PI) / 180);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI + timeOffset;
      out.push({
        type: 'Feature',
        properties: { siteId: id, active: isSelected },
        geometry: { type: 'Point', coordinates: [lng + lngOffset * Math.cos(angle), lat + latOffset * Math.sin(angle)] },
      });
    }
  });

  return { type: 'FeatureCollection', features: out };
}

/**
 * Build popup HTML: bar chart (top 8) + word cloud toggle.
 * @param {Object} keywordPayload - { data: [{ name, mentions }], selected_count } from council_keyword_mentions_top8.json
 * @param {Object} wordcloudPayload - { data: [{ text, weight }] } from council_keyword_mentions_wordcloud.json
 */
function createPopupHTML(keywordPayload, wordcloudPayload) {
  const data = keywordPayload?.data || [];
  const maxMentions = data.length ? Math.max(...data.map((d) => d.mentions)) : 1;
  const topN = 3;
  const topRows = data.slice(0, topN);
  const moreRows = data.slice(topN);

  const makeRow = (d) => {
    const pct = (d.mentions / maxMentions) * 100;
    return `
    <div class="council-bar-row">
      <span class="council-bar-label">${escapeHtml(capitalizeKeywordLabel(d.name))}</span>
      <div class="council-bar-track">
        <div class="council-bar-fill" style="width: 0;" data-pct="${pct}"></div>
      </div>
      <span class="council-bar-value">${d.mentions.toLocaleString()}</span>
    </div>
  `;
  };

  const topRowsHtml = topRows.map(makeRow).join('');
  const moreRowsHtml = moreRows.map(makeRow).join('');
  const hasMore = moreRows.length > 0;

  const wcData = wordcloudPayload?.data || [];
  const maxWeight = wcData.length ? Math.max(...wcData.map((d) => d.weight)) : 1;
  const minSize = 11;
  const maxSize = 44;
  const isMlgw = (d) => String(d.text).toLowerCase().trim() === 'mlgw';
  const mlgwItem = wcData.find(isMlgw);
  const restWcData = wcData.filter((d) => !isMlgw(d));
  const makeWordSpan = (d) => {
    const size = minSize + (d.weight / maxWeight) * (maxSize - minSize);
    const rawKey = escapeHtml(d.text);
    const label = escapeHtml(capitalizeKeywordLabel(d.text));
    const count = typeof d.weight === 'number' ? d.weight.toLocaleString() : '';
    const countHtml = count ? `<span class="council-word-tag-count">(${escapeHtml(count)})</span>` : '';
    return `<span class="council-word-tag-inline council-word-tag-clickable" data-keyword="${rawKey}"><span class="council-word-tag" style="font-size: ${size}px;">${label}</span>${countHtml}</span>`;
  };
  const firstRowHtml =
    mlgwItem != null
      ? `<div class="council-wordcloud-first-row">${makeWordSpan(mlgwItem)}</div>`
      : '';
  const restHtml = restWcData.map(makeWordSpan).join('');
  const countSpan =
    wcData.length > 0
      ? `<span class="council-wordcloud-count" style="display:block;margin-top:6px;font-size:10px;color:#94a3b8;">${wcData.length} keyword${wcData.length !== 1 ? 's' : ''} total</span>`
      : '';
  const wordCloudInner =
    wcData.length === 0
      ? '<span style="color:#9ca3af;font-size:11px;">No word cloud data.</span>'
      : `
    <div class="council-wordcloud-skeleton" id="council-wordcloud-skeleton">
      <div class="council-wc-skeleton-line" style="width:55%"></div>
      <div class="council-wc-skeleton-line" style="width:85%"></div>
      <div class="council-wc-skeleton-line" style="width:65%"></div>
      <div class="council-wc-skeleton-line" style="width:45%"></div>
    </div>
    <div class="council-wordcloud-words" id="council-wordcloud-words">${firstRowHtml}${restHtml}${countSpan}</div>`;

  return `
    <div class="council-popup-card" style="
      background: rgba(17, 24, 39, 0.95);
      border-radius: 8px;
      padding: 12px 16px;
      color: #f9fafb;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);
      width: 100%;
      max-width: 340px;
      min-width: 220px;
      box-sizing: border-box;
    ">
      <button type="button" class="council-popup-close" aria-label="Close">×</button>
      <div class="council-popup-skeleton">
        <div class="council-skeleton-line title"></div>
        <div class="council-skeleton-line"></div>
        <div class="council-skeleton-line badges"></div>
      </div>
      <div class="council-popup-content">
        <div class="council-popup-header" id="council-popup-header">
          <div class="council-chart-title">Council keyword mentions</div>
        </div>
        <div class="council-viz-chart" id="council-viz-chart">
          ${topRowsHtml || '<div style="color:#9ca3af;font-size:11px;">No data loaded.</div>'}
          ${hasMore ? `<div class="council-chart-more" id="council-chart-more">${moreRowsHtml}</div>` : ''}
          <div class="council-chart-buttons">
            ${hasMore ? '<button type="button" class="council-chart-toggle" id="council-chart-toggle">See more</button>' : ''}
            <button type="button" class="council-chart-wordcloud-btn" id="council-chart-wordcloud-btn">Word cloud</button>
          </div>
        </div>
        <div class="council-viz-wordcloud" id="council-viz-wordcloud">${wordCloudInner}</div>
        <div class="council-keyword-detail" id="council-keyword-detail">
          <div class="council-keyword-detail-title" id="council-keyword-detail-title">—</div>
          <div class="council-keyword-detail-count" id="council-keyword-detail-count">—</div>
          <div class="council-keyword-detail-desc">Mentions in council documents (selected corpus, last 18 months).</div>
          <button type="button" class="council-keyword-back" id="council-keyword-back">← Back</button>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  if (s == null) return '';
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (div) {
    div.textContent = s;
    return div.innerHTML;
  }
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Council signals (Colossus-related) geocoded from Memphis council PDFs.
 * Teardrop markers, particle dance, popup with skeleton and close button.
 */
const CouncilSignalsColossusLayer = ({ map, visible }) => {
  const popupRef = useRef(null);
  const popupDelayRef = useRef(null);
  const markersRef = useRef([]);
  const featuresRef = useRef([]);
  const selectedIdRef = useRef(null);
  const particleRafRef = useRef(null);
  const keywordMentionsRef = useRef(null);
  const wordcloudRef = useRef(null);

  useEffect(() => {
    if (!map?.current) return;
    const mapInstance = map.current;

    if (!visible) {
      if (popupDelayRef.current) {
        clearTimeout(popupDelayRef.current);
        popupDelayRef.current = null;
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      markersRef.current.forEach((m) => {
        try { m.remove(); } catch (_) {}
      });
      markersRef.current = [];
      if (particleRafRef.current) {
        cancelAnimationFrame(particleRafRef.current);
        particleRafRef.current = null;
      }
      if (mapInstance.getLayer(PARTICLES_LAYER_ID)) mapInstance.removeLayer(PARTICLES_LAYER_ID);
      if (mapInstance.getLayer(LABELS_LAYER_ID)) mapInstance.removeLayer(LABELS_LAYER_ID);
      if (mapInstance.getSource(PARTICLES_SOURCE_ID)) mapInstance.removeSource(PARTICLES_SOURCE_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
      return;
    }

    let cancelled = false;

    const addLayer = async () => {
      const [geoRes, keywordRes, wordcloudRes, hitsReportRes] = await Promise.all([
        fetch(GEOJSON_URL),
        fetch(KEYWORD_MENTIONS_URL).catch(() => null),
        fetch(KEYWORD_WORDCLOUD_URL).catch(() => null),
        fetch(HITS_REPORT_URL).catch(() => null),
      ]);
      const data = await geoRes.json();
      if (cancelled) return;
      if (!data.features?.length) return;

      if (keywordRes?.ok) {
        try {
          keywordMentionsRef.current = await keywordRes.json();
        } catch (_) {}
      }
      if (hitsReportRes?.ok) {
        try {
          const report = await hitsReportRes.json();
          wordcloudRef.current = aggregateWordcloudFromHitsReport(report, WORDCLOUD_TOP_N);
        } catch (_) {}
      }
      if (!wordcloudRef.current?.data?.length && wordcloudRes?.ok) {
        try {
          wordcloudRef.current = await wordcloudRes.json();
        } catch (_) {}
      }

      const processed = {
        ...data,
        features: data.features.map((f, i) => {
          const p = f.properties || {};
          const label = (p.query || 'Signal').slice(0, 24);
          return { ...f, properties: { ...p, label_text: label } };
        }),
      };
      featuresRef.current = processed.features;

      if (mapInstance.getLayer(PARTICLES_LAYER_ID)) mapInstance.removeLayer(PARTICLES_LAYER_ID);
      if (mapInstance.getLayer(LABELS_LAYER_ID)) mapInstance.removeLayer(LABELS_LAYER_ID);
      if (mapInstance.getSource(PARTICLES_SOURCE_ID)) mapInstance.removeSource(PARTICLES_SOURCE_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);

      mapInstance.addSource(SOURCE_ID, { type: 'geojson', data: processed, generateId: true });
      mapInstance.addSource(PARTICLES_SOURCE_ID, {
        type: 'geojson',
        data: createParticleDanceGeoJSON(processed.features, null, Date.now()),
      });

      mapInstance.addLayer({
        id: PARTICLES_LAYER_ID,
        type: 'circle',
        source: PARTICLES_SOURCE_ID,
        paint: {
          'circle-radius': ['case', ['get', 'active'], 2.5, 1.8],
          'circle-color': TEARDROP_COLOR,
          'circle-opacity': ['case', ['get', 'active'], 0.9, 0.7],
          'circle-blur': 0.15,
        },
        minzoom: 6,
      });

      mapInstance.addLayer({
        id: LABELS_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field': ['get', 'label_text'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 11, 10, 13, 14, 16],
          'text-anchor': 'bottom',
          'text-offset': [0, -3.8],
          'text-allow-overlap': false,
          'text-ignore-placement': false,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-width': 2,
          'text-halo-color': 'rgba(0,0,0,0.6)',
          'text-opacity': 0.95,
        },
        minzoom: 6,
      });

      markersRef.current.forEach((m) => { try { m.remove(); } catch (_) {} });
      markersRef.current = [];

      processed.features.forEach((feature, index) => {
        if (feature.geometry?.type !== 'Point') return;
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties || {};
        const id = feature.id ?? feature.properties?.id ?? index;

        const marker = new mapboxgl.Marker({
          color: TEARDROP_COLOR,
          anchor: 'bottom',
          scale: 1,
        })
          .setLngLat([lng, lat])
          .addTo(mapInstance);

        const el = marker.getElement();
        el.style.cursor = 'pointer';
        el.title = (props.query || 'Council signal').slice(0, 60);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          selectedIdRef.current = id;

          if (popupDelayRef.current) {
            clearTimeout(popupDelayRef.current);
            popupDelayRef.current = null;
          }
          if (popupRef.current) {
            popupRef.current.remove();
            popupRef.current = null;
          }

          popupDelayRef.current = setTimeout(() => {
            popupDelayRef.current = null;
            if (!mapInstance || cancelled) return;
            injectCouncilSignalsPopupStyles();
            const popup = new mapboxgl.Popup({
              closeButton: false,
              closeOnClick: true,
              anchor: 'bottom',
              offset: [0, -POPUP_OFFSET_UP],
              maxWidth: '400px',
              className: 'memphis-layer-popup',
            })
              .setLngLat([lng, lat]);

            const contentWrap = document.createElement('div');
            contentWrap.innerHTML = createPopupHTML(
              keywordMentionsRef.current || { data: [], selected_count: 120 },
              wordcloudRef.current || { data: [] }
            );
            const closeBtn = contentWrap.querySelector('.council-popup-close');
            if (closeBtn) {
              closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                popup.remove();
              });
            }
            const toggleBtn = contentWrap.querySelector('#council-chart-toggle');
            const moreEl = contentWrap.querySelector('#council-chart-more');
            if (toggleBtn && moreEl) {
              toggleBtn.addEventListener('click', () => {
                const isOpen = moreEl.classList.toggle('is-open');
                toggleBtn.textContent = isOpen ? 'See less' : 'See more';
              });
            }
            const chartEl = contentWrap.querySelector('#council-viz-chart');
            const wordcloudEl = contentWrap.querySelector('#council-viz-wordcloud');
            const headerEl = contentWrap.querySelector('#council-popup-header');
            const wordcloudBtn = contentWrap.querySelector('#council-chart-wordcloud-btn');
            const detailEl = contentWrap.querySelector('#council-keyword-detail');
            const detailTitleEl = contentWrap.querySelector('#council-keyword-detail-title');
            const detailCountEl = contentWrap.querySelector('#council-keyword-detail-count');
            const backBtn = contentWrap.querySelector('#council-keyword-back');

            const SKELETON_MS = 400;
            const WORD_REVEAL_TOTAL_MS = 1600;

            if (wordcloudBtn && chartEl && wordcloudEl) {
              wordcloudBtn.addEventListener('click', () => {
                const showCloud = !wordcloudEl.classList.contains('is-open');
                wordcloudEl.classList.toggle('is-open', showCloud);
                chartEl.classList.toggle('is-hidden', showCloud);
                if (headerEl) headerEl.classList.toggle('is-hidden', showCloud);
                wordcloudBtn.textContent = showCloud ? 'Bar chart' : 'Word cloud';
                if (detailEl?.classList.contains('is-open')) {
                  detailEl.classList.remove('is-open');
                  chartEl.classList.remove('is-hidden');
                  wordcloudEl.classList.toggle('is-open', showCloud);
                  headerEl?.classList.remove('is-hidden');
                }
                if (showCloud) {
                  const skeletonEl = wordcloudEl.querySelector('#council-wordcloud-skeleton');
                  const wordsEl = wordcloudEl.querySelector('#council-wordcloud-words');
                  if (skeletonEl && wordsEl) {
                    wordsEl.classList.remove('is-visible');
                    skeletonEl.classList.remove('council-wordcloud-skeleton-hidden');
                    const wordElements = wordsEl.querySelectorAll('.council-word-tag-inline');
                    const countEl = wordsEl.querySelector('.council-wordcloud-count');
                    const n = wordElements.length + (countEl ? 1 : 0);
                    const staggerMs = n > 1 ? WORD_REVEAL_TOTAL_MS / n : 0;
                    wordElements.forEach((el, i) => {
                      el.style.animationDelay = '';
                      el.style.animationDelay = `${i * staggerMs}ms`;
                    });
                    if (countEl) {
                      countEl.style.animationDelay = '';
                      countEl.style.animationDelay = `${wordElements.length * staggerMs}ms`;
                    }
                    setTimeout(() => {
                      skeletonEl.classList.add('council-wordcloud-skeleton-hidden');
                      wordsEl.classList.add('is-visible');
                    }, SKELETON_MS);
                  }
                }
              });
            }

            if (wordcloudEl && detailEl && detailTitleEl && detailCountEl && backBtn) {
              const keywordData = keywordMentionsRef.current?.data || [];
              const wcData = wordcloudRef.current?.data || [];
              wordcloudEl.querySelectorAll('.council-word-tag-clickable').forEach((span) => {
                span.addEventListener('click', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const raw = span.getAttribute('data-keyword');
                  if (!raw) return;
                  const label = capitalizeKeywordLabel(raw);
                  const mentionsRow = keywordData.find((d) => String(d.name).toLowerCase().trim() === String(raw).toLowerCase().trim());
                  const wcRow = wcData.find((d) => String(d.text).toLowerCase().trim() === String(raw).toLowerCase().trim());
                  const count = mentionsRow?.mentions ?? wcRow?.weight ?? 0;
                  const expansion = getKeywordExpansion(raw);
                  if (expansion) {
                    detailTitleEl.innerHTML = `${label} <span class="council-keyword-detail-expansion">(${expansion})</span>`;
                  } else {
                    detailTitleEl.textContent = label;
                  }
                  detailCountEl.textContent = `${count.toLocaleString()} mention${count !== 1 ? 's' : ''}`;
                  detailEl.classList.add('is-open');
                  if (headerEl) headerEl.classList.add('is-hidden');
                  if (chartEl) chartEl.classList.add('is-hidden');
                  wordcloudEl.classList.remove('is-open');
                  if (wordcloudBtn) wordcloudBtn.textContent = 'Bar chart';
                });
              });
              backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                detailEl.classList.remove('is-open');
                if (headerEl) headerEl.classList.remove('is-hidden');
                if (chartEl) chartEl.classList.remove('is-hidden');
                wordcloudEl.classList.add('is-open');
                if (wordcloudBtn) wordcloudBtn.textContent = 'Bar chart';
              });
            }

            popup.setDOMContent(contentWrap);
            popup.addTo(mapInstance);

            setTimeout(() => {
              contentWrap.querySelectorAll('.council-bar-fill').forEach((el) => {
                const pct = el.getAttribute('data-pct');
                if (pct != null) el.style.width = `${pct}%`;
              });
            }, 400);

            popup.on('close', () => {
              popupRef.current = null;
              selectedIdRef.current = null;
            });
            popupRef.current = popup;
          }, POPUP_DELAY_MS);
        });

        markersRef.current.push(marker);
      });

      function animateParticles() {
        if (cancelled) return;
        const source = mapInstance.getSource(PARTICLES_SOURCE_ID);
        if (source && featuresRef.current.length) {
          source.setData(createParticleDanceGeoJSON(featuresRef.current, selectedIdRef.current, Date.now()));
        }
        particleRafRef.current = requestAnimationFrame(animateParticles);
      }
      animateParticles();
    };

    addLayer().catch((e) => console.error('Error loading Council signals Colossus layer', e));

    return () => {
      cancelled = true;
      if (popupDelayRef.current) {
        clearTimeout(popupDelayRef.current);
        popupDelayRef.current = null;
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      markersRef.current.forEach((m) => { try { m.remove(); } catch (_) {} });
      markersRef.current = [];
      if (particleRafRef.current) {
        cancelAnimationFrame(particleRafRef.current);
        particleRafRef.current = null;
      }
      if (mapInstance.getLayer(PARTICLES_LAYER_ID)) mapInstance.removeLayer(PARTICLES_LAYER_ID);
      if (mapInstance.getLayer(LABELS_LAYER_ID)) mapInstance.removeLayer(LABELS_LAYER_ID);
      if (mapInstance.getSource(PARTICLES_SOURCE_ID)) mapInstance.removeSource(PARTICLES_SOURCE_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
    };
  }, [map, visible]);

  return null;
};

export default CouncilSignalsColossusLayer;
