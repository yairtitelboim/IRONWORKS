// Debug node name extraction
const testNode = `## NODE 1: **Bosque Power Co LLC**
- **Type:** Power Plant (Natural Gas, Combined Cycle) [EIA-860]`;

console.log('Original node text:', testNode);
console.log('Split by newline:', testNode.split('\n')[0]);
console.log('After replace:', testNode.split('\n')[0].replace(/^## NODE \d+:\s*\*\*/, '').replace(/\*\*$/, '').trim());

// Test the correct regex
const correctRegex = /^## NODE \d+:\s*\*\*(.+?)\*\*$/;
const match = testNode.split('\n')[0].match(correctRegex);
console.log('Correct regex match:', match);
if (match) {
    console.log('Extracted name:', match[1].trim());
}
