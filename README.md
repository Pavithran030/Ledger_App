# Cattle Feed Mill Credit Ledger App (கால்நடை தீவன கணக்கு)

An offline-first mobile application specifically engineered for cattle feed mill owners. It tracks cash sales, credit sales with immutable historical price locks, customer part-payments, feed stock inventory, and zero-cost WhatsApp ledger statements.

Built entirely on open-source technologies and 100% free tiers.

---

## 🌟 Key Features

1. **Integer Paise Financial Precision:** Money is strictly computed as integer paise (`₹1 = 100 paise`), preventing floating-point rounding errors.
2. **Immutable Price Locking:** Feed item prices are never overwritten. Every price change appends a new effective price history record. Bill items lock the exact selling price at the moment of sale and never alter old bills.
3. **Dynamic Balance Ledger:** Customer balances are never manually typed or statically stored; they are always dynamically calculated:
   $$\text{Balance} = \sum(\text{Active Credit Bills}) - \sum(\text{Active Payments})$$
4. **Soft Deletions & Stock Restoration:** Erroneous bills or payments are marked `cancelled` (never hard-deleted), automatically reversing stock with compensating stock entries.
5. **Atomic SQLite Transactions:** Multi-row writes (bill + items + stock moves) execute inside a single atomic database transaction.
6. **Free WhatsApp Updates:** Direct `https://wa.me/` integration generating pre-formatted balance statements and payment receipts in English and Tamil with zero API cost.
7. **Bilingual Support:** Complete English and Tamil (`தமிழ்`) translations with instant language switching.
8. **Owner Security & Backups:** 4-digit PIN lock with biometric fingerprint/face authentication, weekly backup reminders, and complete JSON database export/restore.

---

## 🚀 Quick Start (Development & Testing)

### 1. Run in Expo Go (Real Device Preview)
1. Install **Expo Go** on your Android or iOS smartphone from Google Play Store or Apple App Store.
2. Ensure your phone and PC are connected to the same Wi-Fi network.
3. In this project directory, run:
   ```bash
   npx expo start
   ```
4. Scan the displayed QR code with your phone camera (iOS) or Expo Go app (Android).

---

## 📱 Building the Standalone Android APK

You can build a standalone `.apk` to install directly on Android phones without publishing to the Google Play Store or paying developer fees.

### Option A: Free Cloud Build via EAS (Recommended)
1. Create a free account at [expo.dev](https://expo.dev).
2. Install EAS CLI and login:
   ```bash
   npm install -g eas-cli
   eas login
   ```
3. Trigger the preview build:
   ```bash
   eas build --profile preview --platform android
   ```
4. Download the compiled `.apk` from the provided URL and transfer it to the mill owner's phone.

### Option B: Free Local Build (No Cloud Account Needed)
1. Ensure Java JDK 17 and Android Studio with Android SDK are installed on your machine.
2. Generate the native Android folder:
   ```bash
   npx expo prebuild --platform android
   ```
3. Compile the release APK locally:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
4. Locate the generated APK at:
   `android/app/build/outputs/apk/release/app-release.apk`

---

## 📋 Mill Owner First-Time Setup Checklist

When handing over the application to the mill owner:

1. **Configure Mill Profile:**
   - Open **Settings** (⚙️ top right).
   - Enter **Mill Name** (e.g. *Sri Venkateswara Cattle Feed Mill*).
   - Enter **Mill Mobile Number** (used as sender signature).
   - Choose default language (**English** or **தமிழ்**).
2. **Setup Security PIN:**
   - Tap **Security PIN & Biometrics**.
   - Create a memorable 4-digit PIN and enable fingerprint unlock.
3. **Add Feed Items & Opening Inventory:**
   - Go to **Feed Items** tab -> tap **+ Feed Item**.
   - Enter Feed Item Name, Tamil Name, Unit (`bag`, `kg`, `litre`, `packet`), Current Selling Price, and Opening Stock count.
4. **Migrate Notebook Customers (Opening Balances):**
   - Go to **Customers** tab -> tap **+ Add Customer**.
   - Enter Customer Name, 10-digit mobile number, and village.
   - Enter their existing debt in **Opening Balance from Notebook (₹)**.
   - The app will automatically initialize their ledger with an opening credit bill!

---

## 🧪 Automated Testing & Verification

Run the full Jest test suite:
```bash
npm test
```
Run strict TypeScript static type checks:
```bash
npx tsc --noEmit
```

### Manual Verification Flow:
1. **Add Feed Item:** Add "Cattle Feed Pellets" at ₹1,200 (Opening stock: 50 bags).
2. **Add Customer:** Add "Murugan" with 10-digit phone number.
3. **Credit Sale:** Sell 5 bags of Cattle Feed Pellets to Murugan.
   - Verified: Stock reduces to 45. Murugan's pending balance is ₹6,000.
4. **Price Update:** Update Cattle Feed Pellets selling price to ₹1,350.
   - Verified: Opening the first bill still shows the locked price of ₹1,200 per bag.
5. **Second Credit Sale:** Sell 2 bags of Cattle Feed Pellets at ₹1,350.
   - Verified: Total pending balance becomes ₹8,700. Stock becomes 43.
6. **Part Payment:** Record a payment of ₹3,000 (UPI).
   - Verified: Balance drops to ₹5,700. Running ledger displays correct chronological balance.
7. **Advance Payment:** Record an additional payment of ₹6,000.
   - Verified: Balance turns negative (-₹300), showing an advance in blue text.
8. **WhatsApp Share:** Tap "Send WhatsApp Balance" -> launches WhatsApp with formatted receipt.
9. **Cancellation Audit:** Cancel the second bill.
   - Verified: 2 bags restored to inventory stock; bill total subtracted from customer balance.
10. **Offline Integrity:** Turn on Airplane mode -> add sales, payments, and view reports. Everything executes locally with zero network reliance.
