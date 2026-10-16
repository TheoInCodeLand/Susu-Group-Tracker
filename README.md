# Susu Manager

A web-based rotating savings group (susu) manager built with **Node.js**, **Express**, **EJS** and vanilla **CSS/JS**.

---

## What is a Susu?

A susu is a rotating savings scheme common in West Africa.  
A group of members each pay the same fixed amount every week. The whole weekly pot is paid out to one member per week, in the order they joined, until every member has received the pot once.

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 18 |
| npm | 9 |

---

## Installation

```bash
# Clone or download the repository, then:
npm install
```

---

## Running the App

```bash
# Standard start
npm start

# Auto-restart on file changes (development)
npm run dev
```

Open your browser at **http://localhost:3000**

> The default port is `3000`. Set the `PORT` environment variable to override:
> ```bash
> PORT=4000 npm start
> ```

---

## Running the Tests

```bash
npm test
```

All 20+ test cases will run. You should see output similar to:

```
PASS tests/susuGroup.test.js
  Group creation       ✓ (3 tests)
  Member management    ✓ (4 tests)
  Contributions        ✓ (7 tests)
  Week closing         ✓ (5 tests)
  Report               ✓ (2 tests)
  Edge cases           ✓ (2 tests)
```

---

## How to Use the App

1. **Create a group** – Enter a group name and the fixed weekly contribution (GHS) on the home page.
2. **Add members** – Use the "Add Member" form on the dashboard. Members must be added *before* the first contribution is recorded.
3. **Record contributions** – Select a member, confirm the week number, and enter the GHS amount. Partial payments are accepted.
4. **Close the week** – Click "Close Week". If all members have paid in full, the pot is disbursed to the next member in rotation and the week advances. If not, you will see who still owes and how much.
5. **View history** – The dashboard shows the full payout history and rotation order at all times.

---

## JSON API

The app also exposes a read-only JSON endpoint for programmatic access:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/report` | Full group report as JSON |

---

## Project Structure

```
susu-manager/
├── src/
│   ├── app.js          # Express app factory
│   ├── server.js       # HTTP server entry point
│   ├── SusuGroup.js    # Core business logic
│   ├── models.js       # Data models (Member, Contribution, PayoutRecord)
│   ├── errors.js       # Custom error classes
│   └── routes/
│       └── index.js    # All Express routes
├── views/
│   ├── setup.ejs       # Group creation page
│   ├── dashboard.ejs   # Main dashboard
│   └── error.ejs       # Error page
├── public/
│   ├── css/style.css   # All styles
│   └── js/main.js      # Client-side JS
├── tests/
│   └── susuGroup.test.js  # Jest test suite
├── package.json
├── README.md
└── NOTES.md
```
