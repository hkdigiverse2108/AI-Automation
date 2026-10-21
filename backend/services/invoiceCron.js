const cron = require('node-cron');
const { checkAndRunInvoiceAutomations } = require('./invoiceAutomationService');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

function startInvoiceCron() {
  // Check every 10 minutes (and also on startup after 5 seconds delay)
  cron.schedule('*/10 * * * *', async () => {
    logger.info('[InvoiceCron] Periodic invoice automation check triggered.');
    try {
      await checkAndRunInvoiceAutomations();
    } catch (err) {
      logger.error('[InvoiceCron] Error in invoice automation cron:', err.message);
    }
  });

  // Run initial check shortly after startup
  setTimeout(async () => {
    try {
      logger.info('[InvoiceCron] Running initial startup check for invoice automations...');
      await checkAndRunInvoiceAutomations();
    } catch (err) {
      logger.warn('[InvoiceCron] Initial startup check error:', err.message);
    }
  }, 10000);

  logger.info('[InvoiceCron] Invoice automation scheduler successfully initialized (checks every 10 minutes).');
}

module.exports = { startInvoiceCron };
