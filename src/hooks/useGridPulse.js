import { useState, useEffect } from 'react';
import { fetchMemphisAssets, fetchSignals, fetchMarketStatus } from '../services/gridpulse';

/**
 * Fetches live Memphis assets + signals from GridPulse Supabase.
 * Returns cards shaped for the BaseCard/CardManager system.
 */
export function useMemphisAssetCards() {
  const [cards, setCards] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [allAssets, infraSignals] = await Promise.all([
          fetchMemphisAssets(),
          fetchSignals({ layer: 'infrastructure' }),
        ]);

        if (cancelled) return;

        setAssets(allAssets);

        // Group signals by asset_id
        const signalsByAsset = {};
        infraSignals.forEach(s => {
          if (!signalsByAsset[s.asset_id]) signalsByAsset[s.asset_id] = [];
          signalsByAsset[s.asset_id].push(s);
        });

        // Build a card for the scene-0 overview using live DB counts
        const confirmed  = allAssets.filter(a => a.confidence === 'Confirmed').length;
        const inferred   = allAssets.filter(a => a.confidence === 'Inferred').length;
        const shells     = allAssets.filter(a => a.phase === 'Shell').length;
        const substations = allAssets.filter(a => a.asset_type === 'substation').length;

        const overviewCard = {
          id: 'gridpulse-memphis-overview',
          title: 'Memphis / Colossus — GridPulse',
          position: { lng: 400, lat: 300 },
          nextSceneId: null,
          content: {
            description: `**${allAssets.length} assets** tracked across the Memphis cluster. xAI Colossus anchors a **150 MW TVA load** — the largest single AI datacenter power request in TVA history.`,
            data: {
              'Total Assets':   `${allAssets.length} (${confirmed} confirmed)`,
              'Substations':    `${substations} MLGW FY2026`,
              'Shell / Active': `${shells} at Shell phase`,
              'Infra Signals':  `${infraSignals.length} permit filings`,
              'Inferred':       `${inferred} asset${inferred !== 1 ? 's' : ''}`,
            },
          },
          style: { priority: 1, borderColor: '#f59e0b' },
          // Raw DB data attached for downstream use
          _gridpulse: { assets: allAssets, signals: infraSignals },
        };

        setCards([overviewCard]);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { cards, assets, loading, error };
}

/**
 * Fetch a single asset with all its signals for detail views.
 */
export function useAssetDetail(assetId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!assetId);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    setLoading(true);

    import('../services/gridpulse').then(({ fetchAssetWithSignals }) =>
      fetchAssetWithSignals(assetId)
    ).then(result => {
      if (!cancelled) { setData(result); setLoading(false); }
    }).catch(err => {
      if (!cancelled) { setError(err); setLoading(false); }
    });

    return () => { cancelled = true; };
  }, [assetId]);

  return { data, loading, error };
}
