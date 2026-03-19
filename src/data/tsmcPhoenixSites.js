// TSMC Phoenix Key Sites
// Critical infrastructure sites around TSMC Arizona semiconductor fab complex
// $165B total investment (started at $12B in 2020, now largest foreign greenfield investment in U.S. history)

const TSMC_PHOENIX_SITES = [
  {
    id: 'tsmc-arizona-fab-complex',
    name: 'TSMC Arizona Semiconductor Fab Complex',
    address: '5088 W. Innovation Circle',
    city: 'Phoenix',
    state: 'AZ',
    country: 'USA',
    lat: 33.75, // 5088 W Innovation Circle, Phoenix, AZ 85083
    lng: -112.25,
    investment: '$165B',
    investmentStart: '$12B (2020)',
    status: 'Largest foreign greenfield investment in U.S. history',
    fabs: 3,
    waterDemandTotal: '17.2M gallons/day',
    waterDemandCurrent: '4.75M gallons/day (Fab 1)',
    waterGap: '5.8M gallons/day shortfall',
    phase1Status: 'Operational',
    phase2Status: 'Under Construction',
    phase3Status: 'Planned',
    queryHints: ['TSMC Arizona', 'Phoenix semiconductor', 'Maricopa County fab', 'Innovation Circle'],
    notes: 'Three-fab complex producing advanced chips. Phase 1 operational, Phases 2-3 under construction. Requires 17.2M gallons/day when complete.'
  },
  {
    id: 'phoenix-water-allocation',
    name: 'Phoenix Municipal Water Allocation',
    city: 'Phoenix',
    state: 'AZ',
    country: 'USA',
    lat: 33.4484, // Phoenix city center - verify exact location
    lng: -112.0740,
    waterAllocated: '11.4M gallons/day',
    waterCurrent: '4.75M gallons/day',
    waterGap: '5.8M gallons/day shortfall',
    type: 'Municipal Water Infrastructure',
    queryHints: ['Phoenix water supply', 'municipal water allocation', 'TSMC water', 'Phoenix water department'],
    notes: 'Phoenix granted 11.4M gallons/day access. Current demand 4.75M gallons/day from Fab 1. Gap = 5.8M gallons/day shortfall when all three fabs online.'
  },
  {
    id: 'tsmc-water-reclamation-plant',
    name: 'TSMC Water Reclamation Plant',
    city: 'Phoenix',
    state: 'AZ',
    country: 'USA',
    lat: 33.6, // Approximate - verify exact location
    lng: -112.2,
    investment: '$1B+',
    size: '15 acres',
    operational: '2028',
    recyclingRate: '90%',
    remainingDemand: '1.72M gallons/day',
    status: 'Under Construction',
    type: 'Water Treatment/Recycling',
    queryHints: ['TSMC water reclamation', 'Phoenix water recycling', 'semiconductor water treatment', 'water reclamation plant'],
    notes: 'Building $1B+ water reclamation plant (15 acres, operational 2028) to hit 90% recycling. But that still leaves 1.72M gallons/day new demand from municipal supply.'
  },
  {
    id: 'aps-transmission-hub',
    name: 'APS Transmission Infrastructure',
    city: 'Phoenix',
    state: 'AZ',
    country: 'USA',
    lat: 33.6, // Approximate - verify exact location
    lng: -112.2,
    gridOperator: 'APS',
    type: 'Power Transmission',
    queryHints: ['APS transmission', 'Phoenix power grid', 'semiconductor power supply', 'Arizona Public Service'],
    notes: 'Critical high-voltage transmission infrastructure supporting TSMC power requirements. APS (Arizona Public Service) grid operator.'
  },
  {
    id: 'loop-303-corridor',
    name: 'Loop 303 Transportation Corridor',
    city: 'Phoenix',
    state: 'AZ',
    country: 'USA',
    lat: 33.6, // Approximate - verify exact location
    lng: -112.2,
    type: 'Transportation Infrastructure',
    queryHints: ['Loop 303', 'Phoenix transportation', 'TSMC access route', 'Innovation Circle access'],
    notes: 'Major transportation corridor providing access to TSMC site and surrounding industrial areas.'
  },
  {
    id: 'i-10-corridor',
    name: 'I-10 Interstate Corridor',
    city: 'Phoenix',
    state: 'AZ',
    country: 'USA',
    lat: 33.5, // Approximate
    lng: -112.1,
    type: 'Transportation Infrastructure',
    queryHints: ['I-10 Phoenix', 'Interstate 10', 'TSMC supply chain', 'Phoenix logistics'],
    notes: 'Critical interstate highway providing regional and national supply chain access for TSMC operations.'
  },
  {
    id: 'greenstone-cibola-purchase',
    name: 'Greenstone Cibola Land Purchase',
    city: 'Cibola',
    state: 'AZ',
    country: 'USA',
    lat: 33.3164, // Cibola, Arizona - La Paz County, near Colorado River
    lng: -114.6650,
    type: 'Water Rights Transaction',
    landAcres: 485,
    purchasePrice: '$9.8M',
    seller: 'Cibola farmers',
    buyer: 'Greenstone',
    queryHints: ['Greenstone Cibola', 'water rights purchase', 'Cibola farming', 'La Paz County water'],
    notes: 'Greenstone bought 485 acres from Cibola farmers for $9.8M. Part of water rights acquisition strategy in Arizona.'
  },
  {
    id: 'greenstone-queen-creek-sale',
    name: 'Greenstone Queen Creek Water Sale',
    city: 'Queen Creek',
    state: 'AZ',
    country: 'USA',
    lat: 33.2530, // Queen Creek, Arizona - Maricopa/Pinal counties
    lng: -111.6465,
    type: 'Water Rights Transaction',
    waterSold: '2,033 acre-feet (af)',
    profit: '~$12M',
    buyer: 'Queen Creek',
    seller: 'Greenstone',
    queryHints: ['Greenstone Queen Creek', 'water rights sale', 'Queen Creek water', 'water transfer'],
    notes: 'Greenstone sold 2,033 acre-feet to Queen Creek, profiting ~$12M from the water rights transaction. Part of the broader Arizona water market.'
  }
];

export default TSMC_PHOENIX_SITES;

