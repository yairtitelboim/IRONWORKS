/**
 * Seed GridPulse Supabase with local Memphis data.
 * Run: node scripts/seed-gridpulse.js
 *
 * Idempotent — uses upsert on primary keys.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const PUBLIC = path.join(__dirname, '../public');

// ── 1. MLGW Substations → assets ─────────────────────────────────────────────

async function seedSubstations() {
  const raw = JSON.parse(fs.readFileSync(`${PUBLIC}/memphis-tn/mlgw_2026_substation_work.geojson`));

  // Skip feature 6 (polygon hull, not a substation)
  const points = raw.features.filter(f => f.geometry.type === 'Point');

  const rows = points.map((f, i) => {
    const p = f.properties;
    const [lng, lat] = f.geometry.coordinates;
    const num = p.substation_number || p.substation_num || i + 1;
    return {
      asset_id:           `GW-MEM-SUB-${String(num).padStart(3, '0')}`,
      asset_name:         p.name || p.substation_name || p.Name || `MLGW Substation ${num}`,
      asset_type:         'substation',
      market:             'memphis',
      county:             'Shelby',
      state:              'TN',
      lat,
      lng,
      operator:           'MLGW',
      phase:              'Filing',
      confidence:         'Confirmed',
      source:             'MLGW FY2026 Budget Book',
      source_url:         'https://www.mlgw.com/about/financials',
      date_detected:      '2026-02-04',
      date_precision:     'approximate_month',
      notes:              `Coordinate source: ${p.source || p.coordinate_source || 'mixed — see analysis'}. FY2026 capital project. Coordinate sourcing is inconsistent across substations (OSM, Nominatim, Shelby ReGIS).`,
    };
  });

  const { error } = await supabase.from('assets').upsert(rows, { onConflict: 'asset_id' });
  if (error) throw new Error(`Substations: ${error.message}`);
  console.log(`✅ Substations: ${rows.length} upserted`);
  rows.forEach(r => console.log(`   ${r.asset_id} — ${r.asset_name}`));
}

// ── 2. DPD Permits → signals ──────────────────────────────────────────────────

async function seedDPDPermits() {
  const raw = JSON.parse(fs.readFileSync(
    `${PUBLIC}/data/memphis_change/dpd_building_permits_near_colossus_5000m_recent_vertex_enriched_v1.geojson`
  ));

  // Only seed permits that Vertex flagged as review_first (most relevant)
  const candidates = raw.features.filter(f =>
    f.properties.vertex_review_bucket === 'review_first' ||
    f.properties.vertex_dc_relevance === 'high'
  );

  console.log(`   DPD permits (review_first/high relevance): ${candidates.length} of ${raw.features.length}`);

  const rows = candidates.map((f, i) => {
    const p = f.properties;
    const coords = f.geometry?.coordinates || [];
    return {
      signal_id:      `GW-MEM-DPD-${String(i + 1).padStart(4, '0')}`,
      asset_id:       'GW-MEM-A001', // Colossus 1 — nearest confirmed asset
      signal_type:    'permit_filing',
      signal_date:    p.IssueDate?.split('T')[0] || p.issue_date?.split('T')[0] || '2024-01-01',
      date_precision: 'exact',
      layer:          'infrastructure',
      source:         'Memphis DPD (Development & Permits Department)',
      source_url:     'https://www.memphistn.gov/government/planning-development/permits/',
      confidence:     'Confirmed',
      summary:        [
        p.WorkDescription || p.work_description || p.Description || '',
        p.vertex_category_primary ? `Vertex category: ${p.vertex_category_primary}` : '',
        p.vertex_reason ? `AI note: ${p.vertex_reason}` : '',
      ].filter(Boolean).join(' | '),
      raw_payload: p,
    };
  });

  const { error } = await supabase.from('signals').upsert(rows, { onConflict: 'signal_id' });
  if (error) throw new Error(`DPD permits: ${error.message}`);
  console.log(`✅ DPD permits: ${rows.length} signals upserted`);
}

// ── 3. DeSoto Permits → signals ───────────────────────────────────────────────

async function seedDeSotoPermits() {
  const raw = JSON.parse(fs.readFileSync(
    `${PUBLIC}/data/memphis_change/desoto_building_permits_near_colossus_5000m_vertex_enriched_v4.geojson`
  ));

  // Only seed Vertex review_first from DeSoto (mostly residential — be selective)
  const candidates = raw.features.filter(f =>
    f.properties.vertex_review_bucket === 'review_first' ||
    f.properties.vertex_dc_relevance === 'high'
  );

  console.log(`   DeSoto permits (review_first/high relevance): ${candidates.length} of ${raw.features.length}`);

  const rows = candidates.map((f, i) => {
    const p = f.properties;
    return {
      signal_id:      `GW-MEM-DSO-${String(i + 1).padStart(4, '0')}`,
      asset_id:       'GW-MEM-A008', // MACROHARDRR — DeSoto County asset
      signal_type:    'permit_filing',
      signal_date:    p.IssueDate?.split('T')[0] || p.issue_date?.split('T')[0] || '2024-01-01',
      date_precision: 'exact',
      layer:          'infrastructure',
      source:         'DeSoto County EnerGov',
      source_url:     'https://energov.desotocountyms.gov/',
      confidence:     'Inferred',
      summary:        [
        p.energov_description_long || p.WorkDescription || p.Description || '',
        p.vertex_category_primary ? `Vertex category: ${p.vertex_category_primary}` : '',
        p.vertex_reason ? `AI note: ${p.vertex_reason}` : '',
        'Note: DeSoto EnerGov data is predominantly residential; xAI MACROHARDRR permitted via MDEQ, not standard building permits.',
      ].filter(Boolean).join(' | '),
      raw_payload: p,
    };
  });

  if (rows.length === 0) {
    console.log('   DeSoto: no review_first permits — skipping');
    return;
  }

  const { error } = await supabase.from('signals').upsert(rows, { onConflict: 'signal_id' });
  if (error) throw new Error(`DeSoto permits: ${error.message}`);
  console.log(`✅ DeSoto permits: ${rows.length} signals upserted`);
}

// ── 4. 2400 Stateline parcel → ownership ─────────────────────────────────────

async function seedOwnership() {
  const raw = JSON.parse(fs.readFileSync(
    `${PUBLIC}/data/memphis_change/desoto_parcel_2400_stateline_2025.geojson`
  ));

  const f = raw.features[0];
  const p = f.properties;

  const row = {
    ownership_id:   'OWN-MEM-001',
    asset_id:       'GW-MEM-A008', // MACROHARDRR
    parcel_id:      p.PIN || p.parcel_id || p.PARCEL_ID || 'DeSoto-2400-Stateline',
    owner_entity:   p.owner || p.OWNER || p.owner_name || 'ET SOUTHAVEN V LLC',
    owner_type:     'LLC',
    lease_vs_owned: 'owned',
    source:         'DeSoto County tax records (records.desotocountyms.gov)',
    confidence:     'Confirmed',
    as_of_date:     '2025-01-01',
    contact_name:   null,
    contact_role:   null,
    contact_email:  null,
  };

  // Note the discrepancy with Ankur's data
  console.log(`   ⚠️  Owner discrepancy: our data = "${row.owner_entity}" / Ankur's data = "MZX Tech LLC"`);

  const { error } = await supabase.from('ownership').upsert([row], { onConflict: 'ownership_id' });
  if (error) throw new Error(`Ownership: ${error.message}`);
  console.log(`✅ Ownership: 1 row upserted (${row.owner_entity})`);
}

// ── Run all ───────────────────────────────────────────────────────────────────

(async () => {
  console.log('🚀 Seeding GridPulse from local Memphis data...\n');
  try {
    await seedSubstations();
    console.log('');
    await seedDPDPermits();
    console.log('');
    await seedDeSotoPermits();
    console.log('');
    await seedOwnership();
    console.log('\n✅ Seed complete.');
  } catch (err) {
    console.error('\n❌', err.message);
    process.exit(1);
  }
})();
