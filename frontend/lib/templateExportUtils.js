import { LOGO_BASE64 } from './logoBase64';

/**
 * Sanitizes strings for standard PDF Helvetica font (Latin-1 safe)
 */
export const sanitizeForPdf = (str) => {
  if (str === null || str === undefined) return '';
  let s = String(str);

  // Map common emojis to readable text tokens
  s = s.replace(/🏠/g, '[Home] ')
       .replace(/🏢/g, '[Office] ')
       .replace(/👋/g, '[Hello] ')
       .replace(/📞/g, '[Call] ')
       .replace(/✅/g, '[Approved] ')
       .replace(/❌/g, '[Rejected] ')
       .replace(/⏱️|⏳/g, '[Pending] ')
       .replace(/📷/g, '[Image] ')
       .replace(/🎥/g, '[Video] ')
       .replace(/📄/g, '[Doc] ')
       .replace(/📋/g, '[Copy Code] ')
       .replace(/💬/g, '[Chat] ')
       .replace(/🚀/g, '[Launch] ')
       .replace(/⭐/g, '[Star] ')
       .replace(/🔔/g, '[Notice] ');

  const cleaned = [];
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    // Standard ASCII printable + whitespace + Latin-1 supplement
    if ((code >= 32 && code <= 126) || code === 10 || code === 13 || (code >= 160 && code <= 255)) {
      cleaned.push(s[i]);
    }
  }
  return cleaned.join('').replace(/[ \t]+/g, ' ').trim();
};

/**
 * Extracts structured component information from a template object
 */
export const getTemplateDetails = (tmpl) => {
  if (!tmpl) return {};

  const headerComp = tmpl.components?.find(c => c.type === 'HEADER') || {};
  const bodyComp = tmpl.components?.find(c => c.type === 'BODY') || {};
  const footerComp = tmpl.components?.find(c => c.type === 'FOOTER') || {};
  const buttonsComp = tmpl.components?.find(c => c.type === 'BUTTONS') || {};

  let headerType = headerComp.format || (headerComp.text ? 'TEXT' : 'NONE');
  let headerContent = headerComp.text || (headerComp.format ? `[${headerComp.format} Media Header]` : 'None');

  let bodyText = bodyComp.text || '';
  if (tmpl.category === 'AUTHENTICATION' && !bodyText) {
    bodyText = '{{1}} is your verification code.';
    if (bodyComp.add_security_recommendation !== false) {
      bodyText += ' For your security, do not share this code.';
    }
  }

  let footerText = footerComp.text || '';
  if (footerComp.code_expiration_minutes) {
    footerText = `Expires in ${footerComp.code_expiration_minutes} minutes.`;
  }

  const buttonsList = (buttonsComp.buttons || []).map((b, idx) => {
    if (b.type === 'OTP') return `${idx + 1}. [OTP / Copy Code] "${b.text || 'Copy Code'}"`;
    if (b.type === 'URL') return `${idx + 1}. [URL] "${b.text || 'Visit'}" -> ${b.url || ''}`;
    if (b.type === 'PHONE_NUMBER') return `${idx + 1}. [Call] "${b.text || 'Call'}" -> ${b.phone_number || ''}`;
    return `${idx + 1}. [Quick Reply] "${b.text || ''}"`;
  });

  // Extract variables like {{1}}, {{name}}, etc.
  const variableMatches = (bodyText + ' ' + (headerComp.text || '')).match(/\{\{[^}]+\}\}/g) || [];
  const uniqueVariables = Array.from(new Set(variableMatches));

  return {
    headerType,
    headerContent,
    bodyText,
    footerText,
    buttonsList,
    buttonsText: buttonsList.length ? buttonsList.join('\n') : 'None',
    isCarousel: !!tmpl.isCarousel,
    carouselCards: tmpl.carouselCards || [],
    variables: uniqueVariables,
    variableCount: uniqueVariables.length
  };
};

/**
 * EXPORT MULTIPLE TEMPLATES TO EXCEL (.xlsx)
 * Supports full dataset or filtered dataset
 */
export const exportTemplatesToExcel = async (templates, filterInfo = {}) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const generatedDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const isFiltered = filterInfo.isFiltered || false;

  // --- SHEET 1: SUMMARY & FILTER OVERVIEW ---
  const approvedCount = templates.filter(t => t.status?.toUpperCase() === 'APPROVED').length;
  const pendingCount = templates.filter(t => t.status?.toUpperCase() === 'PENDING').length;
  const rejectedCount = templates.filter(t => t.status?.toUpperCase() === 'REJECTED').length;

  const marketingCount = templates.filter(t => t.category?.toUpperCase() === 'MARKETING').length;
  const utilityCount = templates.filter(t => t.category?.toUpperCase() === 'UTILITY').length;
  const authCount = templates.filter(t => t.category?.toUpperCase() === 'AUTHENTICATION').length;

  const summaryData = [
    ['HK Digiverse WhatsApp Marketing Platform - Templates Export Report'],
    ['Generated On (IST)', generatedDate],
    ['Scope', isFiltered ? 'Filtered Catalog' : 'Complete All Templates Catalog'],
    ['Total Templates in Export', templates.length],
    [],
    ['ACTIVE FILTERS APPLIED'],
    ['Category Filter', filterInfo.categoryFilter || 'ALL'],
    ['Status Filter', filterInfo.statusFilter || 'ALL'],
    ['Search Query', filterInfo.searchTerm ? `"${filterInfo.searchTerm}"` : 'None'],
    [],
    ['STATUS BREAKDOWN', 'COUNT', 'PERCENTAGE'],
    ['Approved', approvedCount, `${templates.length ? Math.round((approvedCount / templates.length) * 100) : 0}%`],
    ['Pending Review', pendingCount, `${templates.length ? Math.round((pendingCount / templates.length) * 100) : 0}%`],
    ['Rejected', rejectedCount, `${templates.length ? Math.round((rejectedCount / templates.length) * 100) : 0}%`],
    [],
    ['CATEGORY BREAKDOWN', 'COUNT', 'PERCENTAGE'],
    ['Marketing', marketingCount, `${templates.length ? Math.round((marketingCount / templates.length) * 100) : 0}%`],
    ['Utility', utilityCount, `${templates.length ? Math.round((utilityCount / templates.length) * 100) : 0}%`],
    ['Authentication', authCount, `${templates.length ? Math.round((authCount / templates.length) * 100) : 0}%`],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 32 }, { wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Export Summary');

  // --- SHEET 2: ALL TEMPLATES DATA TABLE ---
  const templatesHeaders = [
    'Sr No',
    'Template Name',
    'Status',
    'Category',
    'Language',
    'Mode',
    'Media Type',
    'Header Type',
    'Header Content',
    'Body Text',
    'Footer Text',
    'Buttons / Actions',
    'Variables Detected',
    'Carousel Cards Count',
    'Created Date'
  ];

  const templatesRows = templates.map((tmpl, idx) => {
    const details = getTemplateDetails(tmpl);
    return [
      idx + 1,
      tmpl.name || 'Untitled',
      tmpl.status || 'UNKNOWN',
      tmpl.category || 'MARKETING',
      (tmpl.language || 'en').toUpperCase(),
      tmpl.isCustom ? 'Custom Local' : 'Meta Official',
      details.isCarousel ? 'CAROUSEL' : details.headerType,
      details.headerType,
      details.headerContent,
      details.bodyText,
      details.footerText || 'None',
      details.buttonsText,
      details.variables.join(', ') || 'None',
      details.isCarousel ? details.carouselCards.length : 0,
      tmpl.createdAt ? new Date(tmpl.createdAt).toLocaleDateString('en-IN') : 'N/A'
    ];
  });

  const wsTemplates = XLSX.utils.aoa_to_sheet([templatesHeaders, ...templatesRows]);
  wsTemplates['!cols'] = [
    { wch: 8 },  // Sr No
    { wch: 28 }, // Name
    { wch: 14 }, // Status
    { wch: 16 }, // Category
    { wch: 10 }, // Lang
    { wch: 15 }, // Mode
    { wch: 14 }, // Media Type
    { wch: 14 }, // Header Type
    { wch: 28 }, // Header Content
    { wch: 45 }, // Body Text
    { wch: 25 }, // Footer Text
    { wch: 35 }, // Buttons
    { wch: 20 }, // Variables
    { wch: 18 }, // Cards Count
    { wch: 14 }  // Created Date
  ];
  XLSX.utils.book_append_sheet(wb, wsTemplates, 'Templates Catalog');

  // --- SHEET 3: CAROUSEL CARDS BREAKDOWN (If any exist) ---
  const carouselCardsRows = [];
  templates.forEach(tmpl => {
    if (tmpl.isCarousel && Array.isArray(tmpl.carouselCards) && tmpl.carouselCards.length > 0) {
      tmpl.carouselCards.forEach((card, cIdx) => {
        carouselCardsRows.push([
          tmpl.name,
          `Card ${cIdx + 1}`,
          card.bodyText || '',
          card.buttonText || '',
          card.headerMediaId ? 'Attached Media' : 'None'
        ]);
      });
    }
  });

  if (carouselCardsRows.length > 0) {
    const carouselHeaders = ['Template Name', 'Card #', 'Card Body Text', 'Card Button CTA', 'Card Media'];
    const wsCarousel = XLSX.utils.aoa_to_sheet([carouselHeaders, ...carouselCardsRows]);
    wsCarousel['!cols'] = [{ wch: 26 }, { wch: 10 }, { wch: 45 }, { wch: 22 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsCarousel, 'Carousel Cards');
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `HK_WhatsApp_Templates_${isFiltered ? 'Filtered_' : 'All_'}${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename);
  return true;
};

/**
 * EXPORT MULTIPLE TEMPLATES TO PDF (.pdf)
 * High-aesthetic, executive-ready catalog report
 */
export const exportTemplatesToPDF = async (templates, filterInfo = {}) => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const primaryGreen = [18, 140, 126]; // #128c7e
  const slateDark = [15, 23, 42]; // slate-900
  const generatedDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const isFiltered = filterInfo.isFiltered || false;

  const approvedCount = templates.filter(t => t.status?.toUpperCase() === 'APPROVED').length;
  const pendingCount = templates.filter(t => t.status?.toUpperCase() === 'PENDING').length;
  const rejectedCount = templates.filter(t => t.status?.toUpperCase() === 'REJECTED').length;

  // --- SECTION 1: REPORT METRICS / STATS OVERVIEW ---
  const statsHeaders = ['Total Templates', 'Approved', 'Pending Review', 'Rejected', 'Filter Status', 'Search Scope'];
  const statsRows = [[
    `${templates.length}`,
    `${approvedCount} (${templates.length ? Math.round((approvedCount / templates.length) * 100) : 0}%)`,
    `${pendingCount} (${templates.length ? Math.round((pendingCount / templates.length) * 100) : 0}%)`,
    `${rejectedCount} (${templates.length ? Math.round((rejectedCount / templates.length) * 100) : 0}%)`,
    filterInfo.statusFilter ? `Status: ${filterInfo.statusFilter} | Cat: ${filterInfo.categoryFilter || 'ALL'}` : 'ALL',
    filterInfo.searchTerm ? `"${filterInfo.searchTerm}"` : 'Complete Catalog'
  ]];

  autoTable(doc, {
    head: [statsHeaders],
    body: statsRows,
    startY: 68,
    theme: 'grid',
    margin: { top: 68, left: 36, right: 36, bottom: 35 },
    headStyles: {
      fillColor: slateDark,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 4,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: slateDark,
      cellPadding: 5,
      halign: 'center',
      fontStyle: 'bold'
    },
    columnStyles: {
      1: { textColor: [22, 163, 74] },  // Green
      2: { textColor: [217, 119, 6] },  // Amber
      3: { textColor: [220, 38, 38] },  // Red
    }
  });

  // --- SECTION 2: DETAILED TEMPLATES TABLE ---
  const tableHeaders = ['#', 'Template Name', 'Category / Lang', 'Status', 'Media / Type', 'Body Text Content', 'Buttons & Footer'];

  const tableRows = templates.map((tmpl, idx) => {
    const details = getTemplateDetails(tmpl);
    const mediaLabel = details.isCarousel ? `Carousel (${details.carouselCards.length} cards)` : details.headerType;
    const footerAndBtns = [
      details.footerText ? `Footer: ${details.footerText}` : '',
      details.buttonsList.length ? `Buttons: ${details.buttonsList.join(', ')}` : ''
    ].filter(Boolean).join('\n') || '-';

    return [
      idx + 1,
      sanitizeForPdf(tmpl.name) + (tmpl.isCustom ? '\n[Custom]' : ''),
      `${sanitizeForPdf(tmpl.category)}\n(${tmpl.language?.toUpperCase() || 'EN'})`,
      sanitizeForPdf(tmpl.status || 'PENDING'),
      sanitizeForPdf(mediaLabel),
      sanitizeForPdf(details.bodyText.slice(0, 320)),
      sanitizeForPdf(footerAndBtns.slice(0, 200))
    ];
  });

  autoTable(doc, {
    head: [tableHeaders],
    body: tableRows,
    startY: doc.lastAutoTable.finalY + 12,
    theme: 'striped',
    margin: { top: 68, left: 36, right: 36, bottom: 35 },
    headStyles: {
      fillColor: primaryGreen,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 5,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: slateDark,
      cellPadding: 5,
      valign: 'top'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 120, fontStyle: 'bold' },
      2: { cellWidth: 80 },
      3: { cellWidth: 65, fontStyle: 'bold' },
      4: { cellWidth: 80 },
      5: { cellWidth: 245 },
      6: { cellWidth: 154 }
    },
    didParseCell: (data) => {
      // Color-code the Status column
      if (data.section === 'body' && data.column.index === 3) {
        const val = String(data.cell.raw).toUpperCase();
        if (val.includes('APPROVED')) {
          data.cell.styles.textColor = [22, 163, 74];
        } else if (val.includes('PENDING')) {
          data.cell.styles.textColor = [217, 119, 6];
        } else if (val.includes('REJECTED')) {
          data.cell.styles.textColor = [220, 38, 38];
        }
      }
    }
  });

  // --- FINAL PASS: DRAW BRANDED HEADER & FOOTER ON ALL PAGES ---
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // 1. Top green brand accent stripe
    doc.setFillColor(18, 140, 126);
    doc.rect(0, 0, pageWidth, 4, 'F');

    // 2. Company Brand Logo
    try {
      if (LOGO_BASE64) {
        doc.addImage(LOGO_BASE64, 'PNG', 36, 12, 134, 38);
      }
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(18, 140, 126);
      doc.text('HariKrushn DigiVerse', 36, 36);
    }

    // 3. Right Header Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('WhatsApp Templates Catalog Report', pageWidth - 36, 26, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${generatedDate} IST`, pageWidth - 36, 39, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(18, 140, 126);
    doc.text(
      isFiltered ? `Filtered Catalog (${templates.length} templates)` : `Complete Catalog (${templates.length} templates)`,
      pageWidth - 36,
      50,
      { align: 'right' }
    );

    // 4. Separator line below header
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.75);
    doc.line(36, 58, pageWidth - 36, 58);

    // 5. Clean Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'HariKrushn DigiVerse LLP • WhatsApp Marketing Platform | Confidential & Proprietary',
      36,
      pageHeight - 16
    );
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - 36,
      pageHeight - 16,
      { align: 'right' }
    );
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `HK_WhatsApp_Templates_${isFiltered ? 'Filtered_' : 'All_'}${dateStr}.pdf`;
  doc.save(filename);
  return true;
};

/**
 * EXPORT SINGLE TEMPLATE TO EXCEL (.xlsx)
 * Detailed technical and content specification for a single template
 */
export const exportSingleTemplateToExcel = async (template) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const details = getTemplateDetails(template);
  const generatedDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  // --- SHEET 1: SPECIFICATION OVERVIEW ---
  const overviewRows = [
    ['WhatsApp Template Specification Sheet'],
    ['Generated On (IST)', generatedDate],
    [],
    ['FIELD', 'VALUE'],
    ['Template Name', template.name || 'Untitled'],
    ['Status', template.status || 'UNKNOWN'],
    ['Category', template.category || 'MARKETING'],
    ['Language', (template.language || 'en').toUpperCase()],
    ['Template Mode', template.isCustom ? 'Custom Local Template' : 'Meta Official Synced'],
    ['Media / Layout Format', details.isCarousel ? 'Interactive Carousel' : details.headerType],
    ['Header Format', details.headerType],
    ['Header Content', details.headerContent],
    ['Body Text Message', details.bodyText],
    ['Footer Text', details.footerText || 'None'],
    ['Buttons / CTAs', details.buttonsText],
    ['Detected Variables', details.variables.join(', ') || 'None'],
    ['Variables Count', details.variableCount],
    ['Carousel Cards Count', details.isCarousel ? details.carouselCards.length : 0],
    ['Meta Template ID', template.metaTemplateId || 'N/A'],
    ['Created Date', template.createdAt ? new Date(template.createdAt).toLocaleString('en-IN') : 'N/A']
  ];

  const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows);
  wsOverview['!cols'] = [{ wch: 25 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Template Specification');

  // --- SHEET 2: CAROUSEL BREAKDOWN (If carousel) ---
  if (details.isCarousel && details.carouselCards.length > 0) {
    const cardHeaders = ['Card #', 'Card Body Text', 'Action Button CTA', 'Header Media Status'];
    const cardRows = details.carouselCards.map((c, i) => [
      `Card ${i + 1}`,
      c.bodyText || '',
      c.buttonText || '',
      c.headerMediaId ? 'Media Attached' : 'None'
    ]);
    const wsCards = XLSX.utils.aoa_to_sheet([cardHeaders, ...cardRows]);
    wsCards['!cols'] = [{ wch: 10 }, { wch: 45 }, { wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsCards, 'Carousel Cards');
  }

  const cleanName = (template.name || 'template').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Template_${cleanName}_${dateStr}.xlsx`);
  return true;
};

/**
 * EXPORT SINGLE TEMPLATE TO PDF (.pdf)
 * High-profile executive specification document with WhatsApp UI Preview simulation
 */
export const exportSingleTemplateToPDF = async (template) => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const primaryGreen = [18, 140, 126];
  const slateDark = [15, 23, 42];
  const generatedDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const details = getTemplateDetails(template);
  const cleanName = sanitizeForPdf(template.name || 'Untitled Template');

  // Status Color
  let statusColor = [22, 163, 74]; // Green for approved
  if (template.status?.toUpperCase() === 'PENDING') statusColor = [217, 119, 6];
  if (template.status?.toUpperCase() === 'REJECTED') statusColor = [220, 38, 38];

  // --- SECTION 1: METADATA MATRIX ---
  const metaHeaders = ['Parameter', 'Specification Details'];
  const metaRows = [
    ['Template Name', cleanName],
    ['Status', sanitizeForPdf(template.status || 'PENDING')],
    ['Category', sanitizeForPdf(template.category || 'MARKETING')],
    ['Language', (template.language || 'en').toUpperCase()],
    ['Type / Engine', template.isCustom ? 'Custom Local Template' : 'Meta Official WhatsApp Template'],
    ['Media Format', details.isCarousel ? `Carousel (${details.carouselCards.length} cards)` : details.headerType],
    ['Variable Placeholders', details.variables.join(', ') || 'None (Static Template)'],
    ['Created Timestamp', template.createdAt ? new Date(template.createdAt).toLocaleString('en-IN') : 'N/A']
  ];

  autoTable(doc, {
    head: [metaHeaders],
    body: metaRows,
    startY: 68,
    theme: 'grid',
    margin: { top: 68, left: 36, right: 36, bottom: 35 },
    headStyles: {
      fillColor: slateDark,
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: slateDark,
      cellPadding: 4.5,
    },
    columnStyles: {
      0: { cellWidth: 140, fontStyle: 'bold' },
      1: { cellWidth: 383 }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === 1 && data.column.index === 1) {
        data.cell.styles.textColor = statusColor;
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  // --- SECTION 2: COMPONENT SPECIFICATION BREAKDOWN ---
  const compHeaders = ['Component', 'Type / Format', 'Detailed Content / Text Payload'];
  const compRows = [
    ['Header', sanitizeForPdf(details.headerType), sanitizeForPdf(details.headerContent)],
    ['Body Message', 'Dynamic Text', sanitizeForPdf(details.bodyText)],
    ['Footer', 'Sub-text', sanitizeForPdf(details.footerText || 'None')],
    ['Interactive Buttons', `${details.buttonsList.length} Action(s)`, sanitizeForPdf(details.buttonsText || 'None')]
  ];

  autoTable(doc, {
    head: [compHeaders],
    body: compRows,
    startY: doc.lastAutoTable.finalY + 12,
    theme: 'striped',
    margin: { top: 68, left: 36, right: 36, bottom: 35 },
    headStyles: {
      fillColor: primaryGreen,
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      cellPadding: 5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: slateDark,
      cellPadding: 5,
      valign: 'top'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 100, fontStyle: 'bold' },
      1: { cellWidth: 90 },
      2: { cellWidth: 333 }
    }
  });

  // --- SECTION 3: CAROUSEL CARDS TABLE (If carousel) ---
  if (details.isCarousel && details.carouselCards.length > 0) {
    const cardHeaders = ['Card #', 'Card Content / Body', 'Button CTA'];
    const cardRows = details.carouselCards.map((c, i) => [
      `Card ${i + 1}`,
      sanitizeForPdf(c.bodyText),
      sanitizeForPdf(c.buttonText || 'None')
    ]);

    autoTable(doc, {
      head: [cardHeaders],
      body: cardRows,
      startY: doc.lastAutoTable.finalY + 12,
      theme: 'grid',
      margin: { top: 68, left: 36, right: 36, bottom: 35 },
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        cellPadding: 4,
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: slateDark,
        cellPadding: 4.5,
      },
      columnStyles: {
        0: { cellWidth: 60, fontStyle: 'bold', halign: 'center' },
        1: { cellWidth: 343 },
        2: { cellWidth: 120, fontStyle: 'bold', textColor: primaryGreen }
      }
    });
  }

  // --- SECTION 4: SIMULATED WHATSAPP MESSAGE PREVIEW BOX ---
  let previewStartY = doc.lastAutoTable.finalY + 14;
  if (previewStartY + 140 > pageHeight - 45) {
    doc.addPage();
    previewStartY = 68;
  }

  // Preview Section Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Visual WhatsApp Customer View Preview:', 36, previewStartY);

  const bubbleX = 36;
  const bubbleY = previewStartY + 8;
  const bubbleWidth = pageWidth - 72;

  // Background box representing chat
  doc.setFillColor(240, 242, 245); // WhatsApp chat background
  doc.roundedRect(bubbleX, bubbleY, bubbleWidth, 120, 6, 6, 'F');

  // White message bubble
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(bubbleX + 10, bubbleY + 8, bubbleWidth - 20, 104, 6, 6, 'F');

  // Inside bubble text
  let innerY = bubbleY + 22;

  // Header inside bubble
  if (details.headerType === 'TEXT' && details.headerContent) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizeForPdf(details.headerContent), bubbleX + 18, innerY);
    innerY += 12;
  } else if (details.headerType !== 'NONE') {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`[${details.headerType} Media Attachment]`, bubbleX + 18, innerY);
    innerY += 12;
  }

  // Body inside bubble
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const bodySnippet = sanitizeForPdf(details.bodyText);
  const splitLines = doc.splitTextToSize(bodySnippet, bubbleWidth - 40);
  doc.text(splitLines.slice(0, 4), bubbleX + 18, innerY);
  innerY += Math.min(splitLines.length, 4) * 9.5;

  // Footer inside bubble
  if (details.footerText) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(sanitizeForPdf(details.footerText), bubbleX + 18, innerY + 4);
    innerY += 10;
  }

  // Buttons inside bubble
  if (details.buttonsList.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(18, 140, 126);
    const btnsSnippet = details.buttonsList.map(b => b.replace(/^\d+\.\s*/, '')).join('  |  ');
    doc.text(sanitizeForPdf(btnsSnippet), bubbleX + 18, bubbleY + 100);
  }

  // --- FINAL PASS: DRAW BRANDED HEADER & FOOTER ON ALL PAGES ---
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // 1. Top green brand accent stripe
    doc.setFillColor(18, 140, 126);
    doc.rect(0, 0, pageWidth, 4, 'F');

    // 2. Company Brand Logo
    try {
      if (LOGO_BASE64) {
        doc.addImage(LOGO_BASE64, 'PNG', 36, 12, 134, 38);
      }
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(18, 140, 126);
      doc.text('HariKrushn DigiVerse', 36, 36);
    }

    // 3. Right Header Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('WhatsApp Template Specification', pageWidth - 36, 26, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${generatedDate} IST`, pageWidth - 36, 39, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(18, 140, 126);
    doc.text(`Template: ${cleanName.slice(0, 40)}`, pageWidth - 36, 50, { align: 'right' });

    // 4. Separator line below header
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.75);
    doc.line(36, 58, pageWidth - 36, 58);

    // 5. Clean Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'HariKrushn DigiVerse LLP • WhatsApp Marketing Platform | Confidential & Proprietary',
      36,
      pageHeight - 16
    );
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - 36,
      pageHeight - 16,
      { align: 'right' }
    );
  }

  const fileClean = cleanName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`HK_Template_${fileClean}_${dateStr}.pdf`);
  return true;
};
