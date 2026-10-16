/**
 * server.js – Entry point.
 * Starts the HTTP server on PORT (default 3000).
 */

const createApp = require('./app');

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`\n🪙  Susu Manager running at http://localhost:${PORT}\n`);
});
