// Memphis/Colossus card configurations
// Centered on Colossus: 34.9979829 N, -90.0348674 W

const MEMPHIS_CARD_CONFIGS = {
  'scene-0': [
    {
      id: 'memphis-colossus-overview-card',
      title: 'Memphis / Colossus Power Infrastructure',
      position: { lng: 400, lat: 300 },
      nextSceneId: 'scene-1',
      content: {
        description: 'The **xAI Colossus** facility in Memphis anchors a **150 MW TVA load** — the largest single AI datacenter power request in TVA history. **MLGW FY2026 substation work** defines who gets power first.',
        data: {
          'xAI Load': '150 MW (TVA board approved)',
          'Grid Operator': 'TVA / MLGW',
          'Analysis Radius': '5 km (Colossus)',
          'Key Constraint': 'Firm power contracts + MLGW delivery timing'
        }
      },
      style: {
        priority: 1,
        borderColor: '#f59e0b'
      }
    }
  ],

  'scene-1': [
    {
      id: 'mlgw-2026-card',
      title: 'MLGW FY2026 Substation Expansion',
      position: { lng: 400, lat: 300 },
      nextSceneId: 'scene-2',
      content: {
        description: 'MLGW\'s **FY2026 substation work** creates a **12–18 month advantage** for sites near planned expansions vs 24–36 months elsewhere. This is the real pricing signal — proximity to substations, not just cheap TVA power.',
        data: {
          'Advantage': '12–18 mo near FY2026 expansion',
          'Elsewhere': '24–36 mo + TVA board approval',
          'Blueprint': 'xAI 150 MW approval process as template',
          'Operator': 'Memphis Light, Gas & Water'
        }
      },
      style: {
        priority: 1,
        borderColor: '#22d3ee'
      }
    }
  ],

  'scene-2': [
    {
      id: 'colossus-change-detection-card',
      title: 'Colossus Area Change Detection',
      position: { lng: 400, lat: 300 },
      nextSceneId: null,
      content: {
        description: 'Satellite change detection **2023→2024** around the Colossus site in Shelby County. Building permits from Memphis/DPD (TN side) and DeSoto County (MS side) provide ground-truth for AI-classified development activity.',
        data: {
          'Change Period': '2023 → 2024',
          'Permit Radius': '5,000 m from Colossus',
          'TN Side': 'Memphis/DPD permits (Vertex v1)',
          'MS Side': 'DeSoto County permits (Vertex v4)'
        }
      },
      style: {
        priority: 1,
        borderColor: '#4ade80'
      }
    }
  ]
};

export const getCardsForScene = (sceneId) => {
  return MEMPHIS_CARD_CONFIGS[sceneId] || [];
};

export const getSceneIds = () => Object.keys(MEMPHIS_CARD_CONFIGS);
