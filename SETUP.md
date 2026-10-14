# CRM-RE Setup Guide

## Prerequisites

- Node.js 20+
- MongoDB running locally on port 27017 (or update `backend/config/config.env`)

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm install
npm run seed    # Seeds the database with demo data
npm run dev     # Starts backend on http://localhost:5000
```

### 2. Frontend Setup

```bash
# From project root
npm install
npm run dev     # Starts frontend on http://localhost:5173
```

### 3. Login

Open http://localhost:5173 and use these credentials:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@propcrm.com | Admin123 |
| Staff | priya@propcrm.com | Staff123 |
| Partner | srinivas@realty.com | Partner123 |

## Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express 5 + Mongoose 9 + MongoDB
- **Auth**: JWT Bearer tokens (7-day expiry)
- **API**: RESTful at `/api/v1/*` with pagination support

## API Documentation

Start the backend, then visit: http://localhost:5000/api-docs

## Environment Variables

### Frontend (`.env`)
```
VITE_API_URL=https://crm-backend-5y4p.onrender.com/api/v1
```

### Backend (`backend/config/config.env`)
```
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/real_estate_crm
JWT_SECRET=your_jwt_secret_key_here_change_in_production
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
RATE_LIMIT_MAX=100
```
