const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === '/' || req.url === '/index.html') {
        // Serve the React table
        fs.readFile('test_frontend_react_table.html', (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading React table');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`🚀 React Table Server running at http://localhost:${PORT}`);
    console.log('📊 Professional data center analysis table with TanStack React Virtual');
    console.log('🎨 Modern UI with proper formatting and interactivity');
});
