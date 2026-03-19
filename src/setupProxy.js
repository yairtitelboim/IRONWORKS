const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://127.0.0.1:3001',
      changeOrigin: true,
      timeout: 30000, // 30 second timeout
      proxyTimeout: 30000, // 30 second proxy timeout
      // No pathRewrite - forward exactly as is
    })
  );
};
