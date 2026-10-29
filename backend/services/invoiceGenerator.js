const PDFDocument = require('pdfkit');
const { uploadStream, isConfigured } = require('./cloudinaryService');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

/**
 * Generate a clean black-and-white Flipkart/Amazon style Tax Invoice PDF
 * @param {Object} orderData
 * @returns {Promise<Buffer>}
 */
function createInvoiceBuffer(orderData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      const {
        orderId = 'LG-1001',
        invoiceNumber = `INV-${orderId}`,
        invoiceDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        customer = {},
        items = [],
        subtotal = 0,
        shippingFee = 0,
        discount = 0,
        totalAmount = 0,
        paymentMethod = 'Online',
        transactionId = 'N/A',
        seller = {
          name: 'Luscent Glow',
          tagline: 'Premium Skincare Essentials',
          website: 'https://luscentglow.com',
          email: 'support@luscentglow.com',
          address: 'India',
        }
      } = orderData;

      const customerName = customer.name || 'Valued Customer';
      const customerPhone = customer.phone || '';
      const customerAddress = customer.address || 'Standard Delivery Address';

      // ================= TOP HEADER (Black & White Border Box) =================
      doc.rect(40, 40, 515, 75).lineWidth(1).stroke('#000000');

      // Brand Title
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000')
         .text(seller.name.toUpperCase(), 55, 52);
      
      doc.fontSize(8).font('Helvetica').fillColor('#333333')
         .text(seller.tagline, 55, 73)
         .text(`Website: ${seller.website} | Support: ${seller.email}`, 55, 85)
         .text(seller.address, 55, 97);

      // Tax Invoice Label (Right side)
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000')
         .text('TAX INVOICE / RECEIPT', 360, 52, { align: 'right', width: 180 });
      
      doc.fontSize(8).font('Helvetica').fillColor('#222222')
         .text(`Invoice No: ${invoiceNumber}`, 360, 70, { align: 'right', width: 180 })
         .text(`Invoice Date: ${invoiceDate}`, 360, 82, { align: 'right', width: 180 })
         .text(`Order ID: #${orderId}`, 360, 94, { align: 'right', width: 180 });

      // ================= BILLING & ORDER META SECTION =================
      let y = 125;
      doc.rect(40, y, 250, 85).lineWidth(0.5).stroke('#444444');
      doc.rect(305, y, 250, 85).lineWidth(0.5).stroke('#444444');

      // Left Box: Customer Details
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000')
         .text('DELIVERY & BILLING DETAILS', 48, y + 8);
      doc.fontSize(8).font('Helvetica').fillColor('#222222')
         .text(`Name: ${customerName}`, 48, y + 23)
         .text(`Phone: ${customerPhone}`, 48, y + 36)
         .text(`Address: ${customerAddress.substring(0, 100)}`, 48, y + 49, { width: 235 });

      // Right Box: Payment & Order Details
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000')
         .text('PAYMENT SUMMARY', 313, y + 8);
      doc.fontSize(8).font('Helvetica').fillColor('#222222')
         .text(`Payment Method: ${paymentMethod}`, 313, y + 23)
         .text(`Transaction ID: ${transactionId}`, 313, y + 36)
         .text(`Payment Status: ${paymentMethod.toLowerCase().includes('cod') ? 'Cash on Delivery (Pending)' : 'PAID / CONFIRMED'}`, 313, y + 49)
         .text(`Currency: INR (Rs.)`, 313, y + 62);

      // ================= ITEMS TABLE =================
      y = 220;
      // Table Header Row
      doc.rect(40, y, 515, 20).fillAndStroke('#f0f0f0', '#000000');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000')
         .text('#', 45, y + 6)
         .text('ITEM DESCRIPTION', 70, y + 6)
         .text('QTY', 360, y + 6, { width: 40, align: 'center' })
         .text('UNIT PRICE', 410, y + 6, { width: 65, align: 'right' })
         .text('TOTAL', 485, y + 6, { width: 60, align: 'right' });

      y += 20;

      const normalizedItems = (items && items.length > 0) ? items : [
        { name: 'Luscent Glow Skincare Product', qty: 1, unitPrice: totalAmount, total: totalAmount }
      ];

      normalizedItems.forEach((item, index) => {
        const itemY = y;
        const rowHeight = 22;
        doc.rect(40, itemY, 515, rowHeight).lineWidth(0.5).stroke('#cccccc');

        const itemName = item.name || item.title || `Skincare Item ${index + 1}`;
        const qty = item.quantity || item.qty || 1;
        const price = Number(item.unitPrice || item.price || (item.total ? item.total / qty : 0)).toFixed(2);
        const itemTotal = Number(item.total || (price * qty)).toFixed(2);

        doc.fontSize(8).font('Helvetica').fillColor('#111111')
           .text(`${index + 1}`, 45, itemY + 6)
           .text(itemName.substring(0, 55), 70, itemY + 6, { width: 280 })
           .text(`${qty}`, 360, itemY + 6, { width: 40, align: 'center' })
           .text(`Rs. ${price}`, 410, itemY + 6, { width: 65, align: 'right' })
           .text(`Rs. ${itemTotal}`, 485, itemY + 6, { width: 60, align: 'right' });

        y += rowHeight;
      });

      // ================= SUMMARY TOTALS =================
      y += 10;
      const totalBoxX = 320;
      const totalBoxWidth = 235;

      const calculatedSubtotal = Number(subtotal || totalAmount).toFixed(2);
      const calculatedShipping = Number(shippingFee || 0).toFixed(2);
      const calculatedDiscount = Number(discount || 0).toFixed(2);
      const finalGrandTotal = Number(totalAmount || (subtotal + shippingFee - discount)).toFixed(2);

      doc.rect(totalBoxX, y, totalBoxWidth, 80).lineWidth(0.5).stroke('#444444');

      doc.fontSize(8).font('Helvetica').fillColor('#222222')
         .text('Subtotal:', totalBoxX + 10, y + 10)
         .text(`Rs. ${calculatedSubtotal}`, totalBoxX + 120, y + 10, { width: 95, align: 'right' })
         
         .text('Shipping & Delivery:', totalBoxX + 10, y + 25)
         .text(calculatedShipping > 0 ? `Rs. ${calculatedShipping}` : 'FREE', totalBoxX + 120, y + 25, { width: 95, align: 'right' });

      if (Number(calculatedDiscount) > 0) {
        doc.text('Discount Applied:', totalBoxX + 10, y + 40)
           .text(`- Rs. ${calculatedDiscount}`, totalBoxX + 120, y + 40, { width: 95, align: 'right' });
      }

      // Grand Total Line
      doc.rect(totalBoxX, y + 55, totalBoxWidth, 25).fillAndStroke('#000000', '#000000');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff')
         .text('GRAND TOTAL:', totalBoxX + 10, y + 62)
         .text(`Rs. ${finalGrandTotal}`, totalBoxX + 110, y + 62, { width: 105, align: 'right' });

      // ================= TERMS & SIGNATURE =================
      const footerY = 680;
      doc.rect(40, footerY, 515, 60).lineWidth(0.5).stroke('#888888');

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000')
         .text('Terms & Conditions:', 48, footerY + 8);
      doc.fontSize(7).font('Helvetica').fillColor('#444444')
         .text('1. All skincare purchases are subject to standard return/replacement guidelines as per company policy.', 48, footerY + 20)
         .text('2. Please inspect package upon delivery before accepting.', 48, footerY + 30)
         .text('3. This is a computer-generated tax invoice and requires no physical signature.', 48, footerY + 40);

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000')
         .text('Authorized Signatory', 420, footerY + 40, { align: 'right', width: 125 });

      // Page End
      doc.fontSize(7).font('Helvetica-Oblique').fillColor('#666666')
         .text('Thank you for choosing Luscent Glow! For skincare tips & orders, visit https://luscentglow.com', 40, 755, { align: 'center', width: 515 });

      doc.end();
    } catch (err) {
      logger.error('Error creating PDF invoice:', err);
      reject(err);
    }
  });
}

/**
 * Generate invoice PDF and upload directly to Cloudinary (or local fallback)
 * @param {Object} orderData
 * @returns {Promise<string>} Public HTTPS URL of the invoice PDF
 */
async function generateAndUploadInvoice(orderData) {
  try {
    const pdfBuffer = await createInvoiceBuffer(orderData);
    const orderId = orderData.orderId || `order_${Date.now()}`;
    const filename = `Invoice_${orderId}.pdf`;

    if (isConfigured()) {
      const publicUrl = await uploadStream(pdfBuffer, 'invoices', 'raw', filename);
      logger.info(`Invoice generated and uploaded to Cloudinary: ${publicUrl}`);
      return publicUrl;
    }

    // Fallback: save to local uploads directory and return server URL
    const uploadDir = path.join(__dirname, '..', 'uploads', 'invoices');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const localFilePath = path.join(uploadDir, filename);
    fs.writeFileSync(localFilePath, pdfBuffer);

    const env = require('../config/env');
    const baseUrl = env.NEXT_PUBLIC_API_URL
      ? env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '').replace(/\/$/, '')
      : (env.ALLOWED_ORIGINS?.find(o => o.startsWith('https://')) || `http://localhost:${env.PORT || 5588}`);

    const fileUrl = `${baseUrl}/uploads/invoices/${filename}`;
    logger.info(`Invoice saved locally: ${fileUrl}`);
    return fileUrl;
  } catch (err) {
    logger.error('Failed to generate and upload invoice:', err);
    throw err;
  }
}

module.exports = {
  createInvoiceBuffer,
  generateAndUploadInvoice,
};

