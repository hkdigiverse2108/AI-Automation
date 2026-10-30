/**
 * ============================================================================
 * HK DIGIVERSE LLP - GOOGLE CALENDAR APPOINTMENT AUTOMATION SCRIPT
 * ============================================================================
 * Account: hrmangukiya3494@gmail.com
 * Booking Schedule: https://calendar.app.google/ZvhrmRV1dnYSL4XC8
 * 
 * HOW TO SETUP (Takes 2 minutes):
 * 1. Open https://script.google.com in browser (logged into hrmangukiya3494@gmail.com).
 * 2. Click "New Project" and title it: "HK DigiVerse Calendar Automation".
 * 3. Replace all code in Code.gs with this script.
 * 4. Set your WEBHOOK_URL below (e.g. your live domain or ngrok URL).
 * 5. Select function "setupAutomationTriggers" and click "Run".
 * 6. Grant permissions when prompted (Advanced -> Go to HK DigiVerse... -> Allow).
 * 
 * THAT'S IT! The automation is permanently active.
 * ============================================================================
 */

// Replace this with your actual public backend URL
const BACKEND_BASE_URL = 'https://automation.hkdigiverse.com'; // Change to your live server e.g. https://api.yourdomain.com
const WEBHOOK_ENDPOINT = '/api/v1/appointments/google-webhook';

/**
 * 1. One-time Setup Function to create automatic triggers
 */
function setupAutomationTriggers() {
  const calendarId = 'hrmangukiya3494@gmail.com';
  
  // Clean existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }

  // Instant trigger: fires whenever Sir's calendar updates
  ScriptApp.newTrigger('onCalendarEventUpdated')
    .forUserCalendar(calendarId)
    .onEventUpdated()
    .create();

  // Periodic safety trigger: checks every 5 minutes to ensure no event is missed
  ScriptApp.newTrigger('syncCalendarBookings')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('✅ Google Calendar Automation Triggers successfully configured for ' + calendarId);
}

/**
 * 2. Event Listener - Triggered instantly when calendar events change
 */
function onCalendarEventUpdated(e) {
  Logger.log('Calendar event update detected. Syncing...');
  syncCalendarBookings();
}

/**
 * 3. Main synchronization engine
 */
function syncCalendarBookings() {
  const calendarId = 'hrmangukiya3494@gmail.com';
  const calendar = CalendarApp.getCalendarById(calendarId) || CalendarApp.getDefaultCalendar();
  if (!calendar) {
    Logger.log('❌ Calendar not found: ' + calendarId);
    return;
  }

  const now = new Date();
  // Look 60 days into future
  const future = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const events = calendar.getEvents(now, future);
  const props = PropertiesService.getUserProperties();

  const currentEventIds = {};

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const eventId = event.getId();
    currentEventIds[eventId] = true;

    const summary = event.getTitle() || '';
    const description = event.getDescription() || '';
    const startTime = event.getStartTime().toISOString();
    const endTime = event.getEndTime().toISOString();
    const lastUpdated = event.getLastUpdated() ? event.getLastUpdated().getTime().toString() : '0';

    const lastSynced = props.getProperty('synced_' + eventId);
    const lastStartTime = props.getProperty('time_' + eventId);

    // If event is brand new or time/details changed
    if (!lastSynced || lastSynced !== lastUpdated) {
      const isRescheduled = lastSynced && lastStartTime && lastStartTime !== startTime;
      const action = isRescheduled ? 'updated' : (lastSynced ? 'updated' : 'created');

      const attendees = event.getGuestList().map(function(g) {
        return {
          email: g.getEmail(),
          name: g.getName(),
          status: g.getGuestStatus().toString()
        };
      });

      const payload = {
        eventId: eventId,
        action: action,
        summary: summary,
        description: description,
        startTime: startTime,
        endTime: endTime,
        attendees: attendees,
        source: 'google_apps_script'
      };

      postToBackend(payload);

      props.setProperty('synced_' + eventId, lastUpdated);
      props.setProperty('time_' + eventId, startTime);
    }
  }

  // Detect cancellations: Check previously active events that are no longer present
  const allKnownKeys = props.getKeys();
  for (let j = 0; j < allKnownKeys.length; j++) {
    const key = allKnownKeys[j];
    if (key.indexOf('synced_') === 0) {
      const storedEventId = key.substring('synced_'.length);
      if (!currentEventIds[storedEventId]) {
        // Event was deleted/cancelled from calendar
        Logger.log('Event deleted or cancelled: ' + storedEventId);
        const payload = {
          eventId: storedEventId,
          action: 'cancelled',
          reason: 'Due to some important work',
          source: 'google_apps_script'
        };
        postToBackend(payload);
        props.deleteProperty('synced_' + storedEventId);
        props.deleteProperty('time_' + storedEventId);
      }
    }
  }
}

/**
 * Helper to post event payload to backend
 */
function postToBackend(payload) {
  const url = BACKEND_BASE_URL.replace(/\/$/, '') + WEBHOOK_ENDPOINT;
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    Logger.log('Webhook Response (' + response.getResponseCode() + '): ' + response.getContentText());
  } catch (err) {
    Logger.log('❌ Failed to post webhook: ' + err.message);
  }
}

/**
 * 4. Test function - Run this to test the webhook connection
 */
function testWebhookConnection() {
  const samplePayload = {
    eventId: 'test_apps_script_' + new Date().getTime(),
    action: 'created',
    summary: 'Business meeting with HK DigiVerse LLP',
    description: 'Booking page: https://calendar.app.google/ZvhrmRV1dnYSL4XC8\nBooked by: Test User (test@example.com)\nPhone number: +919876543210',
    startTime: new Date(new Date().getTime() + 2 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(new Date().getTime() + 2.5 * 60 * 60 * 1000).toISOString(),
  };

  Logger.log('Sending test payload to webhook...');
  postToBackend(samplePayload);
}

