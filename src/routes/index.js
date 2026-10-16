/**
 * routes/index.js
 *
 * All HTTP routes for the Susu Manager web interface.
 * Uses EJS templates for server-rendered HTML pages.
 */

const express = require('express');
const router = express.Router();
const SusuGroup = require('../SusuGroup');
const { SusuError } = require('../errors');

// ─── In-memory store (one group per server instance) ─────────────────────────
// In a real production app this would be replaced with a database.
// We export `store` so tests can reset it between test cases.
const store = { group: null };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Render a page with a shared layout context. */
function render(res, view, locals = {}, statusCode = 200) {
  res.status(statusCode).render(view, {
    group: store.group,
    error: null,
    success: null,
    ...locals,
  });
}

/** Wrap a route handler; catch SusuErrors and re-render with an error message. */
function susuRoute(view, handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof SusuError) {
        render(res, view, { error: err.message }, 400);
      } else {
        console.error(err);
        render(res, 'error', { error: 'An unexpected error occurred.' }, 500);
      }
    }
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET / — Home / dashboard
router.get('/', (req, res) => {
  if (!store.group) {
    return res.render('setup', { error: null, success: null, group: null });
  }
  const report = store.group.getReport();
  render(res, 'dashboard', { report });
});

// POST /setup — Create a new group
router.post(
  '/setup',
  susuRoute('setup', (req, res) => {
    const { groupName, weeklyAmount } = req.body;
    if (!groupName || !weeklyAmount) {
      throw Object.assign(new Error('Group name and weekly amount are required.'), {
        name: 'SusuError',
      });
    }
    store.group = new SusuGroup(groupName.trim(), weeklyAmount);
    const report = store.group.getReport();
    render(res, 'dashboard', {
      report,
      success: `Group "${store.group.groupName}" created with GHS ${store.group.weeklyAmount.toFixed(2)}/week.`,
    });
  })
);

// POST /members — Add a member
router.post(
  '/members',
  susuRoute('dashboard', (req, res) => {
    if (!store.group) return res.redirect('/');
    const { memberName } = req.body;
    store.group.addMember(memberName);
    const report = store.group.getReport();
    render(res, 'dashboard', {
      report,
      success: `Member "${memberName.trim()}" added to the group.`,
    });
  })
);

// POST /contribute — Record a contribution
router.post(
  '/contribute',
  susuRoute('dashboard', (req, res) => {
    if (!store.group) return res.redirect('/');
    const { memberName, week, amount } = req.body;
    store.group.recordContribution(memberName, Number(week), amount);
    const report = store.group.getReport();
    render(res, 'dashboard', {
      report,
      success: `GHS ${Number(amount).toFixed(2)} recorded for ${memberName} (Week ${week}).`,
    });
  })
);

// POST /close-week — Attempt to close the current week
router.post(
  '/close-week',
  susuRoute('dashboard', (req, res) => {
    if (!store.group) return res.redirect('/');
    const result = store.group.closeWeek();
    const report = store.group.getReport();

    if (result.closed) {
      render(res, 'dashboard', {
        report,
        success: `Week ${result.payout.week} closed! ${result.payout.recipient} receives GHS ${result.payout.amount.toFixed(2)}.`,
      });
    } else {
      const lines = result.outstanding
        .map((o) => `${o.member} owes GHS ${o.owes.toFixed(2)}`)
        .join('; ');
      render(res, 'dashboard', {
        report,
        error: `Week cannot close. Outstanding balances: ${lines}.`,
      });
    }
  })
);

// GET /report — JSON report (useful for testing / API consumers)
router.get('/report', (req, res) => {
  if (!store.group) {
    return res.status(404).json({ error: 'No group has been created yet.' });
  }
  res.json(store.group.getReport());
});

// POST /reset — Reset the in-memory store (development / testing only)
router.post('/reset', (req, res) => {
  store.group = null;
  res.redirect('/');
});

module.exports = router;
module.exports.store = store;
