/**
 * Scanner configuration: regex rules, query templates, etc.
 */

// Constraint detection regex rules
export const CONSTRAINT_RULES = {
  moratorium: {
    regex: /\bmoratorium\b|\btemporary ban\b|\bban on\b|\bpaused\b.*\bpermits?\b|\bhalt(ed)?\b.*\bdevelopment\b/i,
    event_type: 'MORATORIUM',
    confidence: 'HIGH',
    tag: 'moratorium'
  },
  zoning_denial: {
    regex: /\bdenied\b.*\b(zoning|rezon(e|ing)|permit|variance|site plan)\b|\brejected\b.*\b(zoning|permit|variance|site plan)\b/i,
    event_type: 'ZONING_DENIAL',
    confidence: 'HIGH',
    tag: 'zoning_denial'
  },
  lawsuit: {
    regex: /\blawsuit\b|\bsued\b|\bsuing\b|\bcomplaint filed\b|\bpetition filed\b|\btemporary restraining order\b|\bTRO\b|\binjunction\b/i,
    event_type: 'LAWSUIT',
    confidence: 'HIGH',
    tag: 'lawsuit'
  },
  env_challenge: {
    regex: /\bNEPA\b|\benvironmental assessment\b|\bEIS\b|\b(endangered species|wetlands|air permit|water quality)\b.*\bchallenge\b|\bcontested case\b|\binterven(or|tion)\b/i,
    event_type: 'ENV_CHALLENGE',
    confidence: 'MED',
    tag: 'env_challenge'
  },
  permit_appeal: {
    regex: /\bappeal(ed)?\b.*\bpermit\b/i,
    event_type: 'PERMIT_APPEAL',
    confidence: 'MED',
    tag: 'permit_appeal'
  },
  public_hearing: {
    regex: /\bpublic hearing\b|\bplanning commission\b|\bcity council\b.*\b(hearing|meeting|agenda)\b|\bboard of adjustment\b|\bcontested\b.*\bhearing\b/i,
    event_type: 'PUBLIC_HEARING',
    confidence: 'MED',
    tag: 'public_hearing'
  },
  noise: {
    regex: /\bnoise\b|\b24\/7\b|\bgenerators?\b|\bbackup power\b|\bnuisance\b/i,
    event_type: 'NOISE',
    confidence: 'LOW',
    tag: 'noise'
  },
  grid_tariff: {
    regex: /\bcollateral\b|\bsecurity deposit\b|\btake[- ]or[- ]pay\b|\bminimum payment\b|\bexit fee\b|\btermination fee\b|\bfirm service\b.*\b85%\b|\btariff\b.*\bupdate\b|\brevised tariff\b|\bnew tariff\b|\bqueue reform\b|\binterconnection reform\b/i,
    event_type: 'GRID_TARIFF',
    confidence: 'MED',
    tag: 'grid_tariff'
  },
  opposition: {
    regex: /\bopposition\b|\bbacklash\b|\bpushback\b|\bneighbors?\b.*\b(oppose|opposed|concerned|angry)\b|\bresidents?\b.*\b(oppose|petition|concerns)\b|\bcommunity group\b|\bcoalition\b/i,
    event_type: 'OTHER',
    confidence: 'LOW',
    tag: 'opposition'
  }
};

// Commitment detection regex rules
export const COMMITMENT_RULES = {
  filed: {
    regex: /\bfiled\b|\bapplication\b|\bsubmitted\b/i,
    event_type: 'FILED',
    confidence: 'MED',
    tag: 'filed'
  },
  approved: {
    regex: /\bapproved\b|\bpermit issued\b|\bpermit granted\b|\bgreen light\b/i,
    event_type: 'APPROVED',
    confidence: 'HIGH',
    tag: 'approved'
  },
  construction: {
    regex: /\bconstruction\b|\bbreaking ground\b|\bgroundbreaking\b|\bbuilding\b/i,
    event_type: 'CONSTRUCTION',
    confidence: 'HIGH',
    tag: 'construction'
  },
  land_sale: {
    regex: /\bland sale\b|\bproperty purchase\b|\bacquisition\b/i,
    event_type: 'LAND_SALE',
    confidence: 'MED',
    tag: 'land_sale'
  },
  interconnection_update: {
    regex: /\binterconnection\b|\bqueue\b.*\b(approved|moved|advanced)\b/i,
    event_type: 'INTERCONNECTION_UPDATE',
    confidence: 'MED',
    tag: 'interconnection_update'
  }
};

// Constraint-first query templates for Tavily
export const QUERY_TEMPLATES = {
  constraint: [
    '"data center" (moratorium OR lawsuit OR zoning) Texas',
    '"battery storage" (lawsuit OR zoning) Texas',
    '"substation" (opposition OR denied) Texas',
    '"noise" "data center" city council Texas',
    '"water permit" (denied OR appeal) Texas',
    '"power plant" (opposition OR denied) Texas',
    '"transmission line" (lawsuit OR opposition) Texas'
  ],
  commitment: [
    '"data center" (approved OR construction) Texas',
    '"battery storage" (permit issued OR approved) Texas',
    '"power plant" (approved OR construction) Texas'
  ]
};

// Change type detection rules (first-class concept)
// Signals MUST have a clear change_type or be demoted to CONTEXT
export const CHANGE_TYPE_RULES = {
  NEW: {
    regex: /\b(new|announced|proposed|filed|application|submitted|plans to|will build|to construct)\b/i,
    keywords: ['new', 'announced', 'proposed', 'filed', 'application', 'submitted']
  },
  UPDATED: {
    regex: /\b(updated|changed|revised|modified|amended|status changed|moved forward|advanced|progress)\b/i,
    keywords: ['updated', 'changed', 'revised', 'modified', 'amended', 'progress']
  },
  WITHDRAWN: {
    regex: /\b(withdrawn|withdrew|cancelled|canceled|pulled|removed|dropped|abandoned)\b/i,
    keywords: ['withdrawn', 'withdrew', 'cancelled', 'canceled', 'pulled', 'removed']
  },
  DENIED: {
    regex: /\b(denied|rejected|refused|turned down|blocked|prohibited|banned)\b/i,
    keywords: ['denied', 'rejected', 'refused', 'turned down', 'blocked']
  },
  ESCALATED: {
    regex: /\b(escalated|appealed|challenged|contested|lawsuit|filed suit|legal action|hearing scheduled)\b/i,
    keywords: ['escalated', 'appealed', 'challenged', 'contested', 'lawsuit']
  },
  STALLED: {
    regex: /\b(stalled|delayed|postponed|on hold|paused|suspended|halted|deadlocked)\b/i,
    keywords: ['stalled', 'delayed', 'postponed', 'on hold', 'paused', 'suspended']
  }
};

// Static content detection rules (demote to CONTEXT)
export const STATIC_CONTENT_RULES = {
  market_overview: {
    regex: /\b(market overview|market analysis|industry report|market size|market trends|market share)\b/i,
    reason: 'Market overview article'
  },
  statistics_page: {
    regex: /\b(has \d+|there are \d+|total of \d+|statistics|statistical|data shows|according to data)\b/i,
    reason: 'Static statistics page'
  },
  policy_explainer: {
    regex: /\b(policy explained|what is|how does|understanding|guide to|explainer|overview of policy)\b/i,
    reason: 'Policy explainer'
  },
  directory_listing: {
    regex: /\b(directory|list of|all projects|project list|find projects|search projects)\b/i,
    reason: 'Static directory/listing'
  },
  general_news: {
    regex: /\b(in the news|news roundup|weekly update|monthly digest|newsletter)\b/i,
    reason: 'General news aggregation'
  },
  no_change_indicators: {
    regex: /\b(currently|existing|already|as of|status quo|remains|continues to be)\b/i,
    reason: 'No change indicator - describes current state'
  }
};

// Default values
export const DEFAULTS = {
  jurisdiction: 'TX_STATE',
  state: 'TX',
  asset_type_guess: 'UNKNOWN',
  lane: 'CONTEXT',
  confidence: 'LOW',
  commitment_hint: 'NONE',
  status: 'NEW'
};

