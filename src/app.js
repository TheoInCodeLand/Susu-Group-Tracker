/**
 * app.js – Express application factory.
 *
 * Kept separate from server.js so tests can import the app
 * without binding a port.
 */

const express = require('express');
const path = require('path');
const routes = require('./routes/index');

function createApp() {
  const app = express();

  // ── View engine ───────────────────────────────────────────────────────────
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));

  // ── Static assets ─────────────────────────────────────────────────────────
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use('/', routes);

  // ── 404 handler ───────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).render('error', {
      error: `Page not found: ${req.path}`,
      group: null,
      success: null,
    });
  });

  return app;
}

module.exports = createApp;
