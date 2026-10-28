"use strict";
const axios = require("axios");
const winston = require("winston");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS (WhatsApp Cloud API limits)
// ─────────────────────────────────────────────────────────────────────────────
const BTN_LIMIT = 3; // max reply buttons per message
const BTN_TITLE_MAX = 20; // reply button title
const ROW_TITLE_MAX = 24; // list row title
const ROW_DESC_MAX = 72; // list row description
const LIST_ROW_MAX = 10; // rows per list message
const GROQ_MODELS = (process.env.GROQ_MODELS || "openai/gpt-oss-120b,openai/gpt-oss-20b")
  .split(",")
  .map(function (s) {
    return s.trim();
  })
  .filter(Boolean);
// 'auto' (default) = known industries use the tested blueprint; unknown/general businesses try AI first.
// 'ai' = always try AI first. 'blueprint' = never use AI to build.
const BUILDER_MODE = (process.env.BOT_BUILDER_MODE || "auto").toLowerCase();

// ─────────────────────────────────────────────────────────────────────────────
// SMALL HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function clip(str, max) {
  const chars = Array.from(
    String(str == null ? "" : str)
      .replace(/\s+/g, " ")
      .trim(),
  );
  return chars.length <= max ? chars.join("") : chars.slice(0, max).join("").trim();
}

// Lower-case, strip emoji/punctuation (keeps letters, marks and digits in any script)
function norm(s) {
  return String(s == null ? "" : s)
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Edge label = every way a user can pick this option: title, truncated title, number, button id
function labelFor(id, title, idx) {
  const t = String(title || "").replace(/,/g, " ");
  const tokens = [t, clip(t, BTN_TITLE_MAX), clip(t, ROW_TITLE_MAX), String(idx + 1), id]
    .map(function (s) {
      return String(s == null ? "" : s).trim();
    })
    .filter(Boolean);
  return Array.from(new Set(tokens)).join(", ");
}

function getOptions(node) {
  const m = (node && node.data && node.data.message) || {};
  const out = [];
  if (Array.isArray(m.buttons) && m.buttons.length) {
    m.buttons.forEach(function (b) {
      out.push({ id: b.id, title: b.title || b.text });
    });
  } else if (Array.isArray(m.sections)) {
    m.sections.forEach(function (s) {
      (s.rows || []).forEach(function (r) {
        out.push({ id: r.id, title: r.title });
      });
    });
  }
  return out;
}

function edgeTokens(e) {
  return String(e.label || "")
    .split(",")
    .map(norm)
    .filter(Boolean);
}
function edgeMatchesOpt(e, o) {
  const tk = edgeTokens(e);
  return (o.id && tk.indexOf(norm(o.id)) !== -1) || (o.title && norm(o.title) && tk.indexOf(norm(o.title)) !== -1);
}

// ─────────────────────────────────────────────────────────────────────────────
// INDUSTRY DETECTION (scored, word-boundary based)
// ─────────────────────────────────────────────────────────────────────────────
const INDUSTRY_RULES = [
  ["Media & Content / Entertainment", "media", /\b(youtube|netflix|spotify|hotstar|prime video|streaming|podcasts?|creators?|vlogs?|cinema\w*|broadcast\w*|ott)\b/gi],
  ["Fitness & Gym", "fitness", /\b(gym|fitness|crossfit|workouts?|bodybuild\w*|personal train\w*|yoga|aerobics|calisthenics|pilates|zumba)\b/gi],
  ["Healthcare / Clinic & Hospital", "healthcare", /\b(clinic|hospital|doctors?|dental|dentist|medical|patients?|pharma\w*|ayurved\w*|therapy|medicine|ortho\w*|cardio\w*|paediatric|gynae\w*|diagnostic\w*|healthcare)\b/gi],
  ["Restaurant & Hospitality", "restaurant", /\b(restaurant|cafe|café|food|dining|pizza|kitchen|bakery|catering|coffee|dessert\w*|burgers?|chef|eatery|tiffin|dhaba|biryani)\b/gi],
  ["Real Estate / Property", "realestate", /\b(real estate|propert(y|ies)|realty|builders?|construction|interiors?|villas?|flats?|apartments?|brokers?|plots?|bungalows?|housing|sq\.? ?ft)\b/gi],
  ["E-Commerce & Retail", "retail", /\b(soap|skincare|cosmetics?|organic|handmade|candles?|apparel|clothing|clothes|fashion|boutique|stores?|shops?|retail|jewel\w*|grocery|perfume|handicrafts?|footwear|bags?|artisan|ecommerce|e-commerce|dress\w*|sarees?|sari|kurti\w*|kurta\w*|lehenga\w*|garments?|ethnic|textiles?)\b/gi],
  ["Education & Coaching", "education", /\b(education|coaching|school|college|academy|classes|institute|courses?|tuition|training|students?|learn\w*|tutor\w*|upskill)\b/gi],
  ["Travel & Tourism", "travel", /\b(tours?|travels?|resorts?|hotels?|holidays?|visa|trips?|vacations?|flights?|booking|safari|cruise)\b/gi],
  ["Automotive & Car Service", "auto", /\b(cars?|auto|vehicles?|garage|mechanics?|repair|motors|bikes?|towing|automobile|ev charging)\b/gi],
  ["Finance & Insurance", "finance", /\b(finance|loans?|insurance|invest\w*|tax|accounting|ca firm|mutual funds?|banking|wealth|portfolio)\b/gi],
  ["IT & Software / Digital Marketing", "it", /\b(software|tech|technology|developers?|coding|web development|app development|saas|ai|automation|seo|cloud|digital|agency|programming|it solutions?|it services?)\b/gi],
  ["Salon & Beauty", "salon", /\b(salon|spa|parlou?rs?|hair|nails?|waxing|threading|makeup|bridal|grooming|beauty)\b/gi],
  ["Legal Services", "legal", /\b(law|legal|advocates?|solicitor|attorney|court|compliance|notary)\b/gi],
  ["Events & Wedding", "events", /\b(events?|wedding|decor|photography|videography|planners?|caterers?|dj|sound|stage)\b/gi],
];

const FASHION_RE = /\b(dress\w*|sarees?|sari|kurti\w*|kurta\w*|lehenga\w*|gowns?|ethnic|boutique|garments?|fashion|clothing|clothes|apparel|textiles?|salwar|western wear)\b/i;

function scoreBest(text) {
  const t = String(text || "");
  let best = null;
  INDUSTRY_RULES.forEach(function (r) {
    const m = t.match(r[2]);
    const score = m
      ? new Set(
          m.map(function (x) {
            return x.toLowerCase();
          }),
        ).size
      : 0;
    if (score > 0 && (!best || score > best.score)) best = { label: r[0], key: r[1], score: score };
  });
  return best;
}

function detectIndustryFromText(text) {
  const b = scoreBest(text);
  return b ? b.label : "Other / General Business";
}

function resolveIndustryKey(ctx) {
  const fromDropdown = scoreBest(ctx.industry);
  let key = fromDropdown ? fromDropdown.key : null;
  if (!key) {
    const site = ctx.websiteData ? [ctx.websiteData.title, ctx.websiteData.description, (ctx.websiteData.headings || []).join(" ")].join(" ") : "";
    const b = scoreBest([ctx.businessName, ctx.prompt, site].join(" "));
    key = b ? b.key : "general";
  }
  if (key === "retail" || key === "general") {
    const all = [ctx.industry, ctx.businessName, ctx.prompt, ctx.websiteData ? ctx.websiteData.title : ""].join(" ");
    if (FASHION_RE.test(all)) key = "fashion";
  }
  return key;
}

// ─────────────────────────────────────────────────────────────────────────────
// WEBSITE SCRAPER (with basic SSRF protection)
// ─────────────────────────────────────────────────────────────────────────────
function isSafeHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (!h || h === "localhost" || h === "[::1]" || h === "::1") return false;
  if (/\.(local|internal|localdomain)$/.test(h)) return false;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  return true;
}

async function scrapeWebsite(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  let targetUrl = rawUrl.trim();
  if (!/^https?:\/\//i.test(targetUrl)) targetUrl = "https://" + targetUrl;

  try {
    const parsedUrl = new URL(targetUrl);
    if (!isSafeHost(parsedUrl.hostname)) {
      logger.warn("Website scrape blocked (private host): " + parsedUrl.hostname);
      return null;
    }

    const res = await axios.get(targetUrl, {
      timeout: 8000,
      maxRedirects: 3,
      maxContentLength: 2 * 1024 * 1024,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const html = typeof res.data === "string" ? res.data : "";
    if (!html) return null;

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";

    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    const description = descMatch ? descMatch[1].replace(/\s+/g, " ").trim() : "";

    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const ogDesc = ogDescMatch ? ogDescMatch[1].replace(/\s+/g, " ").trim() : "";

    const headings = [];
    const hRegex = /<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi;
    let match;
    while ((match = hRegex.exec(html)) !== null && headings.length < 10) {
      const cleanH = match[1]
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (cleanH && cleanH.length > 3 && cleanH.length < 100 && headings.indexOf(cleanH) === -1) headings.push(cleanH);
    }

    const navLinks = [];
    const navRegex = /<a[^>]*href=["'][^"']*["'][^>]*>([^<]{3,40})<\/a>/gi;
    const skipWords = ["home", "login", "sign", "contact", "search", "privacy", "terms", "blog", "cart", "account", "cookie", "skip"];
    while ((match = navRegex.exec(html)) !== null && navLinks.length < 15) {
      const linkText = match[1].replace(/\s+/g, " ").trim();
      if (
        linkText &&
        !skipWords.some(function (s) {
          return linkText.toLowerCase().indexOf(s) !== -1;
        }) &&
        navLinks.indexOf(linkText) === -1
      )
        navLinks.push(linkText);
    }

    let brandName = "";
    if (title) {
      brandName = title
        .split(/[-|–•:;]/)[0]
        .trim()
        .replace(/^(welcome to\s+|home\s*-\s*)/i, "")
        .trim();
    }
    if (!brandName || brandName.length > 40) {
      const h = parsedUrl.hostname.replace(/^www\./, "").split(".")[0];
      brandName = h ? h.charAt(0).toUpperCase() + h.slice(1) : "Our Business";
    }

    const combinedContent = [targetUrl, title, description, ogDesc, headings.join(" "), navLinks.join(" ")].join(" ");
    const detectedIndustry = detectIndustryFromText(combinedContent);

    const offerPatterns = [/(?:use promo code|use code|promo code|coupon code|discount code)\s*:?\s*["']?([A-Z0-9_-]{3,15})["']?[^<.,\n]{0,60}/i, /(?:flat|get|upto|up to)?\s*(\d{1,2}%\s*(?:off|discount)[^<.,\n]{0,50})/i, /(free\s+shipping\s*(?:on orders above|on orders over|worldwide|across india)?[^<.,\n]{0,35})/i, /(buy\s+\d+\s+get\s+\d+[^<.,\n]{0,40})/i, /(special\s+festive\s+offer[^<.,\n]{0,50})/i];
    let detectedOffer = "";
    const snippet = html.slice(0, 30000) + " " + description;
    for (let i = 0; i < offerPatterns.length; i++) {
      const m = snippet.match(offerPatterns[i]);
      if (m) {
        detectedOffer = m[0]
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim();
        break;
      }
    }

    const servicesSnippet = Array.from(new Set(headings.slice(0, 5).concat(navLinks.slice(0, 5)))).join(", ");
    const metaInfo = description || ogDesc || "";
    const suggestedPrompt = "Create an automated WhatsApp bot for " + brandName + '. About the business: "' + metaInfo + '". Main sections: ' + (servicesSnippet || "products, services, support") + ". The bot should welcome visitors, show each offering with its own details, " + "let people order/book/enquire, and connect them with a human when needed.";

    return {
      url: targetUrl,
      brandName: brandName,
      detectedIndustry: detectedIndustry,
      detectedOffer: detectedOffer,
      title: title.slice(0, 150),
      description: (description || ogDesc).slice(0, 300),
      headings: headings.slice(0, 8),
      navLinks: navLinks.slice(0, 10),
      suggestedPrompt: suggestedPrompt,
    };
  } catch (err) {
    logger.warn("Website scrape failed for " + targetUrl + ": " + err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SANITIZE, REPAIR & VALIDATE  (this is what fixes "every button gives the same reply")
// ─────────────────────────────────────────────────────────────────────────────
function inferTarget(opt, node, nodes, welcome, handoff) {
  const t = norm(opt.title);
  if (welcome && /^(main menu|menu|home|back|back to menu|main)$|main menu|back to (menu|main)|मुख्य मेनू|મુખ્ય મેનુ/.test(t)) return welcome.id;
  if (handoff && /(expert|agent|human|talk to|specialist|support|विशेषज्ञ|નિષ્ણાત)/.test(t)) return handoff.id;

  const words = t.split(" ").filter(function (w) {
    return w.length >= 3;
  });
  let best = null;
  nodes.forEach(function (n) {
    if (n.id === node.id || (welcome && n.id === welcome.id) || (handoff && n.id === handoff.id)) return;
    const hay = norm(n.id + " " + String((n.data && n.data.message && n.data.message.text) || "").slice(0, 80));
    const score = words.reduce(function (acc, w) {
      return acc + (hay.indexOf(w) !== -1 ? 1 : 0);
    }, 0);
    if (score > 0 && (!best || score > best.score)) best = { id: n.id, score: score };
  });
  return best ? best.id : null;
}

// Makes sure EVERY button / list row has its OWN edge, labelled with its id + title + number.
function repairEdges(nodes) {
  const welcome =
    nodes.find(function (n) {
      return /welcome|start/i.test(n.id);
    }) || nodes[0];
  const handoff = nodes.find(function (n) {
    return n.type === "handoff";
  });

  nodes.forEach(function (node) {
    const opts = getOptions(node);
    const old = Array.isArray(node.edges) ? node.edges : [];

    if (!opts.length) {
      node.edges = old.map(function (e) {
        return { targetNodeId: e.targetNodeId, label: e.label && e.label !== "" ? e.label : "default" };
      });
      return;
    }

    const used = new Set();
    const out = [];
    opts.forEach(function (o, i) {
      let e = old.find(function (x) {
        return !used.has(x) && edgeMatchesOpt(x, o);
      });
      if (
        !e &&
        old.length === opts.length &&
        old[i] &&
        !used.has(old[i]) &&
        !opts.some(function (p) {
          return p !== o && edgeMatchesOpt(old[i], p);
        })
      ) {
        e = old[i]; // positional match only when counts line up and edge is unlabelled for others
      }
      let target = e ? e.targetNodeId : null;
      if (!target) {
        const spare = old.find(function (x) {
          return (
            !used.has(x) &&
            !opts.some(function (p) {
              return edgeMatchesOpt(x, p);
            })
          );
        });
        if (spare) {
          e = spare;
          target = spare.targetNodeId;
        }
      }
      if (!target) target = inferTarget(o, node, nodes, welcome, handoff);
      if (!target) {
        logger.warn('Bot repair: option "' + o.title + '" in node "' + node.id + '" had no target; routing to menu');
        target = welcome ? welcome.id : node.id;
      }
      if (e) used.add(e);
      out.push({ targetNodeId: target, label: labelFor(o.id, o.title, i) });
    });

    // keep extra keyword shortcut edges, but NEVER keep catch-all edges on button nodes
    old.forEach(function (x) {
      const lbl = norm(x.label);
      if (!used.has(x) && lbl && lbl !== "default") out.push(x);
    });
    node.edges = out;
  });
}

function validateFlow(nodes) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(nodes) || nodes.length < 4) {
    errors.push("Flow has fewer than 4 nodes");
    return { errors: errors, warnings: warnings };
  }

  const ids = new Set(
    nodes.map(function (n) {
      return n.id;
    }),
  );
  const start =
    nodes.find(function (n) {
      return /welcome|start/i.test(n.id);
    }) || nodes[0];

  // reachability
  const seen = new Set([start.id]);
  const queue = [start.id];
  while (queue.length) {
    const curId = queue.shift();
    const cur = nodes.find(function (n) {
      return n.id === curId;
    });
    ((cur && cur.edges) || []).forEach(function (e) {
      if (ids.has(e.targetNodeId) && !seen.has(e.targetNodeId)) {
        seen.add(e.targetNodeId);
        queue.push(e.targetNodeId);
      }
    });
  }
  const unreachable = nodes
    .filter(function (n) {
      return !seen.has(n.id);
    })
    .map(function (n) {
      return n.id;
    });
  if (unreachable.length >= 2) errors.push("Unreachable nodes: " + unreachable.join(", "));
  else if (unreachable.length === 1) warnings.push("Unreachable node: " + unreachable[0]);

  let hasMenu = false;
  nodes.forEach(function (n) {
    const opts = getOptions(n);
    if (opts.length) hasMenu = true;
    if (n.type === "message" && opts.length === 0 && (!n.edges || n.edges.length === 0) && !/handoff/.test(n.type)) {
      warnings.push("Dead end: " + n.id);
    }
    if (opts.length > LIST_ROW_MAX) errors.push(n.id + " has more than " + LIST_ROW_MAX + " options");
    if (n.data && n.data.message && Array.isArray(n.data.message.buttons) && n.data.message.buttons.length > BTN_LIMIT) errors.push(n.id + " has more than 3 buttons");
    opts.forEach(function (o) {
      if (
        !(n.edges || []).some(function (e) {
          return edgeMatchesOpt(e, o);
        })
      )
        errors.push('No edge for "' + o.title + '" in ' + n.id);
      if (o.title && Array.from(String(o.title)).length > ROW_TITLE_MAX) errors.push("Title too long in " + n.id + ": " + o.title);
    });
    if (
      opts.length > 1 &&
      (n.edges || []).some(function (e) {
        return norm(e.label) === "default";
      })
    ) {
      errors.push(n.id + ' has a catch-all "default" edge next to buttons');
    }
  });
  if (!hasMenu) errors.push("No node with buttons or list options");

  // every menu item the customer can open must give them a next step (buttons)
  const byId = {};
  nodes.forEach(function (n) {
    byId[n.id] = n;
  });
  (start.edges || []).forEach(function (e) {
    const tn = byId[e.targetNodeId];
    if (!tn || tn.type === "handoff" || /name|input|ask/.test(tn.id)) return;
    if (getOptions(tn).length < 2) errors.push('Menu item "' + tn.id + '" has no buttons, so the customer cannot choose a next step');
  });
  // an order summary must ask for confirmation with buttons
  nodes.forEach(function (n) {
    const tx = String((n.data && n.data.message && n.data.message.text) || "");
    if (getOptions(n).length === 0 && /confirm your order/i.test(tx)) errors.push('Order summary "' + n.id + '" has no Confirm/Edit/Cancel buttons');
  });

  // welcome must not send every option to the same place
  const wOpts = getOptions(start);
  if (wOpts.length > 2) {
    const targets = new Set(
      (start.edges || []).map(function (e) {
        return e.targetNodeId;
      }),
    );
    if (targets.size < 2) errors.push("Welcome options all lead to the same node");
  }
  return { errors: errors, warnings: warnings };
}

function sanitizeAndLayoutFlow(nodes, businessName) {
  businessName = businessName || "Our Business";
  if (!Array.isArray(nodes) || nodes.length === 0) return [];

  // 1. unique ids
  const seenIds = new Set();
  nodes = nodes.map(function (n, i) {
    let id = n.id || "node_" + (i + 1);
    while (seenIds.has(id)) id = id + "_" + (i + 1);
    seenIds.add(id);
    return Object.assign({}, n, { id: id });
  });
  const nodeMap = new Set(
    nodes.map(function (n) {
      return n.id;
    }),
  );
  let detailCardIndex = 0;

  const processed = nodes.map(function (node, index) {
    const nodeId = node.id;
    const nodeData = node.data || {};
    const msg = nodeData.message || {};
    const id = nodeId.toLowerCase();

    const rawEdges = Array.isArray(node.edges) ? node.edges : Array.isArray(nodeData.edges) ? nodeData.edges : [];
    const validEdges = rawEdges
      .map(function (e) {
        return e && { targetNodeId: e.targetNodeId || e.target || e.to || e.next, label: String(e.label || e.button || e.title || e.text || e.name || "").trim() };
      })
      .filter(function (e) {
        return e && e.targetNodeId && nodeMap.has(e.targetNodeId);
      });

    let rawButtons = msg.buttons || msg.options || msg.quickReplies || msg.quick_replies || nodeData.buttons || nodeData.options || node.buttons;
    const rawSections = msg.sections || nodeData.sections || node.sections;
    const hasSections = Array.isArray(rawSections) && rawSections.length > 0;

    // AI sometimes writes the options ONLY as edge labels, so the customer never sees buttons.
    if (!(Array.isArray(rawButtons) && rawButtons.length) && !hasSections && !/handoff|agent|human/.test(id)) {
      const firsts = [];
      validEdges.forEach(function (e) {
        const first = String(e.label || "")
          .split(",")[0]
          .trim();
        if (
          first &&
          norm(first) &&
          norm(first) !== "default" &&
          !firsts.some(function (x) {
            return norm(x) === norm(first);
          })
        )
          firsts.push(first);
      });
      if (firsts.length >= 2 && firsts.length <= LIST_ROW_MAX) {
        rawButtons = firsts.map(function (t, i) {
          return { id: "opt_" + nodeId + "_" + (i + 1), title: t };
        });
      }
    }
    const hasButtons = Array.isArray(rawButtons) && rawButtons.length > 0;

    let nodeType = node.type || "message";
    if (id.indexOf("handoff") !== -1 || id.indexOf("agent") !== -1 || id.indexOf("human") !== -1) {
      nodeType = "handoff";
    } else if (hasButtons || hasSections || /welcome|menu|question|ask|lead_name|lead_phone|lead_email|input/.test(id)) {
      nodeType = "question";
    } else if (!["question", "message", "handoff"].includes(nodeType)) {
      nodeType = "message";
    }

    let pos = node.position || {};
    if (!pos.x || !pos.y) {
      if (index === 0 || /welcome|start/.test(id)) pos = { x: 500, y: 50 };
      else if (/handoff|agent/.test(id)) pos = { x: 950, y: 350 };
      else if (/lead_name|user_name/.test(id)) pos = { x: 500, y: 950 };
      else if (/lead_phone|user_phone/.test(id)) pos = { x: 500, y: 1250 };
      else if (id.indexOf("email") !== -1) pos = { x: 500, y: 1550 };
      else if (/confirm|thank|success/.test(id)) pos = { x: 500, y: 1850 };
      else {
        const col = detailCardIndex % 3;
        const row = Math.floor(detailCardIndex / 3);
        pos = { x: 100 + col * 400, y: 350 + row * 300 };
        detailCardIndex++;
      }
    }

    let textContent = String(msg.text || msg.body || msg.bodyText || msg.content || msg.caption || nodeData.text || nodeData.body || nodeData.content || nodeData.prompt || node.text || node.body || "").trim();
    if (!textContent) {
      if (index === 0 || /welcome|start/.test(id)) textContent = "👋 Welcome to *" + businessName + "*!\n\nHow can we help you today? Please choose an option below:";
      else if (id.indexOf("size") !== -1) textContent = "📏 Which size do you need?";
      else if (id.indexOf("payment") !== -1) textContent = "💰 How would you like to pay?";
      else if (hasSections) textContent = "Please select an option from the list below:";
      else if (nodeType === "handoff") textContent = "⚡ Connecting you with a live specialist from *" + businessName + "*! Please hold on.";
      else if (id.indexOf("name") !== -1) textContent = "✍️ Please enter your full name:";
      else if (/phone|contact/.test(id)) textContent = "📱 Please share your WhatsApp number:";
      else if (id.indexOf("email") !== -1) textContent = "📧 Please share your email address:";
      else if (/confirm|thank/.test(id)) textContent = "✅ Thank you! Your details have been received. A team member from *" + businessName + "* will contact you shortly. 🌟";
      else if (nodeType === "question") textContent = "Please select an option below or reply:";
      else textContent = "Welcome to *" + businessName + "*! How can we assist you today?";
    }

    let varName = nodeData.variable || node.variable;
    if (nodeType === "question" && (!varName || !String(varName).trim())) {
      varName = nodeId.replace(/^node_/, "") || "user_input_" + (index + 1);
    }

    // buttons: max 3 with <=20 char titles. 4+ options automatically become a LIST message.
    let sanitizedButtons = null;
    let sanitizedSections = null;
    if (hasButtons) {
      const normalized = rawButtons.slice(0, LIST_ROW_MAX).map(function (b, bi) {
        const val = typeof b === "string" ? b : b.title || b.text || b.label || "Option " + (bi + 1);
        return { id: typeof b === "object" && b.id ? b.id : "btn_" + nodeId + "_" + (bi + 1), title: String(val), desc: (typeof b === "object" && b.description) || "" };
      });
      if (normalized.length <= BTN_LIMIT) {
        sanitizedButtons = normalized.map(function (b) {
          return { id: b.id, text: clip(b.title, BTN_TITLE_MAX), title: clip(b.title, BTN_TITLE_MAX) };
        });
      } else {
        sanitizedSections = [
          {
            title: "Options",
            rows: normalized.map(function (b) {
              return { id: b.id, title: clip(b.title, ROW_TITLE_MAX), description: clip(b.desc, ROW_DESC_MAX) };
            }),
          },
        ];
      }
    } else if (hasSections) {
      sanitizedSections = rawSections.map(function (sec) {
        return {
          title: clip(sec.title || "Options", ROW_TITLE_MAX),
          rows: (Array.isArray(sec.rows) ? sec.rows : []).map(function (r, ri) {
            return { id: r.id || "row_" + nodeId + "_" + (ri + 1), title: clip(r.title || r.text || "Option " + (ri + 1), ROW_TITLE_MAX), description: clip(r.description || r.subtitle || "", ROW_DESC_MAX) };
          }),
        };
      });
      let total = 0;
      sanitizedSections.forEach(function (s) {
        s.rows = s.rows.slice(0, Math.max(0, LIST_ROW_MAX - total));
        total += s.rows.length;
      });
    }

    const messageType = sanitizedSections ? "list" : sanitizedButtons ? "buttons" : msg.type === "buttons" || msg.type === "list" ? "text" : msg.type || "text";
    const newMsg = Object.assign({}, msg, { type: messageType, text: textContent, body: textContent, buttons: sanitizedButtons || undefined, sections: sanitizedSections || undefined });
    if (sanitizedSections && !newMsg.buttonText) newMsg.buttonText = "📋 View Options";

    return Object.assign({}, node, {
      id: nodeId,
      type: nodeType,
      position: pos,
      data: Object.assign({}, nodeData, {
        nodeType: nodeType,
        variable: varName,
        action: nodeData.action || (nodeType === "handoff" ? "assign_agent" : undefined),
        actionType: nodeData.actionType || (nodeType === "handoff" ? "human_takeover" : undefined),
        crmSync: nodeData.crmSync || (/confirm|thank|success/.test(id) ? true : undefined),
        message: newMsg,
      }),
      edges: validEdges,
    });
  });

  const welcome =
    processed.find(function (n) {
      return /welcome|start/i.test(n.id);
    }) || processed[0];

  // dangling lead nodes -> confirmation
  const hasConfirmation = processed.some(function (n) {
    return /confirm|thank|success/.test(n.id);
  });
  const danglingLead = processed.filter(function (n) {
    return n.type === "question" && (!n.edges || n.edges.length === 0) && getOptions(n).length === 0 && /phone|email/.test(n.id);
  });
  if (danglingLead.length > 0 && !hasConfirmation) {
    const maxY = Math.max.apply(
      null,
      processed.map(function (n) {
        return (n.position && n.position.y) || 0;
      }),
    );
    const confirmText = "✅ *Thank you, {{user_full_name}}!*\n\nYour details have been received. A team member from *" + businessName + "* will contact you shortly. 🌟";
    processed.push({
      id: "node_confirmation",
      type: "message",
      position: { x: 500, y: maxY + 280 },
      data: {
        nodeType: "message",
        crmSync: true,
        notifyOwner: true,
        capturedVariables: ["user_full_name", "user_phone_number"],
        message: { type: "buttons", text: confirmText, body: confirmText, buttons: [{ id: "btn_conf_menu", text: "🏠 Main Menu", title: "🏠 Main Menu" }] },
      },
      edges: [],
    });
    danglingLead.forEach(function (n) {
      n.edges = [{ targetNodeId: "node_confirmation", label: "default" }];
    });
  } else if (danglingLead.length > 0) {
    const existing = processed.find(function (n) {
      return /confirm|thank|success/.test(n.id);
    });
    if (existing)
      danglingLead.forEach(function (n) {
        n.edges = [{ targetNodeId: existing.id, label: "default" }];
      });
  }

  // confirmation / handoff nodes must always offer a way back to the menu
  processed.forEach(function (n) {
    if ((n.type === "handoff" || /confirm|thank|success|handoff|cancel/.test(n.id.toLowerCase())) && getOptions(n).length === 0 && (!n.edges || n.edges.length === 0) && welcome && n.id !== welcome.id) {
      n.data.message.type = "buttons";
      n.data.message.buttons = [{ id: "btn_" + n.id + "_menu", text: "🏠 Main Menu", title: "🏠 Main Menu" }];
    }
  });

  repairEdges(processed);
  return processed;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSLATIONS for the built-in blueprint (UI text only; the AI path translates everything)
// ─────────────────────────────────────────────────────────────────────────────
const I18N = {
  en: {
    welcome: function (e, b) {
      return e + " Welcome to *" + b + "*!";
    },
    help: "How can we help you today?",
    select: "*Please choose an option below:*",
    menuTitle: "Menu",
    viewMenu: "📋 View Menu",
    mainMenu: "🏠 Main Menu",
    expert: "💬 Talk to Expert",
    expertDesc: "Chat with our team",
    about: "ℹ️ About & Contact",
    aboutDesc: "Address, timings, contact",
    offers: "🎁 Special Offers",
    offersDesc: "Current deals",
    footer: "Tap the button below to continue, or talk to our team for prices and availability.",
    askName: "✍️ Please enter your full name:",
    phone: "🙏 Thank you, *{{user_full_name}}*!\n\n📱 We have your WhatsApp number (*{{phone}}*).\n\nTap *Same Number* to confirm, or type a different number:",
    samePhone: "📱 Same Number",
    confirm: function (b) {
      return "✅ *Thank you, {{user_full_name}}!*\n\nYour request has been received. A team member from *" + b + "* will contact you at *{{user_phone_number}}* shortly. 🌟";
    },
    handoff: function (b) {
      return "⚡ Connecting you with a team member from *" + b + "*. Please hold on, someone will join this chat shortly.";
    },
    noDetails: "For our address, timings and contact details, tap *Talk to Expert* and our team will help you right away.",
    aboutHead: function (b) {
      return "ℹ️ *About " + b + "*";
    },
  },
  hi: {
    welcome: function (e, b) {
      return e + " *" + b + "* में आपका हार्दिक स्वागत है!";
    },
    help: "आज हम आपकी क्या सहायता कर सकते हैं?",
    select: "*नीचे से एक विकल्प चुनें:*",
    menuTitle: "मेनू",
    viewMenu: "📋 मेनू देखें",
    mainMenu: "🏠 मुख्य मेनू",
    expert: "💬 विशेषज्ञ से बात",
    expertDesc: "हमारी टीम से चैट",
    about: "ℹ️ जानकारी और संपर्क",
    aboutDesc: "पता, समय, संपर्क",
    offers: "🎁 विशेष ऑफर",
    offersDesc: "चालू ऑफर",
    footer: "आगे बढ़ने के लिए नीचे बटन दबाएँ, या कीमत और उपलब्धता के लिए हमारी टीम से बात करें।",
    askName: "✍️ कृपया अपना पूरा नाम लिखें:",
    phone: "🙏 धन्यवाद, *{{user_full_name}}*!\n\n📱 आपका WhatsApp नंबर (*{{phone}}*) हमारे पास है।\n\nपुष्टि के लिए *यही नंबर* दबाएँ, या दूसरा नंबर लिखें:",
    samePhone: "📱 यही नंबर",
    confirm: function (b) {
      return "✅ *धन्यवाद, {{user_full_name}}!*\n\nआपका अनुरोध मिल गया है। *" + b + "* की टीम जल्द ही *{{user_phone_number}}* पर आपसे संपर्क करेगी। 🌟";
    },
    handoff: function (b) {
      return "⚡ *" + b + "* की टीम का सदस्य जल्द ही आपसे जुड़ेगा। कृपया प्रतीक्षा करें।";
    },
    noDetails: "हमारा पता, समय और संपर्क जानने के लिए *विशेषज्ञ से बात* दबाएँ।",
    aboutHead: function (b) {
      return "ℹ️ *" + b + "* के बारे में";
    },
  },
  gu: {
    welcome: function (e, b) {
      return e + " *" + b + "* માં આપનું હાર્દિક સ્વાગત છે!";
    },
    help: "આજે અમે આપને કેવી રીતે મદદ કરી શકીએ?",
    select: "*નીચેથી એક વિકલ્પ પસંદ કરો:*",
    menuTitle: "મેનુ",
    viewMenu: "📋 મેનુ જુઓ",
    mainMenu: "🏠 મુખ્ય મેનુ",
    expert: "💬 નિષ્ણાત સાથે વાત",
    expertDesc: "અમારી ટીમ સાથે ચેટ",
    about: "ℹ️ માહિતી અને સંપર્ક",
    aboutDesc: "સરનામું, સમય, સંપર્ક",
    offers: "🎁 ખાસ ઑફર",
    offersDesc: "ચાલુ ઑફર",
    footer: "આગળ વધવા માટે નીચે બટન દબાવો, અથવા કિંમત અને ઉપલબ્ધતા માટે અમારી ટીમ સાથે વાત કરો.",
    askName: "✍️ કૃપા કરીને તમારું પૂરું નામ લખો:",
    phone: "🙏 આભાર, *{{user_full_name}}*!\n\n📱 તમારો WhatsApp નંબર (*{{phone}}*) અમારી પાસે છે.\n\nપુષ્ટિ માટે *આ જ નંબર* દબાવો, અથવા બીજો નંબર લખો:",
    samePhone: "📱 આ જ નંબર",
    confirm: function (b) {
      return "✅ *આભાર, {{user_full_name}}!*\n\nતમારી વિનંતી મળી ગઈ છે. *" + b + "* ની ટીમ ટૂંક સમયમાં *{{user_phone_number}}* પર તમારો સંપર્ક કરશે. 🌟";
    },
    handoff: function (b) {
      return "⚡ *" + b + "* ની ટીમનો સભ્ય ટૂંક સમયમાં આપની સાથે જોડાશે. કૃપા કરીને રાહ જુઓ.";
    },
    noDetails: "અમારું સરનામું, સમય અને સંપર્ક વિગતો માટે *નિષ્ણાત સાથે વાત* દબાવો.",
    aboutHead: function (b) {
      return "ℹ️ *" + b + "* વિશે";
    },
  },
};

function getLang(language) {
  const l = String(language || "").toLowerCase();
  if (/gujarati|ગુજરાતી/.test(l)) return "gu";
  if (/hindi|हिन्दी|हिंदी/.test(l)) return "hi";
  return "en";
}

// ─────────────────────────────────────────────────────────────────────────────
// INDUSTRY BLUEPRINTS  (no invented prices, addresses or phone numbers)
// items: [emoji, title, description]
// ─────────────────────────────────────────────────────────────────────────────
const INDUSTRY = {
  fashion: {
    e: "👗",
    cta: "🛍️ Order Now",
    order: true,
    sub: "Discover our latest collections, new arrivals and easy ordering right here on WhatsApp!",
    extra: "🛒 Which product(s) and quantity would you like?",
    items: [
      ["👗", "Kurtis & Suits", "Everyday, office and festive kurtis, suit sets and dupatta combinations in a range of fabrics and prints."],
      ["🥻", "Sarees", "Silk, cotton, georgette and party-wear sarees with matching blouse options."],
      ["💃", "Lehengas", "Festive and wedding lehengas with rich embroidery and detailed work."],
      ["👰", "Gowns & Dresses", "Elegant gowns, party dresses and indo-western outfits for every occasion."],
      ["👚", "Western Wear", "Tops, co-ord sets and casual western styles for everyday wear."],
      ["🆕", "New Arrivals", "Our freshest designs, added regularly. Be the first to see what is new."],
    ],
  },
  media: {
    e: "🎬",
    cta: "💎 Upgrade Now",
    sub: "Explore trending content, creator tools, premium plans and instant support!",
    extra: "📝 Tell us briefly how we can help (subscription / creator / support):",
    items: [
      ["🔥", "Trending Now", "Popular videos, shows, music and live streams that people are watching right now."],
      ["💎", "Premium Plans", "Ad-free viewing, downloads and exclusive content with our premium membership."],
      ["🎥", "Creator Tools", "Upload, analytics and monetisation tools to grow your channel and audience."],
      ["🛡️", "Help & Copyright", "Account help, copyright claims, safety and community guideline support."],
    ],
  },
  fitness: {
    e: "🏋️",
    cta: "🎟️ Book Free Trial",
    sub: "Transform your fitness with certified trainers, modern equipment and personalised plans!",
    extra: "🕒 Which day and time would you like to visit?",
    items: [
      ["💪", "Membership Plans", "Monthly, quarterly and annual memberships to suit your goals and budget."],
      ["🏋️", "Personal Training", "One-to-one coaching with certified trainers for strength, weight loss or muscle gain."],
      ["🧘", "Group Classes", "Yoga, Zumba, cardio and functional training in energetic group sessions."],
      ["🥗", "Diet & Nutrition", "Customised diet guidance to support your workout results."],
    ],
  },
  healthcare: {
    e: "🏥",
    cta: "📅 Book Appointment",
    sub: "Caring, expert healthcare from qualified doctors and specialists.",
    extra: "📅 Preferred date & time for the appointment, and a short note on the concern:",
    items: [
      ["🩺", "General Medicine", "Consultation, check-ups and treatment for common and chronic conditions."],
      ["🦷", "Dental Care", "Check-ups, cleaning, fillings, braces and complete dental treatments."],
      ["👶", "Child Care", "Child health, vaccinations and growth monitoring by paediatric specialists."],
      ["🦴", "Ortho & Joint Care", "Bone, joint and mobility care, including injury and pain management."],
      ["🔬", "Lab & Diagnostics", "Blood tests, X-ray and other diagnostics with quick, reliable reports."],
    ],
  },
  restaurant: {
    e: "🍽️",
    cta: "📅 Book a Table",
    sub: "Freshly prepared food, warm hospitality and an unforgettable dining experience!",
    extra: "📅 Date, time and number of guests (or your order details):",
    items: [
      ["🍽️", "Food Menu", "Starters, mains, breads and rice, freshly prepared by our chefs."],
      ["🍰", "Desserts & Drinks", "Desserts, beverages, shakes and mocktails to complete your meal."],
      ["🥘", "Todays Specials", "Chef specials and seasonal dishes available for a limited time."],
      ["🎉", "Party & Catering", "Birthday, family and corporate events with custom menus and catering."],
    ],
  },
  realestate: {
    e: "🏢",
    cta: "🚗 Book Site Visit",
    sub: "Find your ideal apartment, villa or commercial space with expert guidance!",
    extra: "🏠 Which property type and budget are you looking for, and your preferred visit date?",
    items: [
      ["🏠", "Apartments", "Well-planned apartments in prime locations with modern amenities."],
      ["🏡", "Villas & Row Houses", "Independent villas and row houses for comfortable family living."],
      ["🏢", "Commercial Spaces", "Offices and shops in high-visibility business locations."],
      ["🏦", "Home Loan & EMI", "Guidance on home loans, eligibility and EMI planning."],
    ],
  },
  retail: {
    e: "🛍️",
    cta: "🛒 Place Order",
    sub: "Shop our collections, exclusive deals and enjoy easy ordering on WhatsApp!",
    extra: "🛒 Which product(s) and quantity would you like?",
    items: [
      ["✨", "Browse Collections", "Explore our full range of products across categories."],
      ["🔥", "Best Sellers", "Our most loved products, chosen by customers like you."],
      ["🎁", "Gift Hampers", "Beautifully packed gifts for every occasion."],
      ["📦", "Orders & Shipping", "Order tracking, delivery timelines and shipping details."],
      ["🔄", "Returns & Exchange", "Help with returns, exchanges and replacements."],
    ],
  },
  it: {
    e: "🚀",
    cta: "💡 Get Free Quote",
    sub: "Your trusted technology partner for web, mobile, AI automation and digital growth!",
    extra: "💡 Please describe your project or requirement briefly:",
    items: [
      ["🌐", "Web Development", "Business websites, e-commerce stores and web applications built to convert."],
      ["📱", "Mobile Apps", "Android and iOS apps with smooth design and reliable performance."],
      ["🤖", "AI & Automation", "WhatsApp bots, CRM integration and workflow automation for your business."],
      ["📈", "Digital Marketing", "SEO, social media and performance marketing to grow your reach."],
      ["☁️", "Cloud & Support", "Hosting, maintenance and ongoing technical support."],
    ],
  },
  education: {
    e: "🎓",
    cta: "🎟️ Book Demo Class",
    sub: "Build your career with expert faculty, practical learning and placement guidance!",
    extra: "📚 Which course are you interested in?",
    items: [
      ["📚", "Courses", "Industry-focused courses with practical projects and certification."],
      ["👥", "Batches & Timings", "Weekday, weekend and flexible batches to fit your schedule."],
      ["💼", "Placement Support", "Resume building, interview preparation and job guidance."],
      ["💳", "Fees & Scholarships", "Course fees, instalment options and scholarship details."],
    ],
  },
  travel: {
    e: "✈️",
    cta: "📋 Get Free Quote",
    sub: "Curated holidays, flights, hotels and hassle-free visa assistance!",
    extra: "🧳 Destination, travel dates and number of travellers?",
    items: [
      ["🗺️", "Tour Packages", "Domestic and international packages with hotels, sightseeing and transfers."],
      ["🛂", "Visa Assistance", "Documentation guidance and application support for popular destinations."],
      ["🏨", "Hotels & Flights", "Best-fit hotel stays and flight bookings for your trip."],
      ["🧳", "Custom Itinerary", "A trip planned around your dates, budget and interests."],
    ],
  },
  salon: {
    e: "💇‍♀️",
    cta: "📅 Book Slot",
    sub: "Pamper yourself with expert hair, skin, makeup and spa services!",
    extra: "💇 Which service would you like, and your preferred date & time?",
    items: [
      ["✂️", "Hair Services", "Cuts, colour, spa and smoothing treatments by experienced stylists."],
      ["💆", "Skin & Facials", "Facials, cleanups and skin treatments for a healthy glow."],
      ["👰", "Bridal & Makeup", "Bridal, party and occasion makeup with a personalised look."],
      ["💅", "Nails & Spa", "Manicure, pedicure, nail art and relaxing spa therapies."],
    ],
  },
  finance: {
    e: "💼",
    cta: "📞 Get Callback",
    sub: "Smart financial solutions for loans, insurance, investments and tax planning!",
    extra: "💼 Which product are you interested in (loan / insurance / investment)?",
    items: [
      ["💰", "Loans", "Personal, home and business loan guidance with eligibility support."],
      ["🛡️", "Insurance", "Life, health and vehicle insurance plans matched to your needs."],
      ["📈", "Investments & SIP", "Mutual funds, SIP and long-term wealth planning."],
      ["🧾", "Tax & Accounting", "Tax filing, GST and accounting support for individuals and businesses."],
    ],
  },
  auto: {
    e: "🚗",
    cta: "📅 Book Service",
    sub: "Reliable servicing, repairs and care for your vehicle!",
    extra: "🚗 Please share your vehicle model and the service you need:",
    items: [
      ["🔧", "Service & Repair", "Regular servicing, repairs and diagnostics by skilled mechanics."],
      ["🚿", "Wash & Detailing", "Car wash, polishing and interior and exterior detailing."],
      ["🛞", "Tyres & Batteries", "Tyre replacement, alignment, balancing and battery service."],
      ["📋", "Insurance & Papers", "Help with insurance claims and vehicle paperwork."],
    ],
  },
  legal: {
    e: "⚖️",
    cta: "📅 Book Consultation",
    sub: "Trusted legal guidance and representation for individuals and businesses.",
    extra: "⚖️ Please describe your legal matter briefly:",
    items: [
      ["⚖️", "Practice Areas", "Civil, criminal, family, property and corporate legal matters."],
      ["📄", "Documentation", "Agreements, notices, affidavits and other legal documents."],
      ["🏢", "Business & Compliance", "Company registration, contracts and regulatory compliance."],
      ["👨‍⚖️", "Consult a Lawyer", "Discuss your case with an experienced advocate."],
    ],
  },
  events: {
    e: "🎉",
    cta: "📋 Get Free Quote",
    sub: "Making your weddings, parties and corporate events truly memorable!",
    extra: "🎉 Event type, date and approximate number of guests?",
    items: [
      ["💍", "Wedding Planning", "End-to-end wedding planning, vendors and coordination."],
      ["🎂", "Birthday & Parties", "Themed birthdays, anniversaries and private celebrations."],
      ["📸", "Photo & Video", "Professional photography and videography for your events."],
      ["🎨", "Decor & Catering", "Stage, floral decor and catering tailored to your event."],
    ],
  },
  general: {
    e: "👋",
    cta: "📋 Request Quote",
    sub: "We are happy to help. Choose an option below to get started.",
    extra: "📝 Please describe your requirement briefly:",
    items: [
      ["🔍", "Our Services", "Everything we offer, explained clearly so you can choose what suits you."],
      ["⭐", "Why Choose Us", "Quality, reliability and dedicated customer support."],
      ["❓", "FAQs", "Quick answers to the questions customers ask us most."],
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PARSE USER INPUT: menu items and contact details from the free-text prompt
// ─────────────────────────────────────────────────────────────────────────────
function extractListFromPrompt(prompt) {
  const p = String(prompt || "");
  const m = p.match(/(?:categories|category|collections?|services|products|menu|courses|packages|departments|plans)\s*(?:are|include|includes|:|-)\s*([^\n.]{3,300})/i);
  if (!m) return [];
  let parts = m[1].split(/[,;|•]/);
  if (parts.length === 1) parts = m[1].split(/\s+and\s+/i);
  const out = [];
  parts.forEach(function (s) {
    const v = s
      .replace(/^(and|&)\s+/i, "")
      .replace(/[()"']/g, "")
      .trim();
    if (v.length >= 2 && v.length <= 30 && out.indexOf(v) === -1) out.push(v);
  });
  return out.length >= 2 ? out.slice(0, 6) : [];
}

function extractDetails(prompt, websiteData, explicit) {
  const p = String(prompt || "");
  const d = Object.assign({}, explicit || {});
  const ph = p.match(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/);
  if (!d.phone && ph) d.phone = ph[0].trim();
  const em = p.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (!d.email && em) d.email = em[0];
  const tm = p.match(/(?:timings?|hours|open(?:ing)?(?: hours)?)\s*[:\-]\s*([^\n]{4,80}?)(?:\.\s+[A-Z]|\n|$)/i);
  if (!d.timings && tm) d.timings = tm[1].trim();
  const ad = p.match(/address\s*[:\-]\s*([^\n]{6,140}?)(?:\.\s+[A-Z]|\n|$)/i);
  if (!d.address && ad) d.address = ad[1].trim();
  if (!d.website && websiteData && websiteData.url) d.website = websiteData.url;
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLUEPRINT BUILDER  (deterministic; every button and list row has its OWN node + edge)
// ─────────────────────────────────────────────────────────────────────────────
function btnMsg(text, opts) {
  const buttons = opts.map(function (o) {
    return { id: o.id, text: clip(o.text, BTN_TITLE_MAX), title: clip(o.text, BTN_TITLE_MAX) };
  });
  return { type: "buttons", text: text, body: text, buttons: buttons };
}
function listMsg(text, btnLabel, sectionTitle, opts) {
  return {
    type: "list",
    text: text,
    body: text,
    buttonText: clip(btnLabel, BTN_TITLE_MAX),
    sections: [
      {
        title: clip(sectionTitle, ROW_TITLE_MAX),
        rows: opts.map(function (o) {
          return { id: o.id, title: clip(o.text, ROW_TITLE_MAX), description: clip(o.desc || "", ROW_DESC_MAX) };
        }),
      },
    ],
  };
}
function edgesFor(opts) {
  return opts.map(function (o, i) {
    return { targetNodeId: o.to, label: labelFor(o.id, o.text, i) };
  });
}
function mkNode(id, type, x, y, data, edges) {
  return { id: id, type: type, position: { x: x, y: y }, data: data, edges: edges || [] };
}

function buildBlueprint(ctx) {
  const bName = ctx.bName,
    cfg = ctx.cfg,
    t = ctx.t,
    lang = ctx.lang,
    details = ctx.details || {},
    offers = ctx.offers;
  const nodes = [];

  // menu items: user's own categories win over the industry preset
  let items = cfg.items.map(function (it) {
    return { e: it[0], t: it[1], d: it[2] };
  });
  if (ctx.customItems && ctx.customItems.length) {
    items = ctx.customItems.map(function (title) {
      const nt = norm(title);
      const preset = cfg.items.find(function (p) {
        return norm(p[1])
          .split(" ")
          .some(function (w) {
            return w.length >= 4 && nt.indexOf(w.slice(0, 4)) !== -1;
          });
      });
      return {
        e: preset ? preset[0] : cfg.e,
        t: clip(title, ROW_TITLE_MAX - 3),
        d: preset ? preset[2] : "Explore our " + title + " range at " + bName + ". Tap the button below to continue, or chat with our team for details.",
      };
    });
  }
  items = items.slice(0, 6);

  const wOpts = items.map(function (it, i) {
    return { id: "row_item_" + (i + 1), text: it.e + " " + it.t, desc: it.d, to: "node_item_" + (i + 1) };
  });
  wOpts.push({ id: "row_about", text: t.about, desc: t.aboutDesc, to: "node_about" });
  if (offers) wOpts.push({ id: "row_offers", text: t.offers, desc: t.offersDesc, to: "node_offers" });
  wOpts.push({ id: "row_expert", text: t.expert, desc: t.expertDesc, to: "node_handoff" });

  const sub = lang === "en" ? cfg.sub : t.help;
  const welcomeText = t.welcome(cfg.e, bName) + "\n\n" + sub + (offers ? "\n\n🎁 *" + offers + "*" : "") + "\n\n" + t.select;
  const welcomeMsg = wOpts.length <= BTN_LIMIT ? btnMsg(welcomeText, wOpts) : listMsg(welcomeText, t.viewMenu, t.menuTitle, wOpts);
  nodes.push(mkNode("node_welcome", "question", 500, 60, { variable: "user_selected_menu", message: welcomeMsg }, edgesFor(wOpts)));

  // one dedicated info node per menu item
  const perRow = 4;
  items.forEach(function (it, i) {
    const text = it.e + " *" + it.t + "*\n\n" + it.d + "\n\n" + t.footer;
    const opts = [
      { id: "btn_cta_" + (i + 1), text: cfg.cta, to: "node_lead_name" },
      { id: "btn_menu_" + (i + 1), text: t.mainMenu, to: "node_welcome" },
      { id: "btn_expert_" + (i + 1), text: t.expert, to: "node_handoff" },
    ];
    nodes.push(mkNode("node_item_" + (i + 1), "question", 80 + (i % perRow) * 340, 360 + Math.floor(i / perRow) * 300, { variable: "item_choice_" + (i + 1), message: btnMsg(text, opts) }, edgesFor(opts)));
  });

  // about / contact (only real details the owner provided)
  const lines = [];
  if (details.address) lines.push("📍 " + details.address);
  if (details.timings) lines.push("⏰ " + details.timings);
  if (details.phone) lines.push("📞 " + details.phone);
  if (details.email) lines.push("📧 " + details.email);
  if (details.website) lines.push("🌐 " + details.website);
  const desc = ctx.websiteData && ctx.websiteData.description ? ctx.websiteData.description + "\n\n" : "";
  const aboutText = t.aboutHead(bName) + "\n\n" + desc + (lines.length ? lines.join("\n") : t.noDetails);
  const aboutOpts = [
    { id: "btn_about_cta", text: cfg.cta, to: "node_lead_name" },
    { id: "btn_about_menu", text: t.mainMenu, to: "node_welcome" },
    { id: "btn_about_expert", text: t.expert, to: "node_handoff" },
  ];
  const itemRows = Math.ceil(items.length / perRow);
  const aboutIdx = items.length;
  nodes.push(mkNode("node_about", "question", 80 + (aboutIdx % perRow) * 340, 360 + Math.floor(aboutIdx / perRow) * 300, { variable: "about_choice", message: btnMsg(aboutText, aboutOpts) }, edgesFor(aboutOpts)));

  if (offers) {
    const offOpts = [
      { id: "btn_offer_cta", text: cfg.cta, to: "node_lead_name" },
      { id: "btn_offer_menu", text: t.mainMenu, to: "node_welcome" },
      { id: "btn_offer_expert", text: t.expert, to: "node_handoff" },
    ];
    const oi = items.length + 1;
    nodes.push(mkNode("node_offers", "question", 80 + (oi % perRow) * 340, 360 + Math.floor(oi / perRow) * 300, { variable: "offer_choice", message: btnMsg("🎁 *" + t.offers.replace(/^🎁\s*/, "") + "*\n\n" + offers + "\n\n" + t.footer, offOpts) }, edgesFor(offOpts)));
  }

  // human handoff
  const hoOpts = [{ id: "btn_handoff_menu", text: t.mainMenu, to: "node_welcome" }];
  nodes.push(mkNode("node_handoff", "handoff", 1300, 360, { action: "assign_agent", actionType: "human_takeover", message: btnMsg(t.handoff(bName), hoOpts) }, edgesFor(hoOpts)));

  // lead / order flow
  const y0 = 360 + itemRows * 300 + 120;
  const menuBtn = [{ id: "btn_conf_menu", text: t.mainMenu, to: "node_welcome" }];

  if (cfg.order) {
    const sizes = ["S", "M", "L", "XL", "XXL"].map(function (s) {
      return { id: "size_" + s.toLowerCase(), text: s, desc: "Size " + s, to: "node_order_color" };
    });
    nodes.push(mkNode("node_lead_name", "question", 500, y0, { variable: "user_full_name", message: { type: "text", text: "Great choice! 🛍️ May I have your full name?", body: "Great choice! 🛍️ May I have your full name?" } }, [{ targetNodeId: "node_order_size", label: "default" }]));
    nodes.push(mkNode("node_order_size", "question", 500, y0 + 260, { variable: "order_size", message: listMsg("📏 Which size do you need?", "📏 Choose Size", "Sizes", sizes) }, edgesFor(sizes)));
    nodes.push(mkNode("node_order_color", "question", 500, y0 + 520, { variable: "order_color", message: { type: "text", text: "🎨 Which colour do you prefer?", body: "🎨 Which colour do you prefer?" } }, [{ targetNodeId: "node_order_qty", label: "default" }]));
    nodes.push(mkNode("node_order_qty", "question", 500, y0 + 780, { variable: "order_qty", message: { type: "text", text: "🔢 How many pieces would you like?", body: "🔢 How many pieces would you like?" } }, [{ targetNodeId: "node_order_address", label: "default" }]));
    nodes.push(mkNode("node_order_address", "question", 500, y0 + 1040, { variable: "order_address", message: { type: "text", text: "📍 Please share your full delivery address with pincode.", body: "📍 Please share your full delivery address with pincode." } }, [{ targetNodeId: "node_order_payment", label: "default" }]));
    const payOpts = [
      { id: "pay_upi", text: "💳 UPI", to: "node_order_summary" },
      { id: "pay_cod", text: "💵 Cash on Delivery", to: "node_order_summary" },
    ];
    nodes.push(mkNode("node_order_payment", "question", 500, y0 + 1300, { variable: "order_payment", message: btnMsg("💰 How would you like to pay?", payOpts) }, edgesFor(payOpts)));
    const sumText = "🧾 *Order Summary*\n\n👤 {{user_full_name}}\n🛍️ {{user_selected_menu}}\n📏 Size: {{order_size}}\n🎨 Colour: {{order_color}}\n🔢 Qty: {{order_qty}}\n📍 {{order_address}}\n💳 {{order_payment}}\n\nPlease confirm your order:";
    const sumOpts = [
      { id: "order_confirm", text: "✅ Confirm Order", to: "node_confirmation" },
      { id: "order_edit", text: "✏️ Edit Order", to: "node_lead_name" },
      { id: "order_cancel", text: "❌ Cancel", to: "node_order_cancelled" },
    ];
    nodes.push(mkNode("node_order_summary", "question", 500, y0 + 1560, { variable: "order_decision", message: btnMsg(sumText, sumOpts) }, edgesFor(sumOpts)));
    const okText = "🎉 *Your order is confirmed, {{user_full_name}}!*\n\nThe *" + bName + "* team will contact you on *{{phone}}* shortly with the final price and payment details. Thank you for shopping with us! 💖";
    nodes.push(mkNode("node_confirmation", "message", 500, y0 + 1820, { crmSync: true, notifyOwner: true, capturedVariables: ["user_full_name", "user_selected_menu", "order_size", "order_color", "order_qty", "order_address", "order_payment"], message: btnMsg(okText, menuBtn) }, edgesFor(menuBtn)));
    const cancelOpts = [{ id: "btn_cancel_menu", text: t.mainMenu, to: "node_welcome" }];
    nodes.push(mkNode("node_order_cancelled", "message", 900, y0 + 1820, { message: btnMsg("Your order has been cancelled. Let us know if you need anything else. 😊", cancelOpts) }, edgesFor(cancelOpts)));
  } else {
    nodes.push(mkNode("node_lead_name", "question", 500, y0, { variable: "user_full_name", message: { type: "text", text: t.askName, body: t.askName } }, [{ targetNodeId: "node_lead_extra", label: "default" }]));
    nodes.push(mkNode("node_lead_extra", "question", 500, y0 + 260, { variable: "lead_details", message: { type: "text", text: cfg.extra, body: cfg.extra } }, [{ targetNodeId: "node_lead_phone", label: "default" }]));
    const phoneOpts = [{ id: "btn_same_phone", text: t.samePhone, to: "node_confirmation" }];
    nodes.push(mkNode("node_lead_phone", "question", 500, y0 + 520, { variable: "user_phone_number", message: btnMsg(t.phone, phoneOpts) }, [{ targetNodeId: "node_confirmation", label: labelFor("btn_same_phone", t.samePhone, 0) + ", same, default" }]));
    nodes.push(mkNode("node_confirmation", "message", 500, y0 + 780, { crmSync: true, notifyOwner: true, capturedVariables: ["user_full_name", "lead_details", "user_phone_number"], message: btnMsg(t.confirm(bName), menuBtn) }, edgesFor(menuBtn)));
  }

  return {
    name: bName + " – WhatsApp Bot",
    description: "WhatsApp assistant for " + bName + ": menu, per-item details, " + (cfg.order ? "order flow" : "lead capture") + " and live-agent handoff.",
    trigger: { type: "keyword", keywords: ["hi", "hello", "hey", "start", "menu", "help", "namaste", "info"] },
    nodes: nodes,
  };
}

function generateFallbackFlow(opts) {
  opts = opts || {};
  const websiteData = opts.websiteData || null;
  const bName = String(opts.businessName || (websiteData && websiteData.brandName) || (websiteData && websiteData.title ? websiteData.title.split(/[-|–]/)[0].trim() : "") || "Our Business").trim();
  const key = resolveIndustryKey({ industry: opts.industry, businessName: bName, prompt: opts.prompt, websiteData: websiteData });
  const lang = getLang(opts.language);
  return buildBlueprint({
    bName: bName,
    cfg: INDUSTRY[key] || INDUSTRY.general,
    t: I18N[lang],
    lang: lang,
    details: extractDetails(opts.prompt, websiteData, opts.details),
    offers: opts.offers || (websiteData && websiteData.detectedOffer) || "",
    customItems: extractListFromPrompt(opts.prompt),
    websiteData: websiteData,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AI FLOW GENERATION
// ─────────────────────────────────────────────────────────────────────────────
const AI_RULES = ["WHATSAPP LIMITS (hard):", "- A reply-button message has at most 3 buttons, each title at most 20 characters.", '- 4 to 10 options MUST use a list message: data.message.type = "list", data.message.buttonText (max 20 chars), data.message.sections = [{ "title": "Menu", "rows": [{ "id": "row_x", "title": "max 24 chars", "description": "max 72 chars" }] }].', "- Never put more than 10 rows in one list.", "", "ROUTING RULES (most important):", '1. EVERY button and EVERY list row has its OWN edge. For each option add exactly one edge whose label is: "<exact option title>, <option id>, <position number starting at 1>".', '2. Different options must lead to DIFFERENT nodes with DIFFERENT replies. Only "Main Menu" (-> node_welcome), "Talk to Expert" (-> node_handoff) and shared lead-capture nodes may be shared targets.', '3. NEVER use a "default" or empty label on a node that has buttons or a list. "default" is only for free-text input nodes (name, address, quantity...).', "4. Every option id must be unique inside its node. Every edge targetNodeId must be a real node id.", "", "MESSAGE FIELDS (hard):", "- EVERY node, including list nodes, must have data.message.text AND data.message.body (the greeting / question the customer reads).", "- Buttons and list rows must be written inside data.message.buttons / data.message.sections. Never express options only through edge labels.", "- A node that shows information must end with its buttons; it must never jump to the next step on its own.", "", "CONTENT RULES:", "1. Welcome node (id node_welcome): greeting + menu of the main topics (list if 4+ topics). Do NOT ask for name or phone here.", "2. Every menu topic gets its OWN information node with real, specific details and exactly these buttons: [action CTA, Main Menu, Talk to Expert].", '3. Ask for name/phone ONLY after the user taps an action CTA (Book / Order / Quote / Claim). Flow: node_lead_name -> (optional extra questions, one per node) -> node_lead_phone (button "Same Number") -> node_confirmation (crmSync true, "Main Menu" button).', "4. For shopping / fashion / food businesses with an order flow: name -> size or item -> colour/options -> quantity -> address -> payment (buttons) -> summary (Confirm / Edit / Cancel). Use {{variables}} to show earlier answers in the summary.", '5. Include node_handoff (type "handoff", data.action "assign_agent") with a "Main Menu" button.', "6. The welcome node variable stores the selected topic; reuse it as {{user_selected_menu}} later so the bot remembers what the customer chose.", '7. NEVER invent phone numbers, addresses, prices, timings, discounts or policies. Use only the details provided by the owner; if a detail is missing, leave it out or tell the customer to tap "Talk to Expert".', "8. If the owner lists categories/services, use those names exactly. Otherwise use the suggested topics.", "9. Write all customer-facing text in the requested language. Use light emojis and *bold* for key info.", "10. Use 10 to 24 nodes. Question nodes must have data.variable.", "", "OUTPUT: ONLY valid JSON, no markdown:", '{ "name": "Bot name", "description": "One line", "trigger": { "type": "keyword", "keywords": ["hi","hello","start","menu"] },', '  "nodes": [ { "id": "node_welcome", "type": "question", "position": { "x": 500, "y": 60 },', '    "data": { "variable": "user_selected_menu", "message": { "type": "buttons|list|text", "text": "...", "body": "...", "buttons": [{ "id": "btn_x", "text": "Title", "title": "Title" }] } },', '    "edges": [ { "targetNodeId": "node_x", "label": "Title, btn_x, 1" } ] } ] }', 'Node types: "question" (buttons/list/text input), "message" (info), "handoff" (live agent).'].join("\n");

const AI_SYSTEM_PROMPT = "You are an expert WhatsApp Business chatbot architect (Meta WABA flows). You design bots that real businesses use to answer customers, take orders and capture leads. " + "Every reply must match the real business domain (a clothing store talks about collections, sizes and orders, never IT quotes).\n\n" + AI_RULES;

function extractJson(raw) {
  const cleaned = String(raw || "")
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const s = cleaned.indexOf("{"),
      en = cleaned.lastIndexOf("}");
    if (s !== -1 && en > s) return JSON.parse(cleaned.slice(s, en + 1));
    throw e;
  }
}

async function callGroq(model, messages, apiKey) {
  const body = { model: model, messages: messages, temperature: 0.2, max_tokens: 7000, response_format: { type: "json_object" } };
  if (model.indexOf("openai/gpt-oss") === 0) body.reasoning_effort = "low";
  const res = await axios.post("https://api.groq.com/openai/v1/chat/completions", body, { timeout: 45000, headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" } });
  const choice = res.data && res.data.choices && res.data.choices[0];
  if (choice && choice.finish_reason === "length") logger.warn("AI Bot Builder: " + model + " output was cut off (finish_reason=length)");
  return choice && choice.message && choice.message.content;
}

async function generateBotFlow(input) {
  input = input || {};
  const prompt = input.prompt,
    businessName = input.businessName,
    industry = input.industry;
  const websiteUrl = input.websiteUrl,
    offers = input.offers;
  const language = input.language || "English";
  logger.info('AI Bot Builder: Generating for "' + (businessName || "Business") + '" (' + (industry || "General") + ")");

  let websiteData = null;
  if (websiteUrl) {
    websiteData = await scrapeWebsite(websiteUrl);
    if (websiteData) logger.info("Scraped: " + websiteData.brandName + " | " + websiteData.detectedIndustry);
  }

  const effectiveBusiness = businessName || (websiteData && websiteData.brandName) || "Our Business";
  const effectiveOffers = offers || (websiteData && websiteData.detectedOffer) || "";
  const effectivePrompt = prompt || (websiteData && websiteData.suggestedPrompt) || "";
  const key = resolveIndustryKey({ industry: industry, businessName: effectiveBusiness, prompt: prompt, websiteData: websiteData });
  const cfg = INDUSTRY[key] || INDUSTRY.general;
  const details = extractDetails(prompt, websiteData, input.details);
  const customItems = extractListFromPrompt(prompt);

  const detailLines = Object.keys(details)
    .filter(function (k) {
      return details[k];
    })
    .map(function (k) {
      return "- " + k + ": " + details[k];
    });
  const suggestedTopics = (
    customItems.length
      ? customItems
      : cfg.items.map(function (i) {
          return i[1];
        })
  ).join(", ");
  const userContent = ["Business: " + effectiveBusiness, "Industry type: " + key + (industry ? " (selected: " + industry + ")" : ""), "Language: " + language, customItems.length ? "OWNER-PROVIDED MENU ITEMS (use exactly): " + suggestedTopics : "Suggested menu topics: " + suggestedTopics, "Action button label to use: " + cfg.cta, cfg.order ? "This business needs a full ORDER FLOW (name, size, colour, quantity, address, payment, summary, confirm)." : "", detailLines.length ? "OWNER-PROVIDED DETAILS (use verbatim, do not invent others):\n" + detailLines.join("\n") : "No address/phone/timings were provided. Do NOT invent any.", effectiveOffers ? "Current offer: " + effectiveOffers : "", websiteData ? "Website scan: " + [websiteData.title, websiteData.description, websiteData.headings.join(" | ")].filter(Boolean).join(" || ") : "", effectivePrompt ? "OWNER REQUIREMENTS:\n" + effectivePrompt : ""].filter(Boolean).join("\n");

  const groqApiKey = process.env.GROQ_API_KEY;
  const useAI = groqApiKey && BUILDER_MODE !== "blueprint" && (BUILDER_MODE === "ai" || key === "general");
  if (useAI) {
    for (let mi = 0; mi < GROQ_MODELS.length; mi++) {
      const model = GROQ_MODELS[mi];
      try {
        logger.info("AI Bot Builder: Calling " + model + "...");
        const raw = await callGroq(
          model,
          [
            { role: "system", content: AI_SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
          groqApiKey,
        );
        if (!raw) continue;
        const parsed = extractJson(raw);
        if (!parsed || !Array.isArray(parsed.nodes)) continue;
        const nodes = sanitizeAndLayoutFlow(parsed.nodes, effectiveBusiness);
        const check = validateFlow(nodes);
        if (check.errors.length) {
          logger.warn("AI Bot Builder: " + model + " flow rejected -> " + check.errors.slice(0, 5).join(" | "));
          continue;
        }
        logger.info("AI Bot Builder: Generated " + nodes.length + " valid nodes via " + model);
        return {
          flow: { _id: "new_flow", name: parsed.name || effectiveBusiness + " Bot", description: parsed.description || "WhatsApp bot for " + effectiveBusiness, trigger: parsed.trigger || { type: "keyword", keywords: ["hi", "hello", "start", "menu"] }, nodes: nodes },
          websiteData: websiteData,
          source: "AI (" + model + ")",
          validation: check,
        };
      } catch (err) {
        const apiMsg = err.response && err.response.data && err.response.data.error ? err.response.data.error.message : err.message;
        logger.warn("AI Bot Builder: " + model + " failed — " + apiMsg);
      }
    }
  }

  logger.info("AI Bot Builder: Using tested blueprint (" + key + ")");
  const fallback = generateFallbackFlow({ businessName: effectiveBusiness, industry: industry, websiteData: websiteData, offers: effectiveOffers, language: language, prompt: prompt, details: input.details });
  return { flow: Object.assign({}, fallback, { _id: "new_flow" }), websiteData: websiteData, source: "Built-in blueprint (" + key + ")", validation: validateFlow(fallback.nodes) };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRAMMATIC REFINE FALLBACK
// ─────────────────────────────────────────────────────────────────────────────
function applyProgrammaticRefinement(existingNodes, instruction, businessName, language) {
  businessName = businessName || "Our Business";
  const instr = (instruction || "").toLowerCase();
  const nodes = JSON.parse(JSON.stringify(existingNodes));

  if (/handoff|human|agent|expert|support|live/i.test(instr)) {
    const hasHandoff = nodes.some(function (n) {
      return n.type === "handoff" || n.id === "node_handoff";
    });
    if (!hasHandoff) {
      nodes.push({ id: "node_handoff", type: "handoff", position: { x: 1100, y: 340 }, data: { action: "assign_agent", message: { text: "⚡ Connecting you with a live team member! Please hold on.", body: "⚡ Connecting you with a live team member! Please hold on." } }, edges: [] });
      const welcome =
        nodes.find(function (n) {
          return n.id.indexOf("welcome") !== -1;
        }) || nodes[0];
      if (welcome && welcome.data && welcome.data.message) {
        const m = welcome.data.message;
        const addTo = Array.isArray(m.sections) && m.sections.length ? m.sections[0].rows : (m.buttons = m.buttons || []);
        if (
          !getOptions(welcome).some(function (o) {
            return /expert|agent|support|human/i.test(o.title);
          })
        ) {
          if (Array.isArray(m.sections) && m.sections.length) addTo.push({ id: "row_expert_live", title: "💬 Talk to Expert", description: "Chat with our team" });
          else addTo.push({ id: "btn_expert_live", text: "💬 Talk to Expert", title: "💬 Talk to Expert" });
          welcome.edges = welcome.edges || [];
          welcome.edges.push({ targetNodeId: "node_handoff", label: "Talk to Expert, " + (m.sections ? "row_expert_live" : "btn_expert_live") });
        }
      }
    }
  }

  if (/email|mail/i.test(instr)) {
    const hasEmail = nodes.some(function (n) {
      return (n.data && n.data.variable === "user_email") || n.id.indexOf("email") !== -1;
    });
    if (!hasEmail) {
      const nameNode = nodes.find(function (n) {
        return n.id.indexOf("lead_name") !== -1;
      });
      const nextTarget = nameNode && nameNode.edges && nameNode.edges[0] ? nameNode.edges[0].targetNodeId : null;
      nodes.push({ id: "node_lead_email", type: "question", position: { x: 300, y: 700 }, data: { variable: "user_email", message: { type: "text", text: "📧 Please share your email address for detailed info & updates:", body: "📧 Please share your email address for detailed info & updates:" } }, edges: nextTarget ? [{ targetNodeId: nextTarget, label: "default" }] : [] });
      if (nameNode) nameNode.edges = [{ targetNodeId: "node_lead_email", label: "default" }];
    }
  }

  if (/discount|offer|coupon|deal|promo/i.test(instr)) {
    const pctMatch = instr.match(/\d{1,2}%/);
    const pct = pctMatch ? pctMatch[0] : "20%";
    const offerNode = nodes.find(function (n) {
      return n.id.indexOf("offer") !== -1;
    });
    if (offerNode && offerNode.data && offerNode.data.message) {
      const tx = "🎁 *Exclusive Offer!* Get *" + pct + " OFF* at " + businessName + "! Claim now. ⏳ Limited time!";
      offerNode.data.message.text = tx;
      offerNode.data.message.body = tx;
    }
  }

  if (/short|concise|brief|compact/i.test(instr)) {
    const welcome =
      nodes.find(function (n) {
        return n.id.indexOf("welcome") !== -1;
      }) || nodes[0];
    if (welcome && welcome.data && welcome.data.message) {
      const tx = "👋 Welcome to *" + businessName + "*! How can we help you today?";
      welcome.data.message.text = tx;
      welcome.data.message.body = tx;
    }
  }

  return nodes;
}

async function refineBotFlow(input) {
  input = input || {};
  const flow = input.flow,
    refineInstruction = input.refineInstruction;
  const businessName = input.businessName || "Our Business";
  const language = input.language || "English";
  if (!flow || !Array.isArray(flow.nodes)) throw new Error("Invalid flow structure to refine");

  const groqApiKey = process.env.GROQ_API_KEY;
  const refineSystemPrompt = "You are an expert WhatsApp bot editor. You receive an EXISTING flow JSON and an edit instruction. Return the COMPLETE updated flow.\n\n" + "EDIT RULES:\n1. Keep every existing node and id; change only what the instruction asks.\n2. Never remove lead capture, confirmation or handoff nodes unless told.\n" + "3. Adding a button/option: add it to the right node AND add its own edge to a (new or existing) node with its own reply.\n4. Changing text: update both data.message.text and data.message.body.\n\n" + AI_RULES;
  const refineUserMessage = "Business: " + businessName + "\nLanguage: " + language + '\nEdit instruction: "' + refineInstruction + '"\n\nCurrent flow nodes:\n' + JSON.stringify(flow.nodes);

  if (groqApiKey && BUILDER_MODE !== "blueprint") {
    for (let mi = 0; mi < GROQ_MODELS.length; mi++) {
      const model = GROQ_MODELS[mi];
      try {
        logger.info("AI Refine: Using " + model + "...");
        const raw = await callGroq(
          model,
          [
            { role: "system", content: refineSystemPrompt },
            { role: "user", content: refineUserMessage },
          ],
          groqApiKey,
        );
        if (!raw) continue;
        const parsed = extractJson(raw);
        if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length >= 2) {
          const nodes = sanitizeAndLayoutFlow(parsed.nodes, businessName);
          const check = validateFlow(nodes);
          if (check.errors.length) {
            logger.warn("AI Refine: " + model + " result rejected -> " + check.errors.slice(0, 5).join(" | "));
            continue;
          }
          return { flow: Object.assign({}, flow, { name: parsed.name || flow.name, description: parsed.description || flow.description, trigger: parsed.trigger || flow.trigger, nodes: nodes }), note: "Refined using AI (" + model + ")", validation: check };
        }
      } catch (err) {
        logger.warn("AI Refine: " + model + " failed — " + err.message);
      }
    }
  }

  logger.info("AI Refine: Applying programmatic refinement");
  const updated = applyProgrammaticRefinement(flow.nodes, refineInstruction, businessName, language);
  const normalized = sanitizeAndLayoutFlow(updated, businessName);
  return { flow: Object.assign({}, flow, { nodes: normalized }), note: "Refined with Smart Rule Engine", validation: validateFlow(normalized) };
}

module.exports = {
  scrapeWebsite: scrapeWebsite,
  generateBotFlow: generateBotFlow,
  generateFallbackFlow: generateFallbackFlow,
  refineBotFlow: refineBotFlow,
  // extras (handy for tests / debugging)
  validateFlow: validateFlow,
  sanitizeAndLayoutFlow: sanitizeAndLayoutFlow,
  detectIndustryFromText: detectIndustryFromText,
};
