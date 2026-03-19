const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

async function extractTextFromPDF(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    console.error(`Error extracting text from ${pdfPath}:`, error.message);
    return null;
  }
}

async function processDocument(pdfPath) {
  const text = await extractTextFromPDF(pdfPath);
  if (!text) return null;

  // Split text into sections based on headings
  const sections = [];
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  let currentSection = { heading: '', text: [] };

  for (const line of lines) {
    // Heuristic for heading detection
    if (line.length < 100 && (line.toUpperCase() === line || /^[A-Z][^.!?]*[.!?]$/.test(line))) {
      if (currentSection.text.length > 0) {
        sections.push({
          heading: currentSection.heading,
          text: currentSection.text.join(' ')
        });
      }
      currentSection = { heading: line, text: [] };
    } else {
      currentSection.text.push(line);
    }
  }

  // Add the last section
  if (currentSection.text.length > 0) {
    sections.push({
      heading: currentSection.heading,
      text: currentSection.text.join(' ')
    });
  }

  // Create summary from first few sections
  const summary = sections.slice(0, 3).map(s => s.text).join('\n\n');

  return {
    content: {
      summary,
      sections
    }
  };
}

async function extractAllDocs() {
  const docsDir = path.join(process.cwd(), 'public', 'planningDocs');
  const outputDir = path.join(process.cwd(), 'public', 'processed_planning_docs', 'extracted_text');
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Get all PDF files recursively
  const pdfFiles = [];
  
  function findPDFs(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        findPDFs(fullPath);
      } else if (item.toLowerCase().endsWith('.pdf')) {
        pdfFiles.push(fullPath);
      }
    }
  }

  findPDFs(docsDir);
  console.log(`Found ${pdfFiles.length} PDF files to process\n`);

  // Process each PDF file
  for (let i = 0; i < pdfFiles.length; i++) {
    const pdfPath = pdfFiles[i];
    const fileName = path.basename(pdfPath, '.pdf');
    console.log(`Processing document ${i + 1}/${pdfFiles.length}: ${fileName}`);

    try {
      const doc = await processDocument(pdfPath);
      if (doc) {
        const outputPath = path.join(outputDir, `doc_${fileName}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(doc, null, 2));
        console.log(`Extracted text saved to ${outputPath}\n`);
      }
    } catch (error) {
      console.error(`Error processing ${fileName}:`, error.message);
    }
  }

  console.log('\nText extraction complete!');
}

// Run the extraction
extractAllDocs().catch(console.error); 