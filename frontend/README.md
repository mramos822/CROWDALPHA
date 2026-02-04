# CrowdAlpha Frontend

A modern, responsive React + TypeScript frontend for CrowdAlpha, an AI-powered investing app.

## Features

- **Dashboard**: Portfolio overview with KPIs and mini charts
- **Portfolio**: Holdings table with P/L tracking and risk analysis
- **Signals**: AI-powered investment signals with filtering and alerts
- **IPOs**: IPO calendar with detailed company information
- **Groups**: Investment groups with leaderboards and competitions
- **Settings**: Profile management and notification preferences

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **shadcn/ui** for UI components
- **Zustand** for state management
- **React Router** for navigation
- **React Hook Form** + **Zod** for form validation
- **Recharts** for data visualization
- **Lucide React** for icons

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open [http://localhost:5173](http://localhost:5173) in your browser

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   └── layout/         # Layout components (Navbar, Sidebar)
├── pages/              # Page components
├── store/              # Zustand store slices
├── lib/                # Utilities and API services
├── types.ts            # TypeScript type definitions
└── App.tsx             # Main app component
```

## Mock Data

The app currently uses mock data and APIs that simulate real backend responses. The mock API service is located in `src/lib/api.ts` and can be easily swapped for real backend endpoints.

## Features Implemented

✅ Authentication (login/register with form validation)  
✅ Responsive design with mobile navigation  
✅ Dark/light theme toggle  
✅ Dashboard with portfolio summary and charts  
✅ Portfolio page with holdings table and risk analysis  
✅ Signals page with filtering and alert creation  
✅ IPO calendar with detailed company information  
✅ Groups page with leaderboards and creation modal  
✅ Settings page with profile and notification management  
✅ Loading states and error handling  
✅ Form validation with Zod schemas  

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint