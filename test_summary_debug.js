// Debug the summary generation to see what data is being extracted
const testNode = `## NODE 1: **Bosque Power Co LLC**
- **Type:** Power Plant (Natural Gas, Combined Cycle) [EIA-860]
- **EIA Plant ID:** 78242 [EIA Power Plant Data]
- **Current Status:** Operational [EIA-860]

**1. POWER SCORE:** 9/10  
- **Nameplate Capacity:** 800 MW [EIA-860, 2023]  
- **Recent Generation:** 5,200,000 MWh (2023) [EIA State Electricity Data]  
- **Capacity Factor:** 74.2% (2023, Texas NGCC average) [EIA Electric Power Monthly]  
- **Source Link:** https://www.eia.gov/electricity/data/eia860/  
- **Last Updated:** October 2023

**2. STABILITY SCORE:** 8/10  
- **ERCOT Zone:** North [ERCOT Public Reports]  
- **Grid Integration:** Directly connected to ERCOT transmission grid [FERC Market Oversight]  
- **Reliability Metrics:** Texas NGCC plants report forced outage rates <3% [EIA State Reliability Data]  
- **Source Link:** https://www.ercot.com/news/reports  
- **Last Updated:** August 2024

**3. TRANSMISSION CAPACITY:**  
- **Transmission Lines:** 345 kV lines connect to ERCOT backbone [EIA Transmission Data]  
- **Voltage Level:** 345 kV [FERC Transmission Studies]  
- **Available Capacity:** North zone surplus >5,000 MW (2024) [ERCOT Resource Adequacy]  
- **Regional Load:** North zone peak ~24,000 MW (2023) [EIA State Data]  
- **Source Link:** https://www.ferc.gov/market-oversight/markets-electricity  
- **Last Updated:** July 2024

**4. RELIABILITY METRICS:**  
- **Historical Outages:** No major outages reported 2022–2024 [EIA Plant Operations]  
- **Fuel Dependencies:** Natural gas, dual-fuel capability [EIA Fuel Data]  
- **Weather Resilience:** Upgrades post-2021 winter event [FERC Reliability Studies]  
- **Maintenance History:** Scheduled annual maintenance, no extended forced outages [EIA Plant Data]  
- **Source Links:** https://www.eia.gov/electricity/data/eia860/, https://www.ferc.gov/market-oversight/markets-electricity  
- **Last Updated:** October 2023

**5. REGIONAL CONTEXT:**  
- **Load Zone Analysis:** North zone, high reserve margin [ERCOT Load Zone Data]  
- **Transmission Planning:** Ongoing upgrades for North Texas [FERC Regional Studies]  
- **Infrastructure Investment:** Recent filings for capacity expansion [Texas PUC Filings]  
- **Regional Generation Mix:** 48% natural gas, 23% wind, 18% coal, 11% other (2023) [EIA State Data]  
- **Source Links:** https://www.ercot.com/news/reports, https://www.puc.texas.gov/  
- **Last Updated:** August 2024

**6. DATA CENTER IMPACT:**  
- **Power Availability:** High, with significant surplus in North zone [EIA Generation Data]  
- **Transmission Redundancy:** Multiple 345 kV paths [FERC Transmission Studies]  
- **Reliability Standards:** Meets ERCOT and PUC standards [Texas PUC Compliance]  
- **Grid Stability:** Strong, with low forced outage rates [ERCOT System Reports]  
- **Source Link:** https://www.ercot.com/news/reports  
- **Last Updated:** August 2024`;

function extractNodeType(node) {
    const typeMatch = node.match(/\*\*Type:\*\*\s*(.+?)\s*\[/);
    return typeMatch ? typeMatch[1].trim() : 'Unknown';
}

function extractCriticalData(node) {
    const data = {};
    const nodeText = node.toLowerCase();
    
    console.log('🔍 Debugging data extraction for node...\n');
    
    // Extract power score
    const powerMatch = node.match(/\*\*1\. POWER SCORE:\*\*\s*(\d+\/\d+)/);
    if (powerMatch) {
        data.powerScore = powerMatch[1];
        console.log('✅ Power Score found:', powerMatch[1]);
    } else {
        console.log('❌ Power Score not found');
    }
    
    // Extract stability score
    const stabilityMatch = node.match(/\*\*2\. STABILITY SCORE:\*\*\s*(\d+\/\d+)/);
    if (stabilityMatch) {
        data.stabilityScore = stabilityMatch[1];
        console.log('✅ Stability Score found:', stabilityMatch[1]);
    } else {
        console.log('❌ Stability Score not found');
    }
    
    // Extract capacity
    const capacityMatch = node.match(/\*\*Nameplate Capacity:\*\*\s*([^\n]+)/);
    if (capacityMatch) {
        data.capacity = capacityMatch[1].trim();
        console.log('✅ Capacity found:', capacityMatch[1].trim());
    } else {
        console.log('❌ Capacity not found');
    }
    
    // Extract capacity factor
    const capacityFactorMatch = node.match(/\*\*Capacity Factor:\*\*\s*([^\n]+)/);
    if (capacityFactorMatch) {
        data.capacityFactor = capacityFactorMatch[1].trim();
        console.log('✅ Capacity Factor found:', capacityFactorMatch[1].trim());
    } else {
        console.log('❌ Capacity Factor not found');
    }
    
    // Extract recent generation
    const generationMatch = node.match(/\*\*Recent Generation:\*\*\s*([^\n]+)/);
    if (generationMatch) {
        data.recentGeneration = generationMatch[1].trim();
        console.log('✅ Recent Generation found:', generationMatch[1].trim());
    } else {
        console.log('❌ Recent Generation not found');
    }
    
    // Extract available capacity
    const availableCapacityMatch = node.match(/\*\*Available Capacity:\*\*\s*([^\n]+)/);
    if (availableCapacityMatch) {
        data.availableCapacity = availableCapacityMatch[1].trim();
        console.log('✅ Available Capacity found:', availableCapacityMatch[1].trim());
    } else {
        console.log('❌ Available Capacity not found');
    }
    
    // Extract regional load
    const regionalLoadMatch = node.match(/\*\*Regional Load:\*\*\s*([^\n]+)/);
    if (regionalLoadMatch) {
        data.regionalLoad = regionalLoadMatch[1].trim();
        console.log('✅ Regional Load found:', regionalLoadMatch[1].trim());
    } else {
        console.log('❌ Regional Load not found');
    }
    
    console.log('\n📊 Extracted data:', data);
    return data;
}

console.log('🧪 Debugging Summary Data Extraction\n');

const nodeName = testNode.split('\n')[0].replace(/^\d+:\s*\*\*/, '').replace(/\*\*$/, '').trim();
const nodeType = extractNodeType(testNode);
const criticalData = extractCriticalData(testNode);

console.log('\n✅ Results:');
console.log('Node Name:', nodeName);
console.log('Node Type:', nodeType);
console.log('Critical Data Keys:', Object.keys(criticalData));
