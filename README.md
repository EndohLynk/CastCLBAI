# CLB AI Library

A full-stack library management demo for school book lending with authentication, approval workflow, and analytics.

## Features

- User registration and login
- Manager and user roles
- Book catalog with search
- Borrow request lifecycle: pending -> approved -> returned
- Stats dashboard for inventory and requests
- SQLite persistence for real database storage

## Run locally

```bash
npm install
npm start
```

Then open:

- http://localhost:3000/

## Deploy to Render

1. Push this repository to GitHub.
2. Import it into Render.
3. Use the provided `render.yaml` configuration.
4. Render will install dependencies and start the app with `npm start`.

## Notes

This is a production-ready demo architecture, but the app is still intended for educational and prototype use unless you add stronger authentication, authorization, and production hosting safeguards.
