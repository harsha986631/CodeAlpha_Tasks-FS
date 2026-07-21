# SimpleShop — Single-File E-commerce Demo

A complete, working e-commerce site (products, cart, checkout, login/register)
built with **Express.js**. The backend, the API, and the entire frontend
(HTML/CSS/JS) all live in **one file: `server.js`**, so it's easy to read
top to bottom and easy to run.

## Features
- Product listing + product detail pages
- Shopping cart (add / update quantity / remove), persisted per session
- User registration & login (passwords hashed with bcrypt, sessions via cookies)
- Order processing / checkout with stock deduction, plus an order history page
- Simple JSON-file "database" (`db.json`) — auto-created and seeded with 8
  sample products the first time you run the server. No external DB setup needed.

## Requirements
- Node.js 18+ 

## Setup & Run
```bash
npm install express express-session bcryptjs
node server.js
```
Then open **http://localhost:3000** in your browser.

That's it — no build step, no separate frontend server, no database server to install.

## Project structure
```
server.js      <- everything: Express routes, API, and the embedded frontend
package.json   <- dependency list
db.json        <- auto-created on first run (your local "database")
```

## Notes
- `db.json` is created next to `server.js` the first time you start the
  server. Delete it any time to reset to the original seed data.
- Session secret in the code is a placeholder (`dev-secret-change-me-in-production`)
  — swap it out (and use HTTPS + `cookie.secure: true`) before deploying for real.
- This is intentionally simple (JSON-file storage instead of a real database,
  in-memory sessions) so the whole app fits in one readable file — swap in
  SQLite/Postgres and `connect-mongo`/`connect-redis` style session stores if
  you want to harden it for production.
