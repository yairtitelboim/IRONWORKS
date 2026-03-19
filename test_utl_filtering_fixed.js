// Test the FIXED UTL (Local Utilities) filtering logic
const testData = {
  "nodeLevel": `Below is a structured reliability analysis for each specified infrastructure node near Whitney, Texas, using only the required public data sources. Where plant-level data is unavailable, regional Texas data from EIA, ERCOT, or FERC is provided as instructed.

---

## NODE 1: **Bosque Power Co LLC**
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
- **Last Updated:** August 2024

---

## NODE 2: **Hill County Water Supply Corporation**
- **Type:** Electric Utility (Distribution) [EIA-860]
- **EIA Plant ID:** Data not available from public EIA/FERC/ERCOT sources
- **Current Status:** Operational [Texas PUC Supply Chain Map]

**1. POWER SCORE:** Data not available from public EIA/FERC/ERCOT sources  
- **Nameplate Capacity:** N/A  
- **Recent Generation:** N/A  
- **Capacity Factor:** N/A  
- **Source Link:** https://www.puc.texas.gov/industry/maps/supplychain/Default.aspx  
- **Last Updated:** April 2024

**2. STABILITY SCORE:** Data not available from public EIA/FERC/ERCOT sources  
- **ERCOT Zone:** North [ERCOT Public Reports]  
- **Grid Integration:** Distribution-level, receives power from ERCOT grid [FERC Market Oversight]  
- **Reliability Metrics:** N/A  
- **Source Link:** https://www.ercot.com/news/reports  
- **Last Updated:** August 2024

**3. TRANSMISSION CAPACITY:**  
- **Transmission Lines:** Receives from regional substations [EIA Transmission Data]  
- **Voltage Level:** Distribution (typically 12–25 kV) [FERC Transmission Studies]  
- **Available Capacity:** N/A  
- **Regional Load:** Hill County peak ~150 MW (2023, regional estimate) [EIA State Data]  
- **Source Link:** https://www.eia.gov/electricity/data/state/  
- **Last Updated:** October 2023

**4. RELIABILITY METRICS:**  
- **Historical Outages:** Not reported at utility level [EIA Plant Operations]  
- **Fuel Dependencies:** N/A  
- **Weather Resilience:** Subject to ERCOT and PUC weatherization rules [FERC Reliability Studies]  
- **Maintenance History:** N/A  
- **Source Links:** https://www.puc.texas.gov/industry/maps/supplychain/Default.aspx  
- **Last Updated:** April 2024

**5. REGIONAL CONTEXT:**  
- **Load Zone Analysis:** North zone [ERCOT Load Zone Data]  
- **Transmission Planning:** Covered by ERCOT North zone planning [FERC Regional Studies]  
- **Infrastructure Investment:** PUC filings for distribution upgrades [Texas PUC Filings]  
- **Regional Generation Mix:** See Node 1  
- **Source Links:** https://www.ercot.com/news/reports, https://www.puc.texas.gov/  
- **Last Updated:** August 2024

**6. DATA CENTER IMPACT:**  
- **Power Availability:** Dependent on upstream transmission and substation reliability [EIA Generation Data]  
- **Transmission Redundancy:** Limited at distribution level [FERC Transmission Studies]  
- **Reliability Standards:** Subject to PUC and ERCOT rules [Texas PUC Compliance]  
- **Grid Stability:** Follows regional trends [ERCOT System Reports]  
- **Source Link:** https://www.ercot.com/news/reports  
- **Last Updated:** August 2024

---

## NODE 3: **Oncor Electric Delivery**
- **Type:** Electric Utility (Transmission & Distribution) [EIA-860]
- **EIA Plant ID:** Data not available from public EIA/FERC/ERCOT sources
- **Current Status:** Operational [Texas PUC Supply Chain Map]

**1. POWER SCORE:** Data not available from public EIA/FERC/ERCOT sources  
- **Nameplate Capacity:** N/A  
- **Recent Generation:** N/A  
- **Capacity Factor:** N/A  
- **Source Link:** https://www.puc.texas.gov/industry/maps/supplychain/Default.aspx  
- **Last Updated:** April 2024

**2. STABILITY SCORE:** 9/10  
- **ERCOT Zone:** North [ERCOT Public Reports]  
- **Grid Integration:** Major ERCOT transmission operator [FERC Market Oversight]  
- **Reliability Metrics:** Meets NERC/PUC reliability standards [EIA Reliability Data]  
- **Source Link:** https://www.ercot.com/news/reports  
- **Last Updated:** August 2024

**3. TRANSMISSION CAPACITY:**  
- **Transmission Lines:** 138 kV, 345 kV lines in region [EIA Transmission Data]  
- **Voltage Level:** 138/345 kV [FERC Transmission Studies]  
- **Available Capacity:** North zone surplus >5,000 MW [ERCOT Resource Adequacy]  
- **Regional Load:** See Node 1  
- **Source Link:** https://www.ferc.gov/market-oversight/markets-electricity  
- **Last Updated:** July 2024

**4. RELIABILITY METRICS:**  
- **Historical Outages:** No major transmission outages reported 2022–2024 [ERCOT Outage Data]  
- **Fuel Dependencies:** N/A  
- **Weather Resilience:** Hardened post-2021 [FERC Reliability Studies]  
- **Maintenance History:** Routine, per ERCOT filings [EIA Plant Data]  
- **Source Links:** https://www.ercot.com/news/reports, https://www.ferc.gov/market-oversight/markets-electricity  
- **Last Updated:** August 2024

**5. REGIONAL CONTEXT:**  
- **Load Zone Analysis:** North zone [ERCOT Load Zone Data]  
- **Transmission Planning:** Ongoing upgrades [FERC Regional Studies]  
- **Infrastructure Investment:** Major PUC filings for grid modernization [Texas PUC Filings]  
- **Regional Generation Mix:** See Node 1  
- **Source Links:** https://www.ercot.com/news/reports, https://www.puc.texas.gov/  
- **Last Updated:** August 2024

**6. DATA CENTER IMPACT:**  
- **Power Availability:** High, with robust transmission [EIA Generation Data]  
- **Transmission Redundancy:** Multiple high-voltage paths [FERC Transmission Studies]  
- **Reliability Standards:** Meets/exceeds ERCOT/PUC standards [Texas PUC Compliance]  
- **Grid Stability:** Strong [ERCOT System Reports]  
- **Source Link:** https://www.ercot.com/news/reports  
- **Last Updated:** August 2024

---

## NODE 4: **Lake Whitney Power Plant**
- **Type:** Power Plant (Hydroelectric) [EIA-860]
- **EIA Plant ID:** 6414 [EIA Power Plant Data][4]
- **Current Status:** Operational [EIA-860][4]

**1. POWER SCORE:** 6/10  
- **Nameplate Capacity:** 48 MW [EIA-860][4]  
- **Recent Generation:** ~120,000 MWh (2023, hydro estimate) [EIA State Electricity Data]  
- **Capacity Factor:** 28.5% (2023, Texas hydro average) [EIA Electric Power Monthly]  
- **Source Link:** https://www.eia.gov/electricity/data/eia860/  
- **Last Updated:** October 2023

**2. STABILITY SCORE:** 7/10  
- **ERCOT Zone:** North [ERCOT Public Reports]  
- **Grid Integration:** Direct tie to ERCOT grid [FERC Market Oversight]  
- **Reliability Metrics:** Hydro plants have low forced outage rates (<2%) [EIA Reliability Data]  
- **Source Link:** https://www.ercot.com/news/reports  
- **Last Updated:** August 2024

**3. TRANSMISSION CAPACITY:**  
- **Transmission Lines:** 69 kV/138 kV lines to regional substations [EIA Transmission Data]  
- **Voltage Level:** 69/138 kV [FERC Transmission Studies]  
- **Available Capacity:** Small relative to regional load [ERCOT Resource Adequacy]  
- **Regional Load:** See Node 1  
- **Source Link:** https://www.ferc.gov/market-oversight/markets-electricity  
- **Last Updated:** July 2024

**4. RELIABILITY METRICS:**  
- **Historical Outages:** No major outages reported 2022–2024 [EIA Plant Operations][4]  
- **Fuel Dependencies:** Water inflow (hydro) [EIA Fuel Data][4]  
- **Weather Resilience:** Subject to drought risk [FERC Reliability Studies]  
- **Maintenance History:** Routine, per USACE schedule [EIA Plant Data][4]  
- **Source Links:** https://www.eia.gov/electricity/data/eia860/, https://www.ferc.gov/market-oversight/markets-electricity  
- **Last Updated:** October 2023

**5. REGIONAL CONTEXT:**  
- **Load Zone Analysis:** North zone [ERCOT Load Zone Data]  
- **Transmission Planning:** Minor role in regional planning [FERC Regional Studies]  
- **Infrastructure Investment:** Limited, focused on maintenance [Texas PUC Filings]  
- **Regional Generation Mix:** See Node 1  
- **Source Links:** https://www.ercot.com/news/reports, https://www.puc.texas.gov/  
- **Last Updated:** August 2024

**6. DATA CENTER IMPACT:**  
- **Power Availability:** Limited, not primary supply [EIA Generation Data][4]  
- **Transmission Redundancy:** Supported by larger grid [FERC Transmission Studies]  
- **Reliability Standards:** Meets ERCOT/PUC standards [Texas PUC Compliance]  
- **Grid Stability:** Stable, but not a major contributor [ERCOT System Reports]  
- **Source Link:** https://www.ercot.com/news/reports  
- **Last Updated:** August 2024

---

## NODE 5: **Texas-New Mexico Power (TNMP)**
- **Type:** Electric Utility (Transmission & Distribution) [EIA-860]
- **EIA Plant ID:** Data not available from public EIA/FERC/ERCOT sources
- **Current Status:** Operational [Texas PUC Supply Chain Map]`
};

function filterNodeLevelResponse(response, categoryId) {
    const sections = response.split('## NODE');
    const header = sections[0] || '';
    const nodes = sections.slice(1);

    switch (categoryId) {
        case 'all':
            return response;

        case 'power_generation':
            const powerNodes = nodes.filter(node => {
                const nodeText = node.toLowerCase();
                return nodeText.includes('power plant') ||
                       nodeText.includes('natural gas') ||
                       nodeText.includes('hydroelectric') ||
                       nodeText.includes('lake whitney power');
            });
            if (powerNodes.length > 0) {
                return '## Power Generation\n\n' + powerNodes.map(node => '## NODE' + node).join('\n\n');
            } else {
                return '## Power Generation\n\nNo power generation infrastructure found.';
            }

        case 'transmission':
            const transmissionNodes = nodes.filter(node => {
                const nodeText = node.toLowerCase();
                return nodeText.includes('oncor') ||
                       nodeText.includes('tnmp') ||
                       nodeText.includes('texas-new mexico power') ||
                       nodeText.includes('transmission') ||
                       nodeText.includes('345 kv') ||
                       nodeText.includes('138 kv') ||
                       nodeText.includes('electric utility') ||
                       nodeText.includes('grid operator');
            });
            if (transmissionNodes.length > 0) {
                return '## Transmission\n\n' + transmissionNodes.map(node => '## NODE' + node).join('\n\n');
            } else {
                return '## Transmission\n\nNo transmission infrastructure found.';
            }

        case 'local_utilities':
            const utilityNodes = nodes.filter(node => {
                const nodeText = node.toLowerCase();
                // Only include actual local utilities, not transmission operators
                return nodeText.includes('water supply') ||
                       nodeText.includes('hill county water') ||
                       nodeText.includes('daniels electric') ||
                       nodeText.includes('hilco') ||
                       // Exclude transmission operators by checking for specific patterns
                       (nodeText.includes('utility') && 
                        !nodeText.includes('transmission') && 
                        !nodeText.includes('oncor') && 
                        !nodeText.includes('tnmp') && 
                        !nodeText.includes('texas-new mexico power') &&
                        !nodeText.includes('electric delivery'));
            });
            if (utilityNodes.length > 0) {
                return '## Local Utilities\n\n' + utilityNodes.map(node => '## NODE' + node).join('\n\n');
            } else {
                return '## Local Utilities\n\nNo utility infrastructure found.';
            }

        case 'risk_redundancy':
            let riskContent = '## Risk & Redundancy Analysis\n\n';
            nodes.forEach((node) => {
                // Look for the actual patterns in the Perplexity response
                const riskMatch = node.match(/\*\*4\. RELIABILITY METRICS:\*\*([\s\S]*?)\*\*5\. REGIONAL CONTEXT:\*\*/);
                const redundancyMatch = node.match(/\*\*6\. DATA CENTER IMPACT:\*\*([\s\S]*?)(?=---|\*\*|$)/);
                
                if (riskMatch || redundancyMatch) {
                    const nodeName = node.split('\n')[0].replace(/^\d+:\s*\*\*/, '').replace(/\*\*$/, '');
                    riskContent += `### ${nodeName}\n`;
                    if (riskMatch) riskContent += `**Reliability Metrics:**${riskMatch[1]}\n`;
                    if (redundancyMatch) riskContent += `**Data Center Impact:**${redundancyMatch[1]}\n`;
                    riskContent += '\n';
                }
            });
            return riskContent;

        default:
            return response;
    }
}

console.log('🧪 Testing FIXED UTL (Local Utilities) Filtering\n');

const filteredResponse = filterNodeLevelResponse(testData.nodeLevel, 'local_utilities');

console.log('✅ Filtered Response:');
console.log(filteredResponse);

console.log('\n🔍 Analysis:');
const nodeMatches = filteredResponse.match(/## NODE \d+:/g);
if (nodeMatches) {
    console.log(`   Found ${nodeMatches.length} nodes in UTL category:`);
    nodeMatches.forEach((match, index) => {
        console.log(`   ${index + 1}. ${match}`);
    });
} else {
    console.log('   No nodes found in UTL category');
}

console.log('\n🔍 Keyword Analysis:');
const nodes = testData.nodeLevel.split('## NODE').slice(1);
nodes.forEach((node, index) => {
    const nodeText = node.toLowerCase();
    const nodeName = node.split('\n')[0].replace(/^\d+:\s*\*\*/, '').replace(/\*\*$/, '').trim();
    
    const matches = [];
    if (nodeText.includes('water supply')) matches.push('water supply');
    if (nodeText.includes('hill county water')) matches.push('hill county water');
    if (nodeText.includes('daniels electric')) matches.push('daniels electric');
    if (nodeText.includes('hilco')) matches.push('hilco');
    
    // Check the new utility logic
    const hasUtility = nodeText.includes('utility');
    const hasTransmission = nodeText.includes('transmission');
    const hasOncor = nodeText.includes('oncor');
    const hasTnpm = nodeText.includes('tnmp');
    const hasTexasNewMexico = nodeText.includes('texas-new mexico power');
    const hasElectricDelivery = nodeText.includes('electric delivery');
    
    if (hasUtility) {
        if (hasTransmission || hasOncor || hasTnpm || hasTexasNewMexico || hasElectricDelivery) {
            matches.push('utility (EXCLUDED - transmission operator)');
        } else {
            matches.push('utility (INCLUDED - local utility)');
        }
    }
    
    console.log(`   Node ${index + 1} (${nodeName}): ${matches.length > 0 ? matches.join(', ') : 'No matches'}`);
});

console.log('\n✅ FIXED UTL filtering test completed!');
