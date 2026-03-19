const fs = require('fs');

// Load the test data
const testData = {
  "nodeLevel": "Below is a structured reliability analysis for each specified infrastructure node near Whitney, Texas, using only the required public data sources. Where plant-level data is unavailable, regional Texas data from EIA, ERCOT, or FERC is provided as instructed.\n\n---\n\n## NODE 1: **Bosque Power Co LLC**\n- **Type:** Power Plant (Natural Gas, Combined Cycle) [EIA-860]\n- **EIA Plant ID:** 78242 [EIA Power Plant Data]\n- **Current Status:** Operational [EIA-860]\n\n**1. POWER SCORE:** 9/10  \n- **Nameplate Capacity:** 800 MW [EIA-860, 2023]  \n- **Recent Generation:** 5,200,000 MWh (2023) [EIA State Electricity Data]  \n- **Capacity Factor:** 74.2% (2023, Texas NGCC average) [EIA Electric Power Monthly]  \n- **Source Link:** https://www.eia.gov/electricity/data/eia860/  \n- **Last Updated:** October 2023\n\n**2. STABILITY SCORE:** 8/10  \n- **ERCOT Zone:** North [ERCOT Public Reports]  \n- **Grid Integration:** Directly connected to ERCOT transmission grid [FERC Market Oversight]  \n- **Reliability Metrics:** Texas NGCC plants report forced outage rates <3% [EIA State Reliability Data]  \n- **Source Link:** https://www.ercot.com/news/reports  \n- **Last Updated:** August 2024\n\n**3. TRANSMISSION CAPACITY:**  \n- **Transmission Lines:** 345 kV lines connect to ERCOT backbone [EIA Transmission Data]  \n- **Voltage Level:** 345 kV [FERC Transmission Studies]  \n- **Available Capacity:** North zone surplus >5,000 MW (2024) [ERCOT Resource Adequacy]  \n- **Regional Load:** North zone peak ~24,000 MW (2023) [EIA State Data]  \n- **Source Link:** https://www.ferc.gov/market-oversight/markets-electricity  \n- **Last Updated:** July 2024\n\n**4. RELIABILITY METRICS:**  \n- **Historical Outages:** No major outages reported 2022–2024 [EIA Plant Operations]  \n- **Fuel Dependencies:** Natural gas, dual-fuel capability [EIA Fuel Data]  \n- **Weather Resilience:** Upgrades post-2021 winter event [FERC Reliability Studies]  \n- **Maintenance History:** Scheduled annual maintenance, no extended forced outages [EIA Plant Data]  \n- **Source Links:** https://www.eia.gov/electricity/data/eia860/, https://www.ferc.gov/market-oversight/markets-electricity  \n- **Last Updated:** October 2023\n\n**5. REGIONAL CONTEXT:**  \n- **Load Zone Analysis:** North zone, high reserve margin [ERCOT Load Zone Data]  \n- **Transmission Planning:** Ongoing upgrades for North Texas [FERC Regional Studies]  \n- **Infrastructure Investment:** Recent filings for capacity expansion [Texas PUC Filings]  \n- **Regional Generation Mix:** 48% natural gas, 23% wind, 18% coal, 11% other (2023) [EIA State Data]  \n- **Source Links:** https://www.ercot.com/news/reports, https://www.puc.texas.gov/  \n- **Last Updated:** August 2024\n\n**6. DATA CENTER IMPACT:**  \n- **Power Availability:** High, with significant surplus in North zone [EIA Generation Data]  \n- **Transmission Redundancy:** Multiple 345 kV paths [FERC Transmission Studies]  \n- **Reliability Standards:** Meets ERCOT and PUC standards [Texas PUC Compliance]  \n- **Grid Stability:** Strong, with low forced outage rates [ERCOT System Reports]  \n- **Source Link:** https://www.ercot.com/news/reports  \n- **Last Updated:** August 2024\n\n---\n\n## NODE 2: **Hill County Water Supply Corporation**\n- **Type:** Electric Utility (Distribution) [EIA-860]\n- **EIA Plant ID:** Data not available from public EIA/FERC/ERCOT sources\n- **Current Status:** Operational [Texas PUC Supply Chain Map]\n\n**1. POWER SCORE:** Data not available from public EIA/FERC/ERCOT sources  \n- **Nameplate Capacity:** N/A  \n- **Recent Generation:** N/A  \n- **Capacity Factor:** N/A  \n- **Source Link:** https://www.puc.texas.gov/industry/maps/supplychain/Default.aspx  \n- **Last Updated:** April 2024\n\n**2. STABILITY SCORE:** Data not available from public EIA/FERC/ERCOT sources  \n- **ERCOT Zone:** North [ERCOT Public Reports]  \n- **Grid Integration:** Distribution-level, receives power from ERCOT grid [FERC Market Oversight]  \n- **Reliability Metrics:** N/A  \n- **Source Link:** https://www.ercot.com/news/reports  \n- **Last Updated:** August 2024\n\n**3. TRANSMISSION CAPACITY:**  \n- **Transmission Lines:** Receives from regional substations [EIA Transmission Data]  \n- **Voltage Level:** Distribution (typically 12–25 kV) [FERC Transmission Studies]  \n- **Available Capacity:** N/A  \n- **Regional Load:** Hill County peak ~150 MW (2023, regional estimate) [EIA State Data]  \n- **Source Link:** https://www.eia.gov/electricity/data/state/  \n- **Last Updated:** October 2023\n\n**4. RELIABILITY METRICS:**  \n- **Historical Outages:** Not reported at utility level [EIA Plant Operations]  \n- **Fuel Dependencies:** N/A  \n- **Weather Resilience:** Subject to ERCOT and PUC weatherization rules [FERC Reliability Studies]  \n- **Maintenance History:** N/A  \n- **Source Links:** https://www.puc.texas.gov/industry/maps/supplychain/Default.aspx  \n- **Last Updated:** April 2024\n\n**5. REGIONAL CONTEXT:**  \n- **Load Zone Analysis:** North zone [ERCOT Load Zone Data]  \n- **Transmission Planning:** Covered by ERCOT North zone planning [FERC Regional Studies]  \n- **Infrastructure Investment:** PUC filings for distribution upgrades [Texas PUC Filings]  \n- **Regional Generation Mix:** See Node 1  \n- **Source Links:** https://www.ercot.com/news/reports, https://www.puc.texas.gov/  \n- **Last Updated:** August 2024\n\n**6. DATA CENTER IMPACT:**  \n- **Power Availability:** Dependent on upstream transmission and substation reliability [EIA Generation Data]  \n- **Transmission Redundancy:** Limited at distribution level [FERC Transmission Studies]  \n- **Reliability Standards:** Subject to PUC and ERCOT rules [Texas PUC Compliance]  \n- **Grid Stability:** Follows regional trends [ERCOT System Reports]  \n- **Source Link:** https://www.ercot.com/news/reports  \n- **Last Updated:** August 2024\n\n---\n\n## NODE 3: **Oncor Electric Delivery**\n- **Type:** Electric Utility (Transmission & Distribution) [EIA-860]\n- **EIA Plant ID:** Data not available from public EIA/FERC/ERCOT sources\n- **Current Status:** Operational [Texas PUC Supply Chain Map]\n\n**1. POWER SCORE:** Data not available from public EIA/FERC/ERCOT sources  \n- **Nameplate Capacity:** N/A  \n- **Recent Generation:** N/A  \n- **Capacity Factor:** N/A  \n- **Source Link:** https://www.puc.texas.gov/industry/maps/supplychain/Default.aspx  \n- **Last Updated:** April 2024\n\n**2. STABILITY SCORE:** 9/10  \n- **ERCOT Zone:** North [ERCOT Public Reports]  \n- **Grid Integration:** Major ERCOT transmission operator [FERC Market Oversight]  \n- **Reliability Metrics:** Meets NERC/PUC reliability standards [EIA Reliability Data]  \n- **Source Link:** https://www.ercot.com/news/reports  \n- **Last Updated:** August 2024\n\n**3. TRANSMISSION CAPACITY:**  \n- **Transmission Lines:** 138 kV, 345 kV lines in region [EIA Transmission Data]  \n- **Voltage Level:** 138/345 kV [FERC Transmission Studies]  \n- **Available Capacity:** North zone surplus >5,000 MW [ERCOT Resource Adequacy]  \n- **Regional Load:** See Node 1  \n- **Source Link:** https://www.ferc.gov/market-oversight/markets-electricity  \n- **Last Updated:** July 2024\n\n**4. RELIABILITY METRICS:**  \n- **Historical Outages:** No major transmission outages reported 2022–2024 [ERCOT Outage Data]  \n- **Fuel Dependencies:** N/A  \n- **Weather Resilience:** Hardened post-2021 [FERC Reliability Studies]  \n- **Maintenance History:** Routine, per ERCOT filings [EIA Plant Data]  \n- **Source Links:** https://www.ercot.com/news/reports, https://www.ferc.gov/market-oversight/markets-electricity  \n- **Last Updated:** August 2024\n\n**5. REGIONAL CONTEXT:**  \n- **Load Zone Analysis:** North zone [ERCOT Load Zone Data]  \n- **Transmission Planning:** Ongoing upgrades [FERC Regional Studies]  \n- **Infrastructure Investment:** Major PUC filings for grid modernization [Texas PUC Filings]  \n- **Regional Generation Mix:** See Node 1  \n- **Source Links:** https://www.ercot.com/news/reports, https://www.puc.texas.gov/  \n- **Last Updated:** August 2024\n\n**6. DATA CENTER IMPACT:**  \n- **Power Availability:** High, with robust transmission [EIA Generation Data]  \n- **Transmission Redundancy:** Multiple high-voltage paths [FERC Transmission Studies]  \n- **Reliability Standards:** Meets/exceeds ERCOT/PUC standards [Texas PUC Compliance]  \n- **Grid Stability:** Strong [ERCOT System Reports]  \n- **Source Link:** https://www.ercot.com/news/reports  \n- **Last Updated:** August 2024\n\n---\n\n## NODE 4: **Lake Whitney Power Plant**\n- **Type:** Power Plant (Hydroelectric) [EIA-860]\n- **EIA Plant ID:** 6414 [EIA Power Plant Data][4]\n- **Current Status:** Operational [EIA-860][4]\n\n**1. POWER SCORE:** 6/10  \n- **Nameplate Capacity:** 48 MW [EIA-860][4]  \n- **Recent Generation:** ~120,000 MWh (2023, hydro estimate) [EIA State Electricity Data]  \n- **Capacity Factor:** 28.5% (2023, Texas hydro average) [EIA Electric Power Monthly]  \n- **Source Link:** https://www.eia.gov/electricity/data/eia860/  \n- **Last Updated:** October 2023\n\n**2. STABILITY SCORE:** 7/10  \n- **ERCOT Zone:** North [ERCOT Public Reports]  \n- **Grid Integration:** Direct tie to ERCOT grid [FERC Market Oversight]  \n- **Reliability Metrics:** Hydro plants have low forced outage rates (<2%) [EIA Reliability Data]  \n- **Source Link:** https://www.ercot.com/news/reports  \n- **Last Updated:** August 2024\n\n**3. TRANSMISSION CAPACITY:**  \n- **Transmission Lines:** 69 kV/138 kV lines to regional substations [EIA Transmission Data]  \n- **Voltage Level:** 69/138 kV [FERC Transmission Studies]  \n- **Available Capacity:** Small relative to regional load [ERCOT Resource Adequacy]  \n- **Regional Load:** See Node 1  \n- **Source Link:** https://www.ferc.gov/market-oversight/markets-electricity  \n- **Last Updated:** July 2024\n\n**4. RELIABILITY METRICS:**  \n- **Historical Outages:** No major outages reported 2022–2024 [EIA Plant Operations][4]  \n- **Fuel Dependencies:** Water inflow (hydro) [EIA Fuel Data][4]  \n- **Weather Resilience:** Subject to drought risk [FERC Reliability Studies]  \n- **Maintenance History:** Routine, per USACE schedule [EIA Plant Data][4]  \n- **Source Links:** https://www.eia.gov/electricity/data/eia860/, https://www.ferc.gov/market-oversight/markets-electricity  \n- **Last Updated:** October 2023\n\n**5. REGIONAL CONTEXT:**  \n- **Load Zone Analysis:** North zone [ERCOT Load Zone Data]  \n- **Transmission Planning:** Minor role in regional planning [FERC Regional Studies]  \n- **Infrastructure Investment:** Limited, focused on maintenance [Texas PUC Filings]  \n- **Regional Generation Mix:** See Node 1  \n- **Source Links:** https://www.ercot.com/news/reports, https://www.puc.texas.gov/  \n- **Last Updated:** August 2024\n\n**6. DATA CENTER IMPACT:**  \n- **Power Availability:** Limited, not primary supply [EIA Generation Data][4]  \n- **Transmission Redundancy:** Supported by larger grid [FERC Transmission Studies]  \n- **Reliability Standards:** Meets ERCOT/PUC standards [Texas PUC Compliance]  \n- **Grid Stability:** Stable, but not a major contributor [ERCOT System Reports]  \n- **Source Link:** https://www.ercot.com/news/reports  \n- **Last Updated:** August 2024\n\n---\n\n## NODE 5: **Texas-New Mexico Power (TNMP)**\n- **Type:** Electric Utility (Transmission & Distribution) [EIA-860]\n- **EIA Plant ID:** Data not available from public EIA/FERC/ERCOT sources\n- **Current Status:** Operational [Texas PUC Supply Chain Map]\n\n**1. POWER SCORE:** Data not available from public EIA/FERC/ERCOT sources  \n- **Nameplate Capacity:** N/A  \n- **Recent Generation:** N/A  \n- **Capacity Factor:** N/A  \n- **Source Link:** https://www.puc.texas.gov/industry/maps/supplychain/Default.aspx  \n- **Last Updated:** April 2024\n\n**2. STABILITY SCORE:** Data not available from public EIA/FERC/ERCOT sources  \n- **ERCOT Zone:** North [ERCOT Public Reports]  \n- **Grid Integration:** Major ERCOT transmission operator [FERC Market Oversight]  \n- **Reliability Metrics:** N/A  \n- **Source Link:** https://www.ercot.com/news/reports  \n- **Last Updated:** August 2024\n\n**3. TRANSMISSION CAPACITY:**  \n- **Transmission Lines:** 138 kV, 345 kV lines in region [EIA Transmission Data]  \n- **Voltage Level:** 138/345 kV [FERC Transmission Studies]  \n- **Available Capacity:** North zone surplus >5,000 MW [ERCOT Resource Adequacy]  \n- **Regional Load:** See Node 1  \n- **Source Link:** https://www.ferc.gov/market-oversight/markets-electricity  \n- **Last Updated:** July 2024\n\n**4. RELIABILITY METRICS:**  \n- **Historical Outages:** No major transmission outages reported 2022–2024 [ERCOT Outage Data]  \n- **Fuel Dependencies:** N/A  \n- **Weather Resilience:** Hardened post-2021 [FERC Reliability Studies]  \n- **Maintenance History:** Routine, per ERCOT filings [EIA Plant Data]  \n- **Source Links:** https://www.ercot.com/news/reports, https://www.ferc.gov/market-oversight/markets-electricity  \n- **Last Updated:** August 2024\n\n**5. REGIONAL CONTEXT:**  \n- **Load Zone Analysis:** North zone [ERCOT Load Zone Data]  \n- **Transmission Planning:** Ongoing upgrades [FERC Regional Studies]  \n- **Infrastructure Investment:** Major PUC filings for grid modernization [Texas PUC Filings]  \n- **Regional Generation Mix:** See Node 1  \n- **Source Links:** https://www.ercot.com/news/reports, https://www.puc.texas.gov/  \n- **Last Updated:** August 2024\n\n**6. DATA CENTER IMPACT:**  \n- **Power Availability:** High, with robust transmission [EIA Generation Data]  \n- **Transmission Redundancy:** Multiple high-voltage paths [FERC Transmission Studies]  \n- **Reliability Standards:** Meets/exceeds ERCOT/PUC standards [Texas PUC Compliance]  \n- **Grid Stability:** Strong [ERCOT System Reports]  \n- **Source Link:** https://www.ercot.com/news/reports  \n- **Last Updated:** August 2024",
  "siteLevel": "# SITE-LEVEL STRATEGIC ANALYSIS\n\n## 1. POWER SCORE: 8/10\n**Overall Site Power Capacity:** Based on node-level analysis\n- **Primary Generation:** Multiple power plants identified\n- **Capacity Factor:** Varies by facility type\n- **Source:** [EIA State Data](https://www.eia.gov/electricity/data/state/)\n\n## 2. STABILITY SCORE: 8/10\n**Grid Integration Status:** ERCOT North Zone integration\n- **ERCOT Zone:** North Zone (high reliability)\n- **Grid Integration:** Connected to ERCOT transmission grid\n- **Reliability Metrics:** Based on individual facility analysis\n- **Source:** [ERCOT Reports](https://www.ercot.com/news/reports)\n\n## 3. TRANSMISSION CAPACITY\n**Transmission Infrastructure:** Multiple voltage levels\n- **Primary Lines:** 345 kV and 138 kV network\n- **Available Capacity:** Regional surplus capacity\n- **Regional Load:** North Zone peak capacity\n- **Source:** [FERC Texas Market Overview](https://www.ferc.gov/market-oversight/markets-electricity)\n\n## 4. ERCOT INTEGRATION\n**Market Participation:** Full ERCOT market integration\n- **Market Status:** Active participant\n- **Reliability Standards:** Meets ERCOT and PUC requirements\n- **Grid Stability:** Strong with low forced outage rates\n- **Source:** [ERCOT System Reports](https://www.ercot.com/news/reports)\n\n## 5. RISK FACTORS\n**Primary Risks:** Weather dependency and fuel supply\n- **Weather Resilience:** Upgraded post-2021 winter event\n- **Fuel Dependencies:** Multiple fuel types\n- **Maintenance:** Regular scheduled maintenance\n- **Source:** [FERC Reliability Assessment](https://www.ferc.gov/market-oversight/markets-electricity)\n\n## 6. REDUNDANCY VALUE\n**Backup Systems:** Multiple transmission paths and generation sources\n- **Transmission Redundancy:** Multiple high-voltage lines\n- **Generation Redundancy:** Multiple generation sources\n- **Grid Stability:** Strong with multiple backup paths\n- **Source:** [FERC Transmission Studies](https://www.ferc.gov/market-oversight/markets-electricity)\n\n**STRATEGIC RECOMMENDATIONS:**\n1. **Primary Power Source:** Multiple generation facilities provide excellent base load capacity\n2. **Renewable Integration:** Hydro and other renewable sources add diversity\n3. **Transmission Redundancy:** Multiple voltage levels ensure reliable power delivery\n4. **Risk Mitigation:** Diversified fuel sources reduce single-point-of-failure risk\n5. **Grid Stability:** ERCOT North Zone provides excellent reliability and surplus capacity"
};

// Test the filtering functions
function filterNodeLevelResponse(response, categoryId) {
    const sections = response.split('## NODE');
    const header = sections[0] || '';
    const nodes = sections.slice(1);
    
    switch (categoryId) {
        case 'power_generation':
            const powerNodes = nodes.filter(node => {
                const nodeText = node.toLowerCase();
                return nodeText.includes('power plant') || 
                       nodeText.includes('bosque power') ||
                       nodeText.includes('lake whitney power') ||
                       nodeText.includes('natural gas') ||
                       nodeText.includes('hydroelectric') ||
                       (nodeText.includes('type:** power') && nodeText.includes('generation'));
            });
            if (powerNodes.length > 0) {
                return '## Power Generation\n\n' + powerNodes.map(node => '## NODE' + node).join('\n\n');
            } else {
                return '## Power Generation\n\nNo power generation facilities found.';
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
                return nodeText.includes('water supply') ||
                       nodeText.includes('hill county water') ||
                       nodeText.includes('daniels electric') ||
                       nodeText.includes('hilco') ||
                       nodeText.includes('utility') ||
                       nodeText.includes('distribution');
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

function filterSiteLevelResponse(response, categoryId) {
    switch (categoryId) {
        case 'power_generation':
            const powerMatch = response.match(/## 1\. POWER SCORE:[\s\S]*?(?=## 2\.|$)/);
            return powerMatch ? `## Power Generation Analysis\n\n${powerMatch[0]}` : '## Power Generation\n\nNo power analysis found.';

        case 'transmission':
            const transmissionMatch = response.match(/## 3\. TRANSMISSION CAPACITY[\s\S]*?(?=## 4\.|$)/);
            const ercotMatch = response.match(/## 4\. ERCOT INTEGRATION[\s\S]*?(?=## 5\.|$)/);
            const transmissionContent = [transmissionMatch?.[0], ercotMatch?.[0]].filter(Boolean).join('\n\n');
            return transmissionContent ? `## Transmission & Grid\n\n${transmissionContent}` : '## Transmission\n\nNo transmission analysis found.';

        case 'local_utilities':
            const stabilityMatch = response.match(/## 2\. STABILITY SCORE:[\s\S]*?(?=## 3\.|$)/);
            return stabilityMatch ? `## Stability & Utilities\n\n${stabilityMatch[0]}` : '## Local Utilities\n\nNo stability analysis found.';

        case 'risk_redundancy':
            const riskMatch = response.match(/## 5\. RISK FACTORS[\s\S]*?(?=## 6\.|$)/);
            const redundancyMatch = response.match(/## 6\. REDUNDANCY VALUE[\s\S]*?(?=---|\*\*STRATEGIC|$)/);
            const recommendationsMatch = response.match(/\*\*STRATEGIC RECOMMENDATIONS:\*\*[\s\S]*$/);
            const riskContent = [riskMatch?.[0], redundancyMatch?.[0], recommendationsMatch?.[0]].filter(Boolean).join('\n\n');
            return riskContent ? `## Risk & Redundancy Analysis\n\n${riskContent}` : '## Risk & Redundancy\n\nNo risk analysis found.';

        default:
            return response;
    }
}

// Test the filtering
console.log('🧪 Testing Node-Level Filtering\n');

console.log('1️⃣ Power Generation:');
const powerResult = filterNodeLevelResponse(testData.nodeLevel, 'power_generation');
console.log(powerResult.includes('Bosque Power') ? '✅ Found Bosque Power' : '❌ Missing Bosque Power');
console.log(powerResult.includes('Lake Whitney') ? '✅ Found Lake Whitney' : '❌ Missing Lake Whitney');
console.log(powerResult.includes('No power generation') ? '❌ No power found' : '✅ Power found');

console.log('\n2️⃣ Transmission:');
const transmissionResult = filterNodeLevelResponse(testData.nodeLevel, 'transmission');
console.log(transmissionResult.includes('Oncor') ? '✅ Found Oncor' : '❌ Missing Oncor');
console.log(transmissionResult.includes('TNMP') ? '✅ Found TNMP' : '❌ Missing TNMP');
console.log(transmissionResult.includes('No transmission') ? '❌ No transmission found' : '✅ Transmission found');

console.log('\n3️⃣ Local Utilities:');
const utilityResult = filterNodeLevelResponse(testData.nodeLevel, 'local_utilities');
console.log(utilityResult.includes('Hill County Water') ? '✅ Found Hill County Water' : '❌ Missing Hill County Water');
console.log(utilityResult.includes('No utility') ? '❌ No utilities found' : '✅ Utilities found');

console.log('\n4️⃣ Risk & Redundancy:');
const riskResult = filterNodeLevelResponse(testData.nodeLevel, 'risk_redundancy');
console.log(riskResult.includes('Reliability Metrics') ? '✅ Found Reliability Metrics' : '❌ Missing Reliability Metrics');
console.log(riskResult.includes('Data Center Impact') ? '✅ Found Data Center Impact' : '❌ Missing Data Center Impact');

console.log('\n🧪 Testing Site-Level Filtering\n');

console.log('1️⃣ Power Generation:');
const sitePowerResult = filterSiteLevelResponse(testData.siteLevel, 'power_generation');
console.log(sitePowerResult.includes('POWER SCORE') ? '✅ Found POWER SCORE' : '❌ Missing POWER SCORE');
console.log(sitePowerResult.includes('No power analysis') ? '❌ No power analysis found' : '✅ Power analysis found');

console.log('\n2️⃣ Transmission:');
const siteTransmissionResult = filterSiteLevelResponse(testData.siteLevel, 'transmission');
console.log(siteTransmissionResult.includes('TRANSMISSION CAPACITY') ? '✅ Found TRANSMISSION CAPACITY' : '❌ Missing TRANSMISSION CAPACITY');
console.log(siteTransmissionResult.includes('ERCOT INTEGRATION') ? '✅ Found ERCOT INTEGRATION' : '❌ Missing ERCOT INTEGRATION');
console.log(siteTransmissionResult.includes('No transmission') ? '❌ No transmission found' : '✅ Transmission found');

console.log('\n3️⃣ Risk & Redundancy:');
const siteRiskResult = filterSiteLevelResponse(testData.siteLevel, 'risk_redundancy');
console.log(siteRiskResult.includes('RISK FACTORS') ? '✅ Found RISK FACTORS' : '❌ Missing RISK FACTORS');
console.log(siteRiskResult.includes('REDUNDANCY VALUE') ? '✅ Found REDUNDANCY VALUE' : '❌ Missing REDUNDANCY VALUE');
console.log(siteRiskResult.includes('STRATEGIC RECOMMENDATIONS') ? '✅ Found STRATEGIC RECOMMENDATIONS' : '❌ Missing STRATEGIC RECOMMENDATIONS');

console.log('\n✅ Filtering test completed!');
