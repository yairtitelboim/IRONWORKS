// Test the source link conversion functionality
const testResponse = `## NODE 1: **Bosque Power Co LLC**

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

**4. RELIABILITY METRICS:**  
- **Historical Outages:** No major outages reported 2022–2024 [EIA Plant Operations]  
- **Fuel Dependencies:** Natural gas, dual-fuel capability [EIA Fuel Data]  
- **Weather Resilience:** Upgrades post-2021 winter event [FERC Reliability Studies]  
- **Maintenance History:** Scheduled annual maintenance, no extended forced outages [EIA Plant Data]  
- **Source Links:** https://www.eia.gov/electricity/data/eia860/, https://www.ferc.gov/market-oversight/markets-electricity  
- **Last Updated:** October 2023`;

function displayResponse(response) {
    // Convert markdown-like formatting to HTML (same as in test_frontend.html)
    let html = response
        .replace(/## (.*?)\n/g, '<h2>$1</h2>')
        .replace(/### (.*?)\n/g, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="source-link">$1</a>')
        // Convert Source Link format: - **Source Link:** https://example.com  
        .replace(/- \*\*Source Link:\*\* (https?:\/\/[^\s\n]+)\s*/g, '- <strong>Source Link:</strong> <a href="$1" target="_blank" class="source-link">$1</a>')
        // Convert Source Links format: - **Source Links:** https://example.com, https://example2.com  
        .replace(/- \*\*Source Links:\*\* (https?:\/\/[^\s\n,]+(?:,\s*https?:\/\/[^\s\n,]+)*)\s*/g, (match, links) => {
            const linkArray = links.split(',').map(link => link.trim());
            const linkHtml = linkArray.map(link => `<a href="${link}" target="_blank" class="source-link">${link}</a>`).join(', ');
            return `- <strong>Source Links:</strong> ${linkHtml}`;
        })
        .replace(/\n/g, '<br>');
    
    return html;
}

console.log('🧪 Testing Source Link Conversion\n');

const convertedHtml = displayResponse(testResponse);

console.log('✅ Converted HTML:');
console.log(convertedHtml);

console.log('\n🔍 Source Link Analysis:');
const sourceLinkMatches = convertedHtml.match(/<a href="https?:\/\/[^"]+" target="_blank" class="source-link">[^<]+<\/a>/g);
if (sourceLinkMatches) {
    console.log(`   Found ${sourceLinkMatches.length} clickable source links:`);
    sourceLinkMatches.forEach((link, index) => {
        const urlMatch = link.match(/href="([^"]+)"/);
        const textMatch = link.match(/>([^<]+)</);
        if (urlMatch && textMatch) {
            console.log(`   ${index + 1}. ${textMatch[1]} → ${urlMatch[1]}`);
        }
    });
} else {
    console.log('   ❌ No source links found');
}

console.log('\n✅ Source link conversion test completed!');
