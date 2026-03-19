const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  console.log(`📥 Request: ${req.method} ${req.url}`);
  
  let filePath = req.url === '/' ? '/test_frontend_fidelity.html' : req.url;
  filePath = path.join(__dirname, filePath);
  
  console.log(`📁 Serving file: ${filePath}`);
  
  const extname = path.extname(filePath);
  let contentType = 'text/html';
  
  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
  }
  
  console.log(`📄 Content-Type: ${contentType}`);
  
  fs.readFile(filePath, (error, content) => {
    if (error) {
      console.log(`❌ File error: ${error.code} for ${filePath}`);
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      console.log(`✅ Serving ${filePath} (${content.length} bytes)`);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Test server running at http://localhost:${PORT}`);
  console.log('📱 Open your browser and navigate to the URL above');
  console.log('🔧 Use the controls to test different categories and view modes');
});
