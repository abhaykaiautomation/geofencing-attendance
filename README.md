# Geofencing Attendance App

A production-ready, mobile-first Progressive Web App (PWA) for blue-collar employee attendance tracking using geolocation.

## Features

- **Mobile-First UX**: Responsive design optimized for mobile devices with large buttons and minimal typing.
- **Geolocation Detection**: Automatically detects employee location and suggests check-in/check-out based on proximity to assigned worksites.
- **Multi-Site Attendance**: Employees can work at multiple sites in a single day.
- **Admin Dashboard**: Manage worksites, employees, daily assignments, and view attendance reports.
- **PWA Ready**: Installable on mobile devices with offline capabilities.
- **Firebase Integration**: Authentication, Firestore database, and real-time updates.

## Tech Stack

- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS
- **Backend**: Firebase (Auth, Firestore)
- **Geolocation**: Browser Geolocation API with Haversine formula for distance calculation
- **PWA**: Next.js PWA plugin

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase project

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd geofencing
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up Firebase:
   - Create a Firebase project at https://console.firebase.google.com/
   - Enable Authentication and Firestore
   - Copy your Firebase config to `.env.local`:
     ```
     NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
     NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
     NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
     NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
     NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
     NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
     ```

4. Set up Firestore security rules (see firestore.rules)

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
geofencing/
├── app/
│   ├── admin/          # Admin dashboard pages
│   ├── employee/       # Employee dashboard pages
│   ├── login/          # Authentication page
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/         # Reusable components
├── contexts/           # React contexts
├── hooks/              # Custom hooks
├── lib/                # Firebase configuration
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── public/             # Static assets
```

## Firestore Data Model

### Collections

- **employees**: Employee information
- **worksites**: Worksite details with geolocation
- **assignments**: Daily worksite assignments per employee
- **attendanceSessions**: Check-in/check-out records

## Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy

### Other Platforms

Build the app:
```bash
npm run build
```

The built files will be in the `.next` directory.

## Usage

### For Employees

1. Log in with your credentials
2. Grant location permission
3. The app will suggest check-in when near assigned worksites
4. Check out when leaving the site

### For Admins

1. Log in with admin credentials
2. Manage worksites, employees, and assignments
3. Monitor attendance and generate reports

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.
