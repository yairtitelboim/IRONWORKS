// Debug the regex pattern for source links
const testText = `- **Source Link:** https://www.eia.gov/electricity/data/eia860/  
- **Last Updated:** October 2023

- **Source Links:** https://www.eia.gov/electricity/data/eia860/, https://www.ferc.gov/market-oversight/markets-electricity  
- **Last Updated:** October 2023`;

console.log('🧪 Debugging Source Link Regex\n');

console.log('📝 Test Text:');
console.log(testText);
console.log('\n');

// Test individual regex patterns
const sourceLinkPattern = /- \*\*Source Link:\*\* (https?:\/\/[^\s\n]+)\s*/g;
const sourceLinksPattern = /- \*\*Source Links:\*\* (https?:\/\/[^\s\n,]+(?:,\s*https?:\/\/[^\s\n,]+)*)\s*/g;

console.log('🔍 Testing Source Link Pattern:');
console.log('Pattern:', sourceLinkPattern);
let match;
while ((match = sourceLinkPattern.exec(testText)) !== null) {
    console.log('  Match found:', match[0]);
    console.log('  URL:', match[1]);
}

console.log('\n🔍 Testing Source Links Pattern:');
console.log('Pattern:', sourceLinksPattern);
while ((match = sourceLinksPattern.exec(testText)) !== null) {
    console.log('  Match found:', match[0]);
    console.log('  URLs:', match[1]);
}

// Test the actual conversion
console.log('\n🔄 Testing Conversion:');
let converted = testText
    .replace(/- \*\*Source Link:\*\* (https?:\/\/[^\s\n]+)\s*/g, '- <strong>Source Link:</strong> <a href="$1" target="_blank" class="source-link">$1</a>')
    .replace(/- \*\*Source Links:\*\* (https?:\/\/[^\s\n,]+(?:,\s*https?:\/\/[^\s\n,]+)*)\s*/g, (match, links) => {
        const linkArray = links.split(',').map(link => link.trim());
        const linkHtml = linkArray.map(link => `<a href="${link}" target="_blank" class="source-link">${link}</a>`).join(', ');
        return `- <strong>Source Links:</strong> ${linkHtml}`;
    });

console.log('Converted:');
console.log(converted);

// Check for clickable links
const linkMatches = converted.match(/<a href="https?:\/\/[^"]+" target="_blank" class="source-link">[^<]+<\/a>/g);
if (linkMatches) {
    console.log(`\n✅ Found ${linkMatches.length} clickable links:`);
    linkMatches.forEach((link, index) => {
        console.log(`  ${index + 1}. ${link}`);
    });
} else {
    console.log('\n❌ No clickable links found');
}
