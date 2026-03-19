// Test the node parsing functionality
const testNodeText = `1: **Bosque Power Co LLC**
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

function parseNodeData(nodeText, nodeNumber) {
    const lines = nodeText.split('\n');
    const nameLine = lines[0] || '';
    const typeLine = lines[1] || '';
    
    // Extract node name (remove ** markers and node number)
    const name = nameLine.replace(/^\d+:\s*\*\*/, '').replace(/\*\*$/, '').trim();
    
    // Extract node type
    const typeMatch = typeLine.match(/\*\*Type:\*\*\s*(.+?)\s*\[/);
    const type = typeMatch ? typeMatch[1].trim() : 'Unknown';
    
    // Determine categories based on content
    const categories = [];
    const lowerText = nodeText.toLowerCase();
    
    if (lowerText.includes('power plant') || lowerText.includes('natural gas') || lowerText.includes('hydroelectric')) {
        categories.push('power');
    }
    if (lowerText.includes('transmission') || lowerText.includes('oncor') || lowerText.includes('tnmp') || lowerText.includes('345 kv') || lowerText.includes('138 kv')) {
        categories.push('transmission');
    }
    if (lowerText.includes('water supply') || lowerText.includes('utility') || lowerText.includes('distribution')) {
        categories.push('utility');
    }
    if (lowerText.includes('reliability') || lowerText.includes('risk') || lowerText.includes('data center impact')) {
        categories.push('risk');
    }
    
    return {
        name,
        type,
        categories,
        nodeNumber
    };
}

// Test the parsing
console.log('🧪 Testing Node Parsing Functionality\n');

const nodeData = parseNodeData(testNodeText, 1);

console.log('✅ Parsed Node Data:');
console.log(`   Name: ${nodeData.name}`);
console.log(`   Type: ${nodeData.type}`);
console.log(`   Categories: ${nodeData.categories.join(', ')}`);
console.log(`   Node Number: ${nodeData.nodeNumber}`);

console.log('\n🎯 Category Detection:');
console.log(`   Power: ${nodeData.categories.includes('power') ? '✅' : '❌'}`);
console.log(`   Transmission: ${nodeData.categories.includes('transmission') ? '✅' : '❌'}`);
console.log(`   Utility: ${nodeData.categories.includes('utility') ? '✅' : '❌'}`);
console.log(`   Risk: ${nodeData.categories.includes('risk') ? '✅' : '❌'}`);

console.log('\n✅ Node parsing test completed!');
