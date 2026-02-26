# TrackSure - Complete Project Context & Knowledge Base

> **Last Updated:** February 26, 2026
> **Purpose:** Full project analysis for AI assistant context. Covers architecture, data flow, every file, Supabase schema, APIs, and current state.

---

## 1. PROJECT OVERVIEW

**TrackSure** is a **React Native (Expo SDK 52)** mobile app for smart delivery monitoring. It targets logistics/courier companies and has two user roles: **Admin** and **Driver**. The backend is **Supabase** (PostgreSQL + Auth + Storage + Realtime). Google Maps APIs handle geocoding, directions, and route optimization.

**Tech Stack:**
- **Frontend:** React Native 0.76.9, Expo ~52.0.0 (New Architecture enabled)
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Realtime subscriptions)
- **Maps/Geo:** Google Maps Geocoding API, Directions API, Static Maps API
- **State Management:** React useState/useEffect (no Redux/Zustand)
- **Navigation:** React Navigation v7 (Stack Navigator)
- **Language:** JavaScript (no TypeScript)

**Entry Point:** `index.js` → `App.js` → `ThemeProvider` → `AppNavigator`

---

## 2. ENVIRONMENT VARIABLES

Stored in `.env` (not committed):
```
EXPO_PUBLIC_SUPABASE_URL=<supabase_project_url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<supabase_anon_key>
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=<google_maps_api_key>
```

Google Maps API Key is also hardcoded in `app.json` for native map rendering:
- iOS: `expo.ios.config.googleMapsApiKey`
- Android: `expo.android.config.googleMaps.apiKey`

---

## 3. COMPLETE FILE STRUCTURE & PURPOSE

```
d:\Buildathon\TrackSure\
│
├── App.js                          # Root component: ThemeProvider → AppNavigator
├── index.js                        # Expo registerRootComponent entry
├── app.json                        # Expo config (SDK 52, permissions, Google Maps keys)
├── package.json                    # Dependencies (expo, supabase, react-navigation, maps)
│
├── database/                       # SQL migration files for Supabase
│   ├── add_order_sequence.sql      # Adds `sequence` column to orders
│   ├── add_package_photos_rating.sql # Adds package photos, rating fields to delivery_proofs
│   ├── add_signature_and_vehicle.sql # Adds signature_data, delivery_notes, vehicle_type
│   └── cascade_delete_driver_locations.sql # CASCADE DELETE on driver_locations.order_id FK
│
├── src/
│   ├── navigation/
│   │   └── AppNavigator.js         # Auth-aware Stack Navigator (role-based screens)
│   │
│   ├── screens/
│   │   ├── index.js                # Barrel export (LoginScreen, RegisterScreen, AdminDashboard, DriverDashboard)
│   │   ├── LoginScreen.js          # Email/password auth, dark mode toggle, animated
│   │   ├── RegisterScreen.js       # Sign up with role selection (admin/driver)
│   │   ├── AdminDashboard.js       # Order list + action buttons (Create, Track, Analytics, Performance, Optimize)
│   │   ├── DriverDashboard.js      # Driver's order list + accept/en-route matching + location tracking
│   │   ├── CreateOrderScreen.js    # Create order: geocode addresses, route calc, vehicle type, driver assign
│   │   ├── LiveTrackingScreen.js   # Real-time driver location cards with reverse geocoding + "View on Map"
│   │   ├── DashboardScreen.js      # Analytics: orders, drivers, distance, fuel cost, flagged orders, performance bar
│   │   ├── OrderDetailsScreen.js   # Order detail view + delivery proof display (photo, signature, notes)
│   │   ├── DeliveryProofScreen.js  # Camera capture + signature + notes + geo-verification → submit proof
│   │   ├── DriverPerformanceScreen.js # Driver rankings by fuel efficiency, idle time, deliveries
│   │   └── RouteOptimizationScreen.js # Multi-stop route optimization via Google Directions waypoint API
│   │
│   ├── services/
│   │   ├── supabase.js             # Supabase client init (AsyncStorage for auth persistence)
│   │   ├── auth.js                 # signIn, signUp, signOut, getCurrentUser (profiles table for role)
│   │   ├── orders.js               # createOrder, getDrivers, getOrders (with driver join)
│   │   ├── driverOrders.js         # getDriverOrders, updateOrderStatus
│   │   ├── tracking.js             # getActiveDriverLocations, subscribeToDriverLocations (Realtime), updateDriverLocation
│   │   ├── location.js             # geocodeAddress (Google), getDistance (Google Directions w/ traffic + alternatives)
│   │   ├── deliveryProof.js        # verifyLocation (GPS), uploadDeliveryImage (Storage/base64), submitDeliveryProof
│   │   ├── analytics.js            # getDashboardStats (order counts, distances, flags)
│   │   ├── driverPerformance.js    # calculateIdleTime, getDriverPerformance, getDriverRankings
│   │   ├── routeOptimization.js    # optimizeMultiStopRoute (Google Directions waypoints optimize:true)
│   │   ├── enRouteMatching.js      # findOrdersAlongRoute, checkReturnTrip (smart order bundling)
│   │   └── fuelMonitoring.js       # calculateActualDistance (GPS trail), checkFuelMisuse (>20% deviation flag)
│   │
│   ├── utils/
│   │   ├── colors.js               # Colors (light) and DarkColors objects
│   │   ├── ThemeContext.js          # ThemeProvider + useTheme hook (AsyncStorage persisted)
│   │   ├── animations.js           # fadeIn, fadeOut, slideUp, scaleIn (Animated API)
│   │   ├── useLocationTracking.js  # Custom hook: GPS every 15s when driver has assigned order
│   │   ├── geocoding.js            # reverseGeocode (lat/lng → address via Google)
│   │   ├── fuelCalculator.js       # calculateFuelCost, calculateFuelSavings, getVehicleTypes
│   │   ├── CustomAlert.js          # Modal-based alert with image support (replaces Alert.alert)
│   │   ├── Toast.js                # Animated toast notification component
│   │   └── SignatureCapture.js     # Modal with react-native-signature-canvas
│   │
│   └── components/
│       └── index.js                # Placeholder exports (MapView, OrderCard, DriverMarker - NOT implemented)
│
├── assets/                         # Static assets (empty/default)
│
├── COMPLETE_IMPLEMENTATION.md      # Feature implementation summary
├── IMPLEMENTATION_SUMMARY.md       # Detailed implementation notes
├── RECOMMENDATIONS.md              # Future feature recommendations
├── EN_ROUTE_MATCHING_GUIDE.md      # En-route matching algorithm docs
├── ROUTE_OPTIMIZATION_GUIDE.md     # Route optimization docs
└── CONTEXT_KNOWLEDGEBASE.md        # THIS FILE
```

---

## 4. SUPABASE DATABASE SCHEMA

### Table: `profiles`
| Column    | Type    | Notes |
|-----------|---------|-------|
| id        | UUID    | PK, references auth.users |
| full_name | TEXT    | |
| email     | TEXT    | |
| role      | TEXT    | 'admin' or 'driver' |

### Table: `orders`
| Column           | Type        | Notes |
|------------------|-------------|-------|
| id               | UUID        | PK |
| pickup_address   | TEXT        | Formatted address from geocoding |
| drop_address     | TEXT        | Formatted address from geocoding |
| pickup_lat       | DECIMAL     | |
| pickup_lng       | DECIMAL     | |
| drop_lat         | DECIMAL     | |
| drop_lng         | DECIMAL     | |
| driver_id        | UUID        | FK → profiles.id |
| status           | TEXT        | 'pending', 'assigned', 'delivered' |
| planned_distance | DECIMAL     | km (from Google Directions) |
| actual_distance  | DECIMAL     | km (calculated from GPS trail) |
| is_flagged       | BOOLEAN     | True if route deviation > 20% |
| flag_reason      | TEXT        | Description of deviation |
| vehicle_type     | VARCHAR(20) | 'bike', 'car', 'van' (default 'bike') |
| sequence         | INTEGER     | Delivery sequence for multi-stop (default 1) |
| idle_time_minutes| INTEGER     | Total idle time (default 0) |
| created_at       | TIMESTAMP   | Auto |

### Table: `driver_locations`
| Column      | Type      | Notes |
|-------------|-----------|-------|
| id          | UUID      | PK |
| driver_id   | UUID      | FK → profiles.id |
| order_id    | UUID      | FK → orders.id (CASCADE DELETE) |
| latitude    | DECIMAL   | |
| longitude   | DECIMAL   | |
| recorded_at | TIMESTAMP | Auto |

### Table: `delivery_proofs`
| Column              | Type      | Notes |
|---------------------|-----------|-------|
| id                  | UUID      | PK |
| order_id            | UUID      | FK → orders.id |
| driver_id           | UUID      | FK → profiles.id |
| image_url           | TEXT      | Public URL from Supabase Storage or base64 data URL |
| latitude            | DECIMAL   | Driver's GPS at delivery time |
| longitude           | DECIMAL   | |
| signature_data      | TEXT      | Base64 signature from canvas |
| delivery_notes      | TEXT      | Optional driver notes |
| package_before_photo| TEXT      | DB ready, UI not implemented |
| package_after_photo | TEXT      | DB ready, UI not implemented |
| customer_rating     | INTEGER   | 1-5, DB ready, UI not implemented |
| customer_feedback   | TEXT      | DB ready, UI not implemented |
| delivered_at        | TIMESTAMP | Auto |

### Supabase Storage Bucket
- **Bucket name:** `delivery-proofs` (public)
- Used for delivery photo uploads (JPEG)
- Fallback: base64 data URL if storage upload fails

### Supabase Realtime
- **Channel:** `driver_locations` table
- **Event:** INSERT on `public.driver_locations`
- Used in `LiveTrackingScreen` for real-time driver position updates

---

## 5. AUTHENTICATION & AUTHORIZATION FLOW

1. **Supabase Auth** handles email/password sign-up and sign-in
2. On sign-up, a corresponding `profiles` record is inserted with `role` ('admin' or 'driver')
3. `getCurrentUser()` fetches the auth user + joins with `profiles` to get role and full_name
4. `AppNavigator` conditionally renders screen stacks based on `user.role`:
   - **Not authenticated:** Login, Register
   - **Admin:** AdminDashboard, CreateOrder, LiveTracking, Dashboard, OrderDetails, DriverPerformance, RouteOptimization
   - **Driver:** DriverDashboard, OrderDetails, DeliveryProof
5. Auth state changes are listened to via `supabase.auth.onAuthStateChange`
6. Sessions are persisted via AsyncStorage

---

## 6. CORE FEATURE FLOWS

### 6.1 Order Creation (Admin)
1. Admin enters pickup address, drop address, selects driver and vehicle type
2. "Use Current Location" button reverse-geocodes GPS → address
3. On submit: Google Geocoding API converts addresses → lat/lng
4. Google Directions API calculates distance (with traffic, alternatives)
5. Order inserted into `orders` table with status='pending'
6. Success dialog shows route options, distance, duration, static map preview, "View Route" link

### 6.2 Order Acceptance & En-Route Matching (Driver)
1. Driver sees pending orders, taps "Accept Order"
2. System runs `findOrdersAlongRoute()` to check if other pending orders are on the route:
   - **Return Trip Detection:** If order B's pickup ≈ order A's drop AND order B's drop ≈ order A's pickup (within 3km)
   - **Along-Route Detection:** Uses triangle inequality — if detour via point C from A→B is < 2km threshold
3. If matches found, modal shows recommendations with "Accept All" or "Just This One"
4. Order status updated to 'assigned'
5. `useLocationTracking` hook starts GPS tracking every 15 seconds

### 6.3 Location Tracking
- **Driver side:** `useLocationTracking` hook polls GPS every 15s, inserts into `driver_locations` with order_id
- **Admin side:** `LiveTrackingScreen` fetches latest locations, subscribes to Realtime INSERT events
- Each driver card shows: name, reverse-geocoded address, timestamp, "View on Map" (opens Google Maps)

### 6.4 Delivery Proof Submission (Driver)
1. Driver captures photo via camera (expo-image-picker)
2. Adds optional delivery notes
3. Gets customer signature via `SignatureCapture` canvas
4. On submit:
   a. `verifyLocation()` — checks GPS proximity to drop location (50m threshold, currently disabled for testing)
   b. `uploadDeliveryImage()` — tries Supabase Storage bucket, falls back to base64
   c. `submitDeliveryProof()` — inserts into `delivery_proofs`, then calls `updateActualDistance()` which:
      - Calculates actual distance from GPS trail in `driver_locations`
      - Updates `orders.actual_distance`
      - Runs `checkFuelMisuse()` — flags order if actual > planned × 1.2

### 6.5 Fuel Monitoring & Flagging
- `calculateActualDistance()`: Sums Haversine distances between consecutive GPS points for an order
- `checkFuelMisuse()`: If actual_distance > planned_distance × 1.2, sets `is_flagged=true` with reason
- Dashboard shows total flagged orders and actual vs planned fuel costs
- `calculateFuelCost()`: distance / vehicle efficiency × fuel price (₹100/L)

### 6.6 Route Optimization (Admin)
1. Lists drivers with 2+ pending/assigned orders
2. On select: calls Google Directions API with `waypoints=optimize:true`
3. Gets optimal stop sequence, total distance, duration
4. Shows savings (distance/time) and reordered delivery sequence
5. "Apply Optimization" updates `sequence` column on each order

### 6.7 Driver Performance (Admin)
- `getDriverPerformance()`: For each driver's delivered orders, calculates:
  - Total deliveries
  - Total planned vs actual distance
  - Fuel efficiency % (actual/planned × 100)
  - Fuel efficiency score (100 - deviation from 100%)
  - Total idle time (from GPS points where movement < 50m over 5+ minutes)
- `getDriverRankings()`: All drivers sorted by fuel efficiency score
- Screen shows medal rankings (🥇🥈🥉), progress bars

### 6.8 Analytics Dashboard (Admin)
- Total orders, delivered orders, completion rate
- Active drivers count, avg orders per driver
- Total distance (planned + actual)
- Fuel cost analysis (planned cost, actual cost, savings, liters used)
- Flagged orders count
- Overall performance bar

---

## 7. GOOGLE MAPS API USAGE

| API | Used In | Purpose |
|-----|---------|---------|
| Geocoding API | `location.js` → `geocodeAddress()` | Address → lat/lng |
| Reverse Geocoding | `geocoding.js` → `reverseGeocode()` | lat/lng → address |
| Directions API | `location.js` → `getDistance()` | Distance/duration with traffic + alternatives |
| Directions API | `routeOptimization.js` → `optimizeMultiStopRoute()` | Waypoint optimization |
| Static Maps API | `CreateOrderScreen.js` | Route preview image in success dialog |

**Key parameters used:**
- `departure_time=now` — real-time traffic
- `traffic_model=best_guess` — traffic estimation
- `alternatives=true` — multiple route options
- `waypoints=optimize:true|...` — TSP-like optimization

---

## 8. UI/UX DETAILS

### Theme System
- Light and Dark mode supported via `ThemeContext`
- Theme preference persisted in AsyncStorage
- Toggle on Login screen
- All screens use `useTheme()` hook for dynamic colors

### Color Palette (Light)
- Primary: `#1E3A8A` (dark blue), `#2563EB` (blue)
- Success: `#10B981` (green)
- Warning: `#F59E0B` (amber)
- Error: `#EF4444` (red)
- Background: `#F3F4F6`
- Cards: `#FFFFFF`

### Custom UI Components
- **CustomAlert:** Modal-based replacement for `Alert.alert`, supports images (route maps)
- **Toast:** Animated slide-down notification (success/error/warning)
- **SignatureCapture:** Full-screen modal with `react-native-signature-canvas`

### Animations
- Login/Register: `fadeIn` + `slideUp` on mount
- Toast: spring animation for enter, timing for exit

### Navigation
- Stack Navigator with horizontal iOS-style card transitions
- Gesture-enabled back navigation
- No tab navigator — linear stack per role

---

## 9. KEY ALGORITHMS

### Haversine Distance (used in 3 files)
```
R = 6371 km (or 6371e3 m)
a = sin²(Δφ/2) + cos(φ1)·cos(φ2)·sin²(Δλ/2)
c = 2·atan2(√a, √(1−a))
d = R·c
```
Used in: `deliveryProof.js` (meters), `driverPerformance.js` (meters), `enRouteMatching.js` (km), `fuelMonitoring.js` (km)

### En-Route Matching
- **Along-Route Check:** If `distance(A,C) + distance(C,B) - distance(A,B) < threshold (2km)`, point C is along route A→B
- **Return Trip Check:** If pickup of new order is near drop of current order (≤3km) AND drop of new order is near pickup of current order (≤3km)
- **Loose Return:** One end < 0.5km perfect match AND both within 10km

### Fuel Misuse Detection
- After delivery, actual GPS trail distance is calculated
- If `actualDistance > plannedDistance × 1.2` → order flagged
- Flag reason includes deviation in km and %

### Idle Time Detection
- Consecutive GPS points examined
- If movement < 50m AND time gap ≥ 5 minutes → counted as idle time
- Total idle time reported per order/driver

---

## 10. DEPENDENCIES

| Package | Version | Purpose |
|---------|---------|---------|
| expo | ~52.0.0 | React Native framework |
| react-native | 0.76.9 | Core |
| @supabase/supabase-js | ^2.97.0 | Backend client |
| @react-navigation/native | ^7.1.31 | Navigation |
| @react-navigation/stack | ^7.8.2 | Stack navigator |
| react-native-maps | 1.18.0 | Map rendering (not actively used in screens) |
| expo-location | ~18.0.10 | GPS tracking |
| expo-image-picker | ~16.0.6 | Camera access |
| expo-linear-gradient | ^55.0.8 | Login screen gradient |
| @react-native-picker/picker | 2.9.0 | Dropdown selects |
| react-native-signature-canvas | ^5.0.2 | Signature capture |
| @react-native-async-storage/async-storage | 1.23.1 | Local storage |
| react-native-gesture-handler | ~2.20.2 | Gesture support |
| react-native-reanimated | ~3.16.1 | Animations |
| react-native-screens | ~4.4.0 | Native screen containers |
| react-native-safe-area-context | 4.12.0 | Safe area insets |
| react-native-url-polyfill | ^3.0.0 | URL polyfill for Supabase |

---

## 11. CURRENT STATE & KNOWN ISSUES

### Fully Implemented (Working)
- Auth (login/register with roles)
- Order CRUD (create, list, detail view)
- Live driver location tracking (15s interval + Realtime subscription)
- Delivery proof (photo + signature + notes + geo-verification)
- Fuel cost calculation with vehicle types
- Fuel misuse detection & flagging
- Route alternatives display
- Multi-stop route optimization
- En-route order matching (return trips + along-route)
- Driver performance rankings
- Analytics dashboard
- Dark/light theme with persistence
- Custom UI (Toast, CustomAlert, SignatureCapture)

### Database Ready But UI Not Implemented
- Package before/after photos (`package_before_photo`, `package_after_photo`)
- Customer rating (1-5 stars) (`customer_rating`, `customer_feedback`)
- Idle time minutes per order (`idle_time_minutes` column exists, calculated but not written back)

### Known Quirks
1. **Location verification disabled for testing:** In `deliveryProof.js`, `verifyLocation()` always returns `isValid: true` regardless of distance
2. **components/index.js** exports MapView, OrderCard, DriverMarker that **don't exist** — these are placeholder stubs
3. **No offline support** — requires network for all operations
4. **No push notifications** — all updates require app to be open
5. **Image upload fallback:** If Supabase Storage bucket doesn't exist, falls back to base64 data URL (stored in DB directly)
6. **Logout uses `global.location.reload()`** which is a web-only pattern; on native it does nothing (but auth state change listener handles re-render anyway)
7. **Google Maps API key exposed** in `app.json` — should be restricted by platform in Google Console
8. **No input validation** on addresses beyond geocoding success/failure
9. **`react-native-maps` imported in package.json but not used** in any screen — LiveTrackingScreen uses card-based UI with "View on Map" linking to Google Maps instead
10. **Fuel price hardcoded** at ₹100/liter in `fuelCalculator.js`

### Not Yet Implemented (Future)
- Push/SMS/Email notifications
- Historical traffic analysis
- Batch order upload (CSV)
- Monthly fuel reports (PDF/Excel export)
- Customer-facing portal
- Multi-language support
- Predictive delivery times (ML)
- Third-party API integrations

---

## 12. SUPABASE REALTIME CHANNELS

| Channel | Table | Event | Used In |
|---------|-------|-------|---------|
| `driver_locations` | `driver_locations` | INSERT | `LiveTrackingScreen.js` via `tracking.js` |

Auth state changes monitored via `supabase.auth.onAuthStateChange` in `AppNavigator.js`.

---

## 13. PERMISSIONS REQUIRED

### Android
- `ACCESS_FINE_LOCATION` — GPS tracking
- `ACCESS_COARSE_LOCATION` — Fallback location
- `CAMERA` — Delivery photo capture
- `READ_EXTERNAL_STORAGE` — Image access
- `WRITE_EXTERNAL_STORAGE` — Image save
- `INTERNET` — Network access
- `ACCESS_NETWORK_STATE` — Connectivity check

### iOS
- `NSLocationWhenInUseUsageDescription` — Foreground location
- `NSLocationAlwaysAndWhenInUseUsageDescription` — Background location
- `NSCameraUsageDescription` — Camera
- `NSPhotoLibraryUsageDescription` — Photo library

---

## 14. DATA FLOW DIAGRAMS

### Order Lifecycle
```
[Admin Creates Order]
        ↓
   status: 'pending'
        ↓
[Driver Accepts Order]  ←→  [En-Route Matching: suggest bundled orders]
        ↓
   status: 'assigned'
   GPS tracking starts (15s interval)
        ↓
[Driver Arrives at Drop]
        ↓
   Capture photo + signature + notes
   Verify GPS proximity
        ↓
   Upload image to Supabase Storage
   Insert delivery_proof record
   Calculate actual_distance from GPS trail
   Check fuel misuse (>20% deviation → flag)
        ↓
   status: 'delivered'
   GPS tracking stops
```

### Location Update Flow
```
[Driver App]
    ↓ (every 15s)
[expo-location.getCurrentPositionAsync]
    ↓
[supabase.from('driver_locations').insert()]
    ↓
[Supabase Realtime broadcasts INSERT]
    ↓
[Admin LiveTrackingScreen receives via subscription]
    ↓
[UI updates driver card with new location + reverse geocode]
```

---

## 15. QUICK REFERENCE: KEY FUNCTIONS

| Function | File | Does |
|----------|------|------|
| `signIn(email, password)` | auth.js | Login + fetch profile role |
| `signUp(email, password, fullName, role)` | auth.js | Register + create profile |
| `getCurrentUser()` | auth.js | Get auth user + role + name |
| `createOrder(orderData)` | orders.js | Insert order |
| `getOrders()` | orders.js | List all orders with driver name |
| `getDrivers()` | orders.js | List all driver profiles |
| `getDriverOrders(driverId)` | driverOrders.js | List orders for specific driver |
| `updateOrderStatus(orderId, status)` | driverOrders.js | Change order status |
| `geocodeAddress(address)` | location.js | Address → {lat, lng, formattedAddress} |
| `getDistance(oLat, oLng, dLat, dLng)` | location.js | Route distance/duration/traffic/alternatives |
| `getActiveDriverLocations()` | tracking.js | Latest location per driver |
| `subscribeToDriverLocations(cb)` | tracking.js | Realtime location subscription |
| `updateDriverLocation(driverId, lat, lng, orderId)` | tracking.js | Insert GPS point |
| `verifyLocation(dropLat, dropLng)` | deliveryProof.js | Check proximity (disabled) |
| `uploadDeliveryImage(uri, orderId)` | deliveryProof.js | Upload photo to Storage/base64 |
| `submitDeliveryProof(...)` | deliveryProof.js | Insert proof + update order + fuel check |
| `getDashboardStats()` | analytics.js | Aggregate order/driver/distance stats |
| `calculateIdleTime(orderId)` | driverPerformance.js | GPS-based idle detection |
| `getDriverPerformance(driverId)` | driverPerformance.js | Per-driver metrics |
| `getDriverRankings()` | driverPerformance.js | All drivers sorted by efficiency |
| `optimizeMultiStopRoute(start, orders)` | routeOptimization.js | Google waypoint optimization |
| `findOrdersAlongRoute(order, driverId)` | enRouteMatching.js | Smart order bundling |
| `calculateActualDistance(orderId, driverId)` | fuelMonitoring.js | Sum GPS trail distances |
| `checkFuelMisuse(orderId)` | fuelMonitoring.js | Flag if >20% deviation |
| `calculateFuelCost(distance, vehicleType)` | fuelCalculator.js | Cost in ₹ |
| `reverseGeocode(lat, lng)` | geocoding.js | Coordinates → address string |
| `useLocationTracking(driverId, isActive, orderId)` | useLocationTracking.js | GPS polling hook |

---

## 16. BUILD & RUN

```bash
# Install dependencies
npm install

# Start Expo dev server
npm start
# or
npx expo start

# Platform-specific
npm run android
npm run ios
npm run web
```

**Required setup before running:**
1. Create `.env` with Supabase URL, Anon Key, and Google Maps API Key
2. Run all SQL migrations in Supabase SQL Editor (database/ folder)
3. Create `delivery-proofs` storage bucket in Supabase (public)
4. Enable Google Geocoding API + Directions API in Google Cloud Console

---

*This file serves as the complete context for AI-assisted development on the TrackSure project.*
