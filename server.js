// Backend Server for Top Lawns Lincoln
// This handles SMS notifications via Twilio and booking management

const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const { db } = require('./firebase');

const app = express();
app.use(cors({
    origin: ['https://edybe.github.io', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// Twilio Configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const employeePhone = process.env.EMPLOYEE_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

// Endpoint to send booking SMS to employee
app.post('/api/send-booking-sms', upload.array('photos', 5), async (req, res) => {
    try {
        const booking = JSON.parse(req.body.bookingData);
        const bookingId = `BK-${Date.now()}`;
        booking.bookingId = bookingId;
        booking.createdAt = new Date().toISOString();

        // Handle uploaded photos
        if (req.files && req.files.length > 0) {
            booking.photos = req.files.map(file => file.filename);
        }

        // Store booking in Firebase
        await db.collection('bookings').doc(bookingId).set(booking);

        // Send SMS to employee
        const employeeMessage = `🌱 NEW BOOKING REQUEST

Customer: ${booking.customerName}
Phone: ${booking.phone}
Address: ${booking.address}
Date: ${booking.serviceDate} at ${booking.serviceTime}
Lot Size: ${booking.lotSize}
Estimate: ${booking.estimatedPrice}

Instructions: ${booking.instructions || 'None'}

Reply "ACCEPT ${bookingId.substring(3, 9)}" to accept this job.

Booking ID: ${bookingId}`;

        const employeeSMS = await client.messages.create({
            body: employeeMessage,
            from: twilioPhone,
            to: employeePhone
        });

        // Send confirmation SMS to customer
        const customerMessage = `Hi ${booking.customerName}!

Thank you for booking with Top Lawns Lincoln!

Your lawn mowing request for ${booking.serviceDate} at ${booking.serviceTime} has been received.

Estimated price: ${booking.estimatedPrice}

One of our team members will confirm your booking within 30 minutes. You'll receive a text when it's confirmed.

Questions? Text us back anytime!`;

        const customerSMS = await client.messages.create({
            body: customerMessage,
            from: twilioPhone,
            to: booking.phone
        });

        res.json({
            success: true,
            bookingId: bookingId,
            employeeSid: employeeSMS.sid,
            customerSid: customerSMS.sid
        });

    } catch (error) {
        console.error('Error sending SMS:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Webhook to receive SMS replies from employees
app.post('/api/sms-webhook', async (req, res) => {
    try {
        const incomingMessage = req.body.Body.trim().toUpperCase();
        const fromNumber = req.body.From;

        // Check if it's an acceptance message
        if (incomingMessage.startsWith('ACCEPT')) {
            const bookingIdPart = incomingMessage.split(' ')[1];

            // Find matching booking in Firebase
            const bookingsRef = db.collection('bookings');
            const snapshot = await bookingsRef.where('status', '==', 'pending').get();

            let acceptedBooking = null;
            let bookingId = null;

            snapshot.forEach(doc => {
                const booking = doc.data();
                if (doc.id.includes(bookingIdPart)) {
                    acceptedBooking = booking;
                    bookingId = doc.id;
                }
            });

            if (acceptedBooking && bookingId) {
                // Update booking status in Firebase
                await db.collection('bookings').doc(bookingId).update({
                    status: 'confirmed',
                    confirmedAt: new Date().toISOString(),
                    confirmedBy: fromNumber
                });

                // Send confirmation to customer
                const confirmMessage = `Great news, ${acceptedBooking.customerName}!

Your lawn mowing is confirmed for ${acceptedBooking.serviceDate} at ${acceptedBooking.serviceTime}.

Address: ${acceptedBooking.address}
Estimated price: ${acceptedBooking.estimatedPrice}

We'll text you when we're on our way. See you soon! 🌱

- Top Lawns Lincoln`;

                await client.messages.create({
                    body: confirmMessage,
                    from: twilioPhone,
                    to: acceptedBooking.phone
                });

                // Confirm to employee
                await client.messages.create({
                    body: `✅ Booking confirmed! Customer notified. Details saved to your schedule.`,
                    from: twilioPhone,
                    to: fromNumber
                });
            } else {
                // No matching booking found
                await client.messages.create({
                    body: `❌ Booking ${bookingIdPart} not found or already processed.`,
                    from: twilioPhone,
                    to: fromNumber
                });
            }
        }

        res.status(200).send('<Response></Response>');

    } catch (error) {
        console.error('Error handling webhook:', error);
        res.status(500).send('<Response></Response>');
    }
});

// Endpoint to get all bookings (for admin dashboard)
app.get('/api/bookings', async (req, res) => {
    try {
        const bookingsRef = db.collection('bookings');
        const snapshot = await bookingsRef.orderBy('createdAt', 'desc').get();

        const bookings = {
            pending: [],
            confirmed: [],
            completed: []
        };

        snapshot.forEach(doc => {
            const booking = { id: doc.id, ...doc.data() };
            if (booking.status === 'pending') {
                bookings.pending.push(booking);
            } else if (booking.status === 'confirmed') {
                bookings.confirmed.push(booking);
            } else if (booking.status === 'completed') {
                bookings.completed.push(booking);
            }
        });

        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to update availability
app.post('/api/availability', async (req, res) => {
    try {
        const { date, timeSlots } = req.body;

        // Update Firebase availability
        await db.collection('availability').doc(date).set({
            date: date,
            timeSlots: timeSlots,
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get availability for a specific date
app.get('/api/availability/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const doc = await db.collection('availability').doc(date).get();

        if (doc.exists) {
            res.json(doc.data());
        } else {
            // Return default availability if not set
            res.json({
                date: date,
                timeSlots: ['8:00 AM', '10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM']
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Top Lawns server running on port ${PORT}`);
    console.log('Twilio webhook URL:', `http://YOUR_DOMAIN/api/sms-webhook`);
});

module.exports = app;
