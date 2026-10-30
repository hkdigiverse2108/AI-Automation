/**
 * Test CLI Script to verify Appointment WhatsApp messages on any phone number
 * Usage:
 *   node backend/scripts/testAppointmentFlow.js 919876543210 confirmed
 *   node backend/scripts/testAppointmentFlow.js 919876543210 reminder
 *   node backend/scripts/testAppointmentFlow.js 919876543210 rescheduled
 *   node backend/scripts/testAppointmentFlow.js 919876543210 cancelled
 *   node backend/scripts/testAppointmentFlow.js 919876543210 thankyou
 */

const http = require('http');

const targetPhone = process.argv[2] || '919876543210';
const action = (process.argv[3] || 'created').toLowerCase();
const clientName = process.argv[4] || 'Test Client';

console.log(`\n=================================================`);
console.log(`Testing Appointment WhatsApp Flow`);
console.log(`Target Phone: ${targetPhone}`);
console.log(`Action:       ${action}`);
console.log(`Client Name:  ${clientName}`);
console.log(`=================================================\n`);

const payload = JSON.stringify({
  phone: targetPhone,
  name: clientName,
  action: action,
  subject: 'Business meeting with HK DigiVerse LLP',
  scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  reason: 'Due to some important work'
});

const req = http.request('http://localhost:5588/api/v1/appointments/test-booking', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(body);
      console.log('Server Response:\n', JSON.stringify(json, null, 2));
      if (json.notificationResult?.success) {
        console.log(`\n✅ Message dispatched successfully to Meta WhatsApp API!`);
      } else {
        console.log(`\n⚠️ Meta response:`, json.notificationResult?.error || 'See response details');
      }
    } catch (e) {
      console.log('Raw response:', body);
    }
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('❌ Connection error:', e.message);
  process.exit(1);
});

req.write(payload);
req.end();

