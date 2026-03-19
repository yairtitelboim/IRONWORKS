/**
 * Memphis power & delivery narrative timeline.
 * Used by TimelineGraphPanel in "narrative" mode when Memphis layers are on and no site-change data is loaded.
 * Align with MEMPHIS_MAP_NARRATIVE_GAPS_AND_ANALYSES.md; refine dates when MLGW/TVA timeline extraction is done.
 */

export const MEMPHIS_MILESTONES = [
  {
    id: 'xai-150mw',
    date: null,
    dateLabel: 'TBD',
    label: 'xAI 150 MW TVA board approval',
    detail: 'Demand response, new substation, reserve margin. That blueprint applies to next projects (18–36 mo).'
  },
  {
    id: 'mlgw-fy2026',
    date: '2026',
    dateLabel: '2026',
    label: 'MLGW FY2026 substation work starts',
    detail: 'Construction starts this year; energization typically 12–18 months.'
  },
  {
    id: 'advantage',
    date: null,
    dateLabel: '—',
    label: 'Sites near MLGW expansion',
    detail: '~12–18 month advantage. Outside advantage zone: ~24–36 months + TVA board approval.'
  },
  {
    id: 'next-loads',
    date: null,
    dateLabel: '—',
    label: 'Next large loads',
    detail: 'Same process: 18–36 months, board approval. Constraint is firm power + MLGW delivery timing, not TVA generation.'
  }
];

/** Short "Key" bullets for the narrative panel (optional strip below milestones). */
export const MEMPHIS_NARRATIVE_KEY_BULLETS = [
  'Constraint: firm power contracts + MLGW delivery timing (not TVA generation).',
  'Price on substation proximity: 12–18 mo near FY2026 expansion vs 24–36 mo + board elsewhere.'
];

/**
 * Scrollable narrative sections for the right-side NarrativePanel.
 * Each section has a title and body (string or array of paragraphs).
 */
export const MEMPHIS_NARRATIVE_SECTIONS = [
  {
    id: 'constraint',
    title: 'The real constraint',
    body: 'Elon announced pushing toward 2 GW — third building (Colossus) plus Southaven. Everyone\'s talking about scale. Nobody\'s checking who gets power next. The constraint isn\'t TVA generation. It\'s firm power contracts and MLGW delivery timing.'
  },
  {
    id: 'blueprint',
    title: 'The blueprint',
    body: 'TVA treated xAI\'s first 150 MW as board-level approval: demand response required, new substation needed, reserve margin conditions. That\'s the blueprint. xAI got in early. Paid for substations. Accepted DR terms. Next projects: same process, 18–36 months, board approval.'
  },
  {
    id: 'timing',
    title: 'Who gets power when',
    body: 'MLGW 2026 budget: substation expansion starts this year. Construction sequencing decides who energizes first. Sites near MLGW planned expansions: 12–18 month advantage. Sites needing new substations: 24–36 months + board uncertainty.'
  },
  {
    id: 'pricing',
    title: 'How to price Memphis',
    body: 'Market pricing Memphis on "cheap TVA power." It should price on "firm power contract + substation proximity." Turn on MLGW FY2026, xAI Sites, and xAI→MLGW lines to see which sites sit near planned expansion and which face the longer path.'
  }
];
