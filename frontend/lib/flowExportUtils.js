import { LOGO_BASE64 } from './logoBase64';

/**
 * Helper to clean and format text for PDF display (removes emojis and unrenderable glyphs for standard PDF fonts)
 */
const sanitizeForPdf = (str) => {
  if (!str) return '';
  let s = String(str);
  
  // Replace common emojis with readable English text tokens
  s = s.replace(/🏠/g, '[House] ')
       .replace(/🏢/g, '[Commercial] ')
       .replace(/🎨/g, '[Interior] ')
       .replace(/🔨/g, '[Renovation] ')
       .replace(/👋/g, '[Hello] ')
       .replace(/📍/g, '[Location] ')
       .replace(/💰/g, '[Budget] ')
       .replace(/📅/g, '[Date] ')
       .replace(/📞/g, '[Call] ')
       .replace(/✅/g, '[Yes] ')
       .replace(/❌/g, '[No] ')
       .replace(/⏱️|⏳/g, '[Delay] ')
       .replace(/🤖/g, '[AI] ')
       .replace(/👤/g, '[Agent] ')
       .replace(/1️⃣/g, '1. ')
       .replace(/2️⃣/g, '2. ')
       .replace(/3️⃣/g, '3. ')
       .replace(/4️⃣/g, '4. ');

  // Standard Helvetica only supports Latin-1 characters.
  // For characters outside Latin-1 (like Gujarati or complex unicode),
  // replace them with ASCII-compatible clean text or fallback gracefully.
  const cleaned = [];
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    // Keep standard ASCII printable + common whitespace + Latin-1 supplement
    if ((code >= 32 && code <= 126) || code === 10 || code === 13 || (code >= 160 && code <= 255)) {
      cleaned.push(s[i]);
    } else if (code > 255) {
      // Non-Latin characters (like Gujarati) -> avoid printing ???? in jsPDF
      // We will skip non-Latin in PDF text or replace with space if it creates noise
    }
  }
  return cleaned.join('').replace(/[ \t]+/g, ' ').trim();
};

/**
 * Extracts human-readable details for a given flow node
 */
export const getNodeDetails = (node, index = 0, allNodes = []) => {
  const type = node.type || node.data?.nodeType || 'message';
  const data = node.data || {};
  let title = `Step ${index + 1}: ${type.toUpperCase()}`;
  let typeLabel = type.toUpperCase();
  let content = '';
  let variable = data.variable || '-';
  let technicalSummary = '';
  let plainEnglishExplanation = '';

  switch (type) {
    case 'message': {
      typeLabel = 'Send Message';
      const isImage = data.message?.type === 'image';
      const text = data.message?.text || data.message?.caption || data.message?.body || '';
      content = isImage ? `[IMAGE] Asset: ${data.message?.assetKey || 'Attached Image'}\nCaption: ${text}` : text;
      title = `Step ${index + 1}: Send Message`;
      plainEnglishExplanation = `Bot sends message to customer: "${text ? text.slice(0, 100) : 'Informational message'}..."`;
      technicalSummary = isImage ? `Outbound Image (${data.message?.assetKey || 'media'})` : 'Outbound Plain Text';
      break;
    }
    case 'question': {
      typeLabel = 'Ask Question';
      const body = data.message?.body || data.message?.text || data.message?.caption || '';
      const rows = [];
      if (Array.isArray(data.message?.sections)) {
        data.message.sections.forEach(sec => {
          if (Array.isArray(sec.rows)) {
            sec.rows.forEach(r => rows.push(`• ${r.title || r.id} (${r.description || ''})`));
          }
        });
      }
      content = body + (rows.length > 0 ? `\nOptions:\n${rows.join('\n')}` : '');
      title = `Step ${index + 1}: Ask Question (${variable !== '-' ? `Stores into "${variable}"` : 'Input'})`;
      plainEnglishExplanation = `Bot asks customer: "${body.slice(0, 90)}..." and records their reply into variable "${variable}".`;
      technicalSummary = `Interactive Q&A | Saved in {${variable}}`;
      break;
    }
    case 'condition': {
      typeLabel = 'Branch Condition';
      const condVar = data.condition?.variable || 'variable';
      const condVal = data.condition?.value || '';
      content = `Evaluate if {${condVar}} matches "${condVal}"`;
      title = `Step ${index + 1}: Logic Decision Branch`;
      plainEnglishExplanation = `Bot checks customer input {${condVar}}. If value equals "${condVal}", routes via TRUE path; otherwise routes via FALSE path.`;
      technicalSummary = `IF {${condVar}} == "${condVal}" THEN TRUE ELSE FALSE`;
      break;
    }
    case 'ai': {
      typeLabel = 'AI Agent Response';
      content = data.aiPrompt || 'Dynamic AI persona reply to customer query.';
      title = `Step ${index + 1}: AI Persona Prompt`;
      plainEnglishExplanation = `ChatGPT/AI persona dynamically analyzes customer's inquiry and replies intelligently based on system prompt.`;
      technicalSummary = `Generative AI Prompt: "${(data.aiPrompt || '').slice(0, 70)}..."`;
      break;
    }
    case 'delay': {
      typeLabel = 'Wait Delay';
      const sec = data.delaySeconds || 0;
      content = `Wait ${sec} second(s) before next action.`;
      title = `Step ${index + 1}: Wait Delay (${sec}s)`;
      plainEnglishExplanation = `Workflow pauses automatically for ${sec >= 60 ? `${Math.round(sec / 60)} minute(s)` : `${sec} second(s)`} to feel natural before proceeding.`;
      technicalSummary = `Delay Timer: ${sec}s`;
      break;
    }
    case 'handoff': {
      typeLabel = 'Human Agent Handoff';
      content = 'Pause AI bot and transfer chat to a live support agent.';
      title = `Step ${index + 1}: Human Handoff`;
      plainEnglishExplanation = `Bot pauses automation and notifies the team inbox so a human representative can take over the chat.`;
      technicalSummary = `Agent Takeover Notification`;
      break;
    }
    default: {
      typeLabel = type;
      content = JSON.stringify(data);
      title = `Step ${index + 1}: ${type}`;
      plainEnglishExplanation = `Action step executed by bot.`;
      technicalSummary = type;
    }
  }

  // Format edges / next destinations
  const nextSteps = [];
  const edgeList = node.edges || [];
  edgeList.forEach(edge => {
    const targetNode = allNodes.find(n => n.id === edge.targetNodeId);
    const targetIdx = allNodes.findIndex(n => n.id === edge.targetNodeId);
    const targetName = targetNode ? `Step ${targetIdx + 1} (${targetNode.type || 'Action'})` : edge.targetNodeId;
    const label = edge.label ? `[Option/Rule: "${edge.label}"]` : '';
    nextSteps.push(`-> ${targetName} ${label}`.trim());
  });

  return {
    id: node.id,
    type,
    typeLabel,
    title,
    content,
    variable,
    plainEnglishExplanation,
    technicalSummary,
    nextSteps: nextSteps.length > 0 ? nextSteps.join('\n') : 'End of Branch (Terminal)',
    edges: edgeList
  };
};

/**
 * Builds the complete "How this Bot Works" executive story walkthrough
 */
export const buildExecutiveWalkthrough = (flow) => {
  const triggerType = flow.trigger?.type || 'keyword';
  const keywords = Array.isArray(flow.trigger?.keywords) ? flow.trigger.keywords.join(', ') : 'any inbound text';
  const nodes = flow.nodes || [];

  const walkthrough = [];

  // Stage 1: Trigger
  walkthrough.push({
    stage: '1. Inbound Trigger Initiation',
    action: triggerType === 'keyword' ? `Customer types keyword: "${keywords}"` : 'Customer sends any initial message',
    explanation: `When a customer reaches out on WhatsApp and triggers the keywords [${keywords}], the automation begins immediately without any human delay.`,
  });

  // Stage 2: Progression through nodes
  nodes.forEach((node, idx) => {
    const details = getNodeDetails(node, idx, nodes);
    walkthrough.push({
      stage: `Stage ${idx + 2}: ${details.typeLabel}`,
      action: details.title,
      explanation: `${details.plainEnglishExplanation} (Next: ${details.nextSteps.replace(/\n/g, ', ')})`,
    });
  });

  return walkthrough;
};

/**
 * Export Flow to PDF (Branded, executive-ready for presentations & explanations)
 */
export const exportFlowToPDF = async (flow) => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const primaryColor = [18, 140, 126]; // #128c7e WhatsApp green
  const slateDark = [15, 23, 42]; // slate-900
  const generatedDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const rawFlowName = flow.name || 'Untitled Bot Flow';
  const cleanFlowName = sanitizeForPdf(rawFlowName) || 'Bot Flow';
  const triggerType = flow.trigger?.type || 'keyword';
  const keywordsStr = Array.isArray(flow.trigger?.keywords) && flow.trigger.keywords.length > 0
    ? flow.trigger.keywords.join(', ')
    : 'Any message';
  const totalNodes = flow.nodes?.length || 0;
  const totalEdges = (flow.nodes || []).reduce((acc, n) => acc + (n.edges?.length || 0), 0);

  // Helper to ensure section titles never get orphaned or overlap at page bottoms
  const getNextSectionStartY = (titleText) => {
    const requiredSpace = 75; // Space for section heading + table header row
    let startY = 68;
    if (doc.lastAutoTable && doc.lastAutoTable.finalY) {
      if (doc.lastAutoTable.finalY + requiredSpace > pageHeight - 35) {
        doc.addPage();
        startY = 76;
      } else {
        startY = doc.lastAutoTable.finalY + 18;
      }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(titleText, 36, startY);
    return startY + 8;
  };

  // --- SECTION 1: EXECUTIVE OVERVIEW SUMMARY TABLE ---
  const overviewHeaders = ['Specification Property', 'Configured Value', 'Operational Impact / Explanation'];
  const overviewRows = [
    ['Bot Flow Name', cleanFlowName, 'Identifies this conversational workflow in your account'],
    ['Trigger Rule', triggerType === 'keyword' ? 'Keyword Trigger Match' : 'On First Inbound Message', 'Determines when WhatsApp will automatically launch this bot'],
    ['Trigger Keywords', sanitizeForPdf(keywordsStr), 'Specific words from customer that ignite this automated conversation'],
    ['Total Flow Steps', `${totalNodes} Steps / Blocks`, 'Total interactive dialogs, questions, conditions, and prompts'],
    ['Decision Paths', `${totalEdges} Branch Connections`, 'Total branching paths and rule outcomes mapped in the builder'],
    ['Operational Status', flow.isActive ? 'Active (Live)' : 'Draft / Inactive', flow.isActive ? 'Actively answering inbound WhatsApp users' : 'Inactive in production until toggled on'],
    ['Flow Description', sanitizeForPdf(flow.description) || 'Automated customer engagement & lead capture sequence', 'Primary objective of this workflow']
  ];

  autoTable(doc, {
    head: [overviewHeaders],
    body: overviewRows,
    startY: 68,
    theme: 'striped',
    margin: { top: 68, left: 36, right: 36, bottom: 35 },
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      cellPadding: 6,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: slateDark,
      cellPadding: 5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 150, fontStyle: 'bold' },
      1: { cellWidth: 280, fontStyle: 'bold', textColor: [18, 140, 126] },
      2: { cellWidth: 340, textColor: [71, 85, 105] },
    },
  });

  // --- SECTION 2: HOW THIS BOT WORKS / EXECUTIVE WALKTHROUGH ---
  const walkthroughList = buildExecutiveWalkthrough(flow);
  const walkthroughHeaders = ['Stage #', 'Action / Step Triggered', 'Detailed Customer Journey Explanation (How It Works)'];
  const walkthroughRows = walkthroughList.map(w => [
    sanitizeForPdf(w.stage),
    sanitizeForPdf(w.action),
    sanitizeForPdf(w.explanation),
  ]);

  const yAfterSec1 = getNextSectionStartY('1. Executive Walkthrough: How This Bot Works (Customer Journey)');

  autoTable(doc, {
    head: [walkthroughHeaders],
    body: walkthroughRows,
    startY: yAfterSec1,
    theme: 'striped',
    margin: { top: 68, left: 36, right: 36, bottom: 35 },
    headStyles: {
      fillColor: [30, 41, 59], // Dark slate header
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 5,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: slateDark,
      cellPadding: 5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 120, fontStyle: 'bold' },
      1: { cellWidth: 200, fontStyle: 'bold', textColor: [18, 140, 126] },
      2: { cellWidth: 450, textColor: [51, 65, 85] },
    },
  });

  // --- SECTION 3: STEP-BY-STEP FLOW EXECUTION TABLE ---
  const stepHeaders = ['Step', 'Type', 'Content / Question Sent', 'Saved Variable', 'Next Target Step(s)'];
  const stepRows = (flow.nodes || []).map((node, idx) => {
    const details = getNodeDetails(node, idx, flow.nodes);
    return [
      `Step ${idx + 1}`,
      sanitizeForPdf(details.typeLabel),
      sanitizeForPdf(details.content.slice(0, 250)),
      sanitizeForPdf(details.variable),
      sanitizeForPdf(details.nextSteps),
    ];
  });

  const yAfterSec2 = getNextSectionStartY('2. Step-by-Step Flow Execution & Block Details');

  autoTable(doc, {
    head: [stepHeaders],
    body: stepRows,
    startY: yAfterSec2,
    theme: 'striped',
    margin: { top: 68, left: 36, right: 36, bottom: 35 },
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 5,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: slateDark,
      cellPadding: 5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 45, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 95, fontStyle: 'bold', textColor: [18, 140, 126] },
      2: { cellWidth: 320 },
      3: { cellWidth: 110, halign: 'center' },
      4: { cellWidth: 200 },
    },
  });

  // --- SECTION 4: DECISION & ROUTING MATRIX ---
  const decisionMatrixRows = [];
  (flow.nodes || []).forEach((node, idx) => {
    const details = getNodeDetails(node, idx, flow.nodes);
    (node.edges || []).forEach(edge => {
      const targetNode = (flow.nodes || []).find(n => n.id === edge.targetNodeId);
      const targetIdx = (flow.nodes || []).findIndex(n => n.id === edge.targetNodeId);
      const targetTitle = targetNode ? `Step ${targetIdx + 1} (${targetNode.type})` : edge.targetNodeId;
      decisionMatrixRows.push([
        `Step ${idx + 1} (${details.typeLabel})`,
        sanitizeForPdf(edge.label) || (details.type === 'condition' ? (edge.sourceHandle || 'TRUE/FALSE') : 'Default Sequential Flow'),
        sanitizeForPdf(targetTitle),
        details.type === 'condition'
          ? `If condition passes/fails, route customer to ${targetTitle}`
          : `When customer selects this option, proceed to ${targetTitle}`,
      ]);
    });
  });

  if (decisionMatrixRows.length > 0) {
    const yAfterSec3 = getNextSectionStartY('3. Branching Decision & Path Routing Matrix');

    autoTable(doc, {
      head: [['Source Step', 'Condition / User Selection', 'Target Destination', 'Branch Result & Outcome']],
      body: decisionMatrixRows,
      startY: yAfterSec3,
      theme: 'striped',
      margin: { top: 68, left: 36, right: 36, bottom: 35 },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        cellPadding: 5,
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: slateDark,
        cellPadding: 5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 150, fontStyle: 'bold' },
        1: { cellWidth: 200, textColor: [18, 140, 126], fontStyle: 'bold' },
        2: { cellWidth: 180, fontStyle: 'bold' },
        3: { cellWidth: 240, textColor: [71, 85, 105] },
      },
    });
  }

  // --- FINAL SINGLE PASS: DRAW BRANDED HEADER & FOOTER ON ALL PAGES ---
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // 1. Top green brand accent stripe
    doc.setFillColor(18, 140, 126);
    doc.rect(0, 0, pageWidth, 4, 'F');

    // 2. Company Brand Logo (HariKrushn DigiVerse LLP)
    try {
      if (LOGO_BASE64) {
        doc.addImage(LOGO_BASE64, 'PNG', 36, 12, 134, 38);
      }
    } catch (imgErr) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(18, 140, 126);
      doc.text('HariKrushn DigiVerse LLP', 36, 36);
    }

    // 3. Right Header Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('Chatbot Flow Architecture Report', pageWidth - 36, 26, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${generatedDate} IST`, pageWidth - 36, 39, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(18, 140, 126);
    doc.text(`Flow: ${cleanFlowName.slice(0, 45)}`, pageWidth - 36, 50, { align: 'right' });

    // 4. Subtle separator line below header
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.75);
    doc.line(36, 58, pageWidth - 36, 58);

    // 5. Clean Footer with Accurate "Page i of totalPages" Numbering
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

  // Save the PDF
  const dateStr = new Date().toISOString().split('T')[0];
  const fileClean = cleanFlowName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  doc.save(`HK_BotFlow_${fileClean}_${dateStr}.pdf`);
  return true;
};

/**
 * Export Flow to Excel (.xlsx Multi-sheet Workbook)
 */
export const exportFlowToExcel = async (flow) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const generatedDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const rawFlowName = flow.name || 'Untitled Bot Flow';
  const triggerType = flow.trigger?.type || 'keyword';
  const keywordsStr = Array.isArray(flow.trigger?.keywords) && flow.trigger.keywords.length > 0
    ? flow.trigger.keywords.join(', ')
    : 'Any message';
  const nodes = flow.nodes || [];
  const totalEdges = nodes.reduce((acc, n) => acc + (n.edges?.length || 0), 0);

  // --- SHEET 1: FLOW OVERVIEW ---
  const overviewData = [
    ['CHATBOT FLOW SPECIFICATION OVERVIEW', ''],
    ['Organization', 'HariKrushn DigiVerse LLP - WhatsApp Marketing Platform'],
    ['Report Title', 'Chatbot Flow Architecture & Workflow Specification'],
    ['Bot Flow Name', rawFlowName],
    ['Description', flow.description || 'Automated multi-step WhatsApp bot sequence'],
    ['Operational Status', flow.isActive ? 'Active (Live)' : 'Draft / Inactive'],
    ['Trigger Type', triggerType === 'keyword' ? 'Keyword Match' : 'First Inbound Message'],
    ['Trigger Keywords', keywordsStr],
    ['Total Steps / Nodes', nodes.length],
    ['Total Decision Branches', totalEdges],
    ['Generated Date & Time', `${generatedDate} IST`],
    ['Confidentiality Notice', 'Proprietary & Confidential - For Internal & Client Presentation Use']
  ];
  const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
  wsOverview['!cols'] = [{ wch: 28 }, { wch: 65 }];
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Flow Overview');

  // --- SHEET 2: HOW THIS BOT WORKS (WALKTHROUGH) ---
  const walkthroughList = buildExecutiveWalkthrough(flow);
  const walkthroughData = [
    ['STAGE', 'ACTION TRIGGERED', 'DETAILED CONVERSATIONAL EXPLANATION (HOW IT WORKS)']
  ];
  walkthroughList.forEach(w => {
    walkthroughData.push([w.stage, w.action, w.explanation]);
  });
  const wsWalkthrough = XLSX.utils.aoa_to_sheet(walkthroughData);
  wsWalkthrough['!cols'] = [{ wch: 20 }, { wch: 35 }, { wch: 75 }];
  XLSX.utils.book_append_sheet(wb, wsWalkthrough, 'How It Works Walkthrough');

  // --- SHEET 3: STEP-BY-STEP EXECUTION TABLE ---
  const stepsData = [
    ['STEP NO.', 'NODE ID', 'STEP TYPE', 'MESSAGE / QUESTION / PROMPT CONTENT', 'STORED VARIABLE', 'NEXT DESTINATION PATHS', 'TECHNICAL DETAILS']
  ];
  nodes.forEach((node, idx) => {
    const details = getNodeDetails(node, idx, nodes);
    stepsData.push([
      `Step ${idx + 1}`,
      node.id,
      details.typeLabel,
      details.content,
      details.variable,
      details.nextSteps,
      details.technicalSummary
    ]);
  });
  const wsSteps = XLSX.utils.aoa_to_sheet(stepsData);
  wsSteps['!cols'] = [{ wch: 10 }, { wch: 22 }, { wch: 20 }, { wch: 55 }, { wch: 18 }, { wch: 35 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsSteps, 'Step-by-Step Flow');

  // --- SHEET 4: DECISION & ROUTING MATRIX ---
  const decisionData = [
    ['SOURCE STEP', 'NODE TYPE', 'CUSTOMER SELECTION / CONDITION', 'TARGET DESTINATION', 'OUTCOME EXPLANATION']
  ];
  nodes.forEach((node, idx) => {
    const details = getNodeDetails(node, idx, nodes);
    (node.edges || []).forEach(edge => {
      const targetNode = nodes.find(n => n.id === edge.targetNodeId);
      const targetIdx = nodes.findIndex(n => n.id === edge.targetNodeId);
      const targetTitle = targetNode ? `Step ${targetIdx + 1}: ${targetNode.type}` : edge.targetNodeId;
      decisionData.push([
        `Step ${idx + 1}`,
        details.typeLabel,
        edge.label || (details.type === 'condition' ? (edge.sourceHandle || 'Default') : 'Direct Progression'),
        targetTitle,
        details.type === 'condition'
          ? `Checks variable condition. If match, proceeds to ${targetTitle}`
          : `When customer selects this option, routes to ${targetTitle}`
      ]);
    });
  });
  const wsDecision = XLSX.utils.aoa_to_sheet(decisionData);
  wsDecision['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 35 }, { wch: 25 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, wsDecision, 'Decision Matrix');

  // --- SHEET 5: VARIABLES & LEAD CAPTURE DIRECTORY ---
  const variablesData = [
    ['VARIABLE NAME', 'CAPTURED AT STEP', 'DATA TYPE / DESCRIPTION', 'USAGE IN FLOW']
  ];
  const capturedVars = new Set();
  nodes.forEach((node, idx) => {
    const v = node.data?.variable;
    if (v && v.trim()) {
      capturedVars.add(v.trim());
      variablesData.push([
        `{${v.trim()}}`,
        `Step ${idx + 1} (${node.type || 'Question'})`,
        'Customer Input Value',
        `Stored from Step ${idx + 1} for lead qualification or downstream conditions`
      ]);
    }
  });
  if (variablesData.length === 1) {
    variablesData.push(['No custom variables', 'N/A', 'N/A', 'This bot flow sends direct informative sequences without user input variables.']);
  }
  const wsVars = XLSX.utils.aoa_to_sheet(variablesData);
  wsVars['!cols'] = [{ wch: 22 }, { wch: 25 }, { wch: 30 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsVars, 'Captured Variables');

  // Write and trigger download
  const dateStr = new Date().toISOString().split('T')[0];
  const fileClean = rawFlowName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  XLSX.writeFile(wb, `HK_BotFlow_${fileClean}_${dateStr}.xlsx`);
  return true;
};
