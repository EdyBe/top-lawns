# Top Lawns Lincoln - Booking System

A complete lawn mowing booking system with Firebase integration and SMS notifications via Twilio.

## Features

- Multi-step booking form with client-side validation
- Real-time SMS notifications to employees when new bookings arrive
- SMS reply system for employees to accept bookings
- Customer confirmation messages via SMS
- Photo upload support for lawn assessment
- Firebase Firestore for persistent booking storage
- Admin endpoint to view all bookings
- Dynamic availability management

## Tech Stack

- **Frontend**: Pure HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Database**: Firebase Firestore
- **SMS**: Twilio API
- **File Upload**: Multer

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Uploads Directory

```bash
mkdir uploads
```

### 3. Set Up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable Firestore Database:
   - Click "Firestore Database" in the left sidebar
   - Click "Create database"
   - Start in production mode (you can adjust rules later)
   - Choose your location
4. Generate service account credentials:
   - Go to Project Settings (gear icon) > Service Accounts
   - Click "Generate new private key"
   - Save the JSON file securely (don't commit to git!)
5. Extract these values from the downloaded JSON:
   - `project_id`
   - `private_key`
   - `client_email`

### 4. Set Up Twilio

1. Sign up at [Twilio](https://www.twilio.com/try-twilio)
2. Get a phone number:
   - Go to Phone Numbers > Manage > Buy a number
   - Choose a number with SMS capabilities
3. Get your credentials from the Twilio Console:
   - Account SID
   - Auth Token
   - Your Twilio phone number
4. Configure webhook (after deploying):
   - Go to Phone Numbers > Manage > Active numbers
   - Click on your number
   - Under "Messaging", set webhook URL to: `https://yourdomain.com/api/sms-webhook`
   - Method: HTTP POST

### 5. Configure Environment Variables

1. Copy the example file:
   ```bash
   copy .env.example .env
   ```

2. Edit `.env` and fill in your credentials:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid_from_twilio
   TWILIO_AUTH_TOKEN=your_auth_token_from_twilio
   TWILIO_PHONE_NUMBER=+15551234567
   EMPLOYEE_PHONE_NUMBER=+15559876543

   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com

   PORT=3000
   NODE_ENV=development
   DOMAIN=http://localhost:3000
   ```

   **Important**: Keep the quotes around `FIREBASE_PRIVATE_KEY` and keep the `\n` characters as-is.

### 6. Run the Server

Development mode (auto-restart on changes):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

### 7. Open the Website

Open `toplawnslincoln.html` in your browser. The form will connect to `http://localhost:3000` by default.

## How It Works

### Booking Flow

1. **Customer fills out form** → Multi-step form collects all booking details
2. **Customer clicks "Confirm Booking"** → Form sends data + photos to backend
3. **Backend saves to Firebase** → Booking stored with status "pending"
4. **SMS sent to employee** → Employee receives booking details with short code
5. **SMS sent to customer** → Customer receives confirmation that booking was received
6. **Employee replies via SMS** → Employee texts "ACCEPT [CODE]" to accept booking
7. **Backend updates Firebase** → Booking status changed to "confirmed"
8. **Confirmation SMS to customer** → Customer receives confirmation with final details

### API Endpoints

- `POST /api/send-booking-sms` - Create new booking and send SMS notifications
- `POST /api/sms-webhook` - Webhook for incoming SMS replies from Twilio
- `GET /api/bookings` - Get all bookings (pending, confirmed, completed)
- `POST /api/availability` - Set availability for a specific date
- `GET /api/availability/:date` - Get availability for a specific date

## Firestore Structure

```
bookings/
  {bookingId}/
    - address
    - lotSize
    - customerName
    - phone
    - email
    - instructions
    - serviceDate
    - serviceTime
    - estimatedPrice
    - status ("pending", "confirmed", "completed")
    - photos (array of filenames)
    - createdAt
    - confirmedAt
    - confirmedBy

availability/
  {date}/
    - date
    - timeSlots (array)
    - updatedAt
```

## Deployment

### Option 1: Heroku

1. Install Heroku CLI
2. Create new app: `heroku create toplawns-lincoln`
3. Add environment variables in Heroku dashboard
4. Deploy: `git push heroku main`
5. Update Twilio webhook URL to your Heroku domain

### Option 2: Vercel/Netlify

1. Deploy the backend separately (e.g., Railway, Render)
2. Update the fetch URL in `toplawnslincoln.html` to point to your backend
3. Deploy the HTML file to Vercel/Netlify

### Option 3: VPS (DigitalOcean, AWS, etc.)

1. Set up Node.js on your server
2. Use PM2 to keep the server running: `pm2 start server.js`
3. Set up Nginx as reverse proxy
4. Configure SSL with Let's Encrypt

## Testing

### Test SMS Flow Locally

You can use [ngrok](https://ngrok.com/) to test webhooks locally:

```bash
ngrok http 3000
```

Then update your Twilio webhook URL to the ngrok URL.

## Security Notes

- Never commit `.env` file to git
- Add `.env` to `.gitignore`
- In production, add Firestore security rules
- Consider adding rate limiting to prevent spam
- Validate phone numbers on backend
- Add CORS restrictions in production

## Support

For issues or questions, text: (402) 555-0123

## License

Private - All rights reserved
