import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, Link, useLocation } from 'react-router-dom';
import Tesseract from 'tesseract.js';

// Simple Mock Data for v1 Prototype
const DEMO_CARDS = [
  { id: '1', name: 'Rahul Sharma', email: 'rahul@example.com', status: 'New Approval', type: 'NACH SIP', transactions: 3, days: 2, priority: 'High' },
  { id: '2', name: 'Anjali Gupta', email: 'anjali@example.com', status: 'Pending Ops', type: 'STP', transactions: 1, days: 5, priority: 'Normal' },
  { id: '3', name: 'Vikram Singh', email: 'vikram@example.com', status: 'Link Sent', type: 'Online Purchase', transactions: 2, days: 8, priority: 'High' },
  { id: '4', name: 'Sanjay Kumar', email: 'sanjay@example.com', status: 'Authorised', type: 'Switch', transactions: 4, days: 1, priority: 'Normal' },
];

const COLUMNS = ['New Approval', 'Pending Ops', 'Link Sent', 'Authorised', 'Expired', 'Rejected'];

const App = () => {
  const [cards, setCards] = useState(() => {
    const saved = localStorage.getItem('opstrack_cards');
    if (saved) return JSON.parse(saved);
    return [
      { id: 1, name: 'Major Vikram Singh', email: 'vikram.s@defence.gov.in', status: 'New Approval', days: 1, links: [
        { type: 'Redemption', status: 'New Approval', refNo: '', expiryTime: null }
      ]},
    ];
  });
  
  const [isDrafterOpen, setIsDrafterOpen] = useState(false);
  const [activeCard, setActiveCard] = useState(null);
  
  // Validation Config: Define columns and their specific input types
  const LINK_CONFIG = {
    'NACH SIP': [
        { name: 'Fund Name', type: 'text' }, 
        { name: 'SIP Amount', type: 'number' }, 
        { name: 'SIP Date', type: 'date' }, 
        { name: 'Start Date', type: 'date' }, 
        { name: 'Folio Number', type: 'text' }
    ],
    'Online SIP': [
        { name: 'Fund Name', type: 'text' }, 
        { name: 'SIP Amount', type: 'number' }, 
        { name: 'SIP Date', type: 'date' }, 
        { name: 'Start Date', type: 'date' }, 
        { name: 'Folio Number', type: 'text' }
    ],
    'NACH Purchase': [
        { name: 'Fund Name', type: 'text' }, 
        { name: 'Amount', type: 'number' }, 
        { name: 'Folio Number', type: 'text' }
    ],
    'Online Purchase': [
        { name: 'Fund Name', type: 'text' }, 
        { name: 'Amount', type: 'number' }, 
        { name: 'Folio Number', type: 'text' }
    ],
    'STP': [
        { name: 'Source Fund', type: 'text' }, 
        { name: 'Target Fund', type: 'text' }, 
        { name: 'Amount', type: 'number' }, 
        { name: 'Frequency', type: 'text' }, 
        { name: 'Duration', type: 'text' }, 
        { name: 'Total Amt', type: 'number' }, 
        { name: 'Folio', type: 'text' }
    ],
    'Switch': [
        { name: 'Source Fund', type: 'text' }, 
        { name: 'Target Fund', type: 'text' }, 
        { name: 'Amount/Units', type: 'text' }, 
        { name: 'Folio Number', type: 'text' }
    ]
  };

  const [draftData, setDraftData] = useState([]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tokenResponse, setTokenResponse] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef(null);
  const [scanTarget, setScanTarget] = useState(null); // { cardId, linkIdx }
  const viewMode = 'ledger'; // Locked to client-centric view

  // --- GMAIL INTEGRATION LOGIC ---
  const CLIENT_ID = '456901579054-gp5socevnrce9a3i2pmgu6m799jpbeo1.apps.googleusercontent.com';
  const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify';

  useEffect(() => {
    // Load GAPI and GIS
    const script = document.createElement('script');
    script.src = "https://apis.google.com/js/api.js";
    script.onload = () => {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'],
        });

        // Restore token if exists
        const savedToken = sessionStorage.getItem('gmailToken');
        if (savedToken) {
           try {
              const parsedToken = JSON.parse(savedToken);
              window.gapi.client.setToken(parsedToken);
              setTokenResponse(parsedToken);
              setIsAuthenticated(true);
           } catch (e) {
              sessionStorage.removeItem('gmailToken');
           }
        }
      });
    };
    document.body.appendChild(script);
  }, []);

  const handleAuthClick = () => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error !== undefined) throw response;
        setTokenResponse(response);
        setIsAuthenticated(true);
        sessionStorage.setItem('gmailToken', JSON.stringify(response));
        alert('Gmail Connected! Live Automation is now ACTIVE. ⚡🎯');
        checkGmailStatus(); // Initial scan
      },
    });
    client.requestAccessToken();
  };

  const checkGmailStatus = async () => {
    if (!isAuthenticated || !tokenResponse) return;
    setIsPolling(true);

    try {
      const response = await window.gapi.client.gmail.users.messages.list({
        userId: 'me',
        maxResults: 20,
        q: 'after:' + Math.floor((Date.now() - 3600000 * 24) / 1000) // Last 24 hours for safety
      });

      const messages = response.result.messages || [];
      const messageDetails = [];
      for (const msg of messages) {
        const detail = await window.gapi.client.gmail.users.messages.get({
          userId: 'me',
          id: msg.id
        });
        messageDetails.push({ msgId: msg.id, detail });
      }

      setCards(prevCards => {
         let updatedCards = [...prevCards];

         // Process from oldest to newest if needed, but since we are just updating state iteratively it's fine.
         // We reverse messageDetails to process chronological (oldest to newest)
         for (const { msgId, detail } of messageDetails.reverse()) {
            const snippet = detail.result.snippet.toLowerCase();
            const headers = detail.result.payload.headers;
            const subjectOrig = headers.find(h => h.name === 'Subject')?.value || '';
            const subject = subjectOrig.toLowerCase();
            const msgDateStr = headers.find(h => h.name === 'Date')?.value || '';
            let msgTime = Date.now();
            if (detail.result.internalDate) {
               msgTime = parseInt(detail.result.internalDate, 10);
            } else if (msgDateStr) {
               msgTime = new Date(msgDateStr).getTime();
            }
            
            // 1. Find matching existing client
            let matchedCardIdx = updatedCards.findIndex(card => 
               subject.includes(card.name.toLowerCase()) || snippet.includes(card.name.toLowerCase())
            );

            // 2. Extract potential Link Types from email
            const keywordsMap = {
               'sip': 'Online SIP',
               'purchase': 'Online Purchase',
               'stp': 'STP',
               'switch': 'Switch',
               'redemption': 'Redemption'
            };
            const foundLinkTypesRaw = Object.keys(LINK_CONFIG).filter(type => 
               subject.includes(type.toLowerCase()) || snippet.includes(type.toLowerCase())
            );
            Object.keys(keywordsMap).forEach(k => {
               if (subject.match(new RegExp('\\b' + k + '\\b', 'i')) || snippet.match(new RegExp('\\b' + k + '\\b', 'i'))) {
                  foundLinkTypesRaw.push(keywordsMap[k]);
               }
            });
            const foundLinkTypes = [...new Set(foundLinkTypesRaw)];

            // Determine intention context
            const textWindow = subject + " " + snippet;
            const isLinkSent = textWindow.includes('inform the officer') || textWindow.includes('ref no');
            const isAuth = textWindow.includes('authorised') || textWindow.includes('authenticated');
            const isRejected = textWindow.includes('rejected') || textWindow.includes('failed') || textWindow.includes('invalid');
            const isNewRequest = !isLinkSent && !isAuth && !isRejected; // It's likely a new link being sent to ops

            if (matchedCardIdx === -1) {
               // BRAND NEW CLIENT AUTO-CREATION
               if (foundLinkTypes.length > 0 && isNewRequest) {
                  const cleanSubject = subjectOrig.replace(/^(Re|Fwd|FW|RE):\s*/i, '').trim() || 'New Auto-Captured Client';
                  
                  // Prevent duplicates in same loop
                  const existingByName = updatedCards.findIndex(c => c.name.toLowerCase() === cleanSubject.toLowerCase());
                  if (existingByName === -1) {
                     const newCard = {
                       id: msgId,
                       name: cleanSubject,
                       email: 'Auto-Captured',
                       status: 'Pending Ops',
                       days: 0,
                       lastInteraction: msgTime,
                       links: foundLinkTypes.map(type => ({
                           type,
                           status: 'Pending Ops',
                           refNo: null,
                           expiryTime: null
                       }))
                     };
                     updatedCards.push(newCard);
                  }
               }
            } else {
               // EXISTING CLIENT
               let card = { ...updatedCards[matchedCardIdx] };
               let cardLinks = [...(card.links || [])];

               // Track last interaction if email explicitly matches
               const textWindow = subject + " " + snippet;
               if (foundLinkTypes.length > 0 || cardLinks.some(l => textWindow.includes(l.type.toLowerCase()) || subject.includes(l.type.toLowerCase()) || snippet.includes(l.type.toLowerCase()))) {
                   card.lastInteraction = msgTime; // Update timestamp
               }

               // Append new links if requested
               for (const type of foundLinkTypes) {
                  // Only add if there is NO link of this exact type created/completed in the last 24 hours
                  const hasRecent = cardLinks.some(l => l.type.toLowerCase() === type.toLowerCase() && (!l.completedAt || Date.now() - l.completedAt < 24 * 60 * 60 * 1000));
                  
                  if (!hasRecent && isNewRequest) {
                     cardLinks.push({
                         type,
                         status: 'Pending Ops',
                         refNo: null,
                         expiryTime: null
                     });
                  }
               }

               // Normal status update loop across all links
               cardLinks = cardLinks.map(link => {
                  const typeInEmail = subject.includes(link.type.toLowerCase()) || snippet.includes(link.type.toLowerCase());
                  if (!typeInEmail) return link;

                  const linkIndex = textWindow.indexOf(link.type.toLowerCase());
                  const tw = linkIndex >= 0 ? textWindow.substring(Math.max(0, linkIndex - 70), Math.min(textWindow.length, linkIndex + 70)) : textWindow;

                  const lSent = tw.includes('inform the officer') || tw.includes('ref no');
                  const lAuth = tw.includes('authorised') || tw.includes('authenticated');
                  const lRej = tw.includes('rejected') || tw.includes('failed') || tw.includes('invalid');

                  if (lRej && (link.status === 'Pending Ops' || link.status === 'Link Sent')) {
                     return { ...link, status: 'Rejected', expiryTime: null, completedAt: link.completedAt || msgTime };
                  }
                  if (lAuth && (link.status === 'Link Sent' || link.status === 'Pending Ops')) {
                     return { ...link, status: 'Authorised', expiryTime: null, completedAt: link.completedAt || msgTime };
                  }
                  if (lSent && (link.status === 'Pending Ops' || link.status === 'New Approval')) {
                     const refMatch = tw.match(/ref no[\.\s:]+([a-z0-9]+)/i);
                     return { ...link, status: 'Link Sent', expiryTime: Date.now() + (48*3600*1000), refNo: refMatch ? refMatch[1].toUpperCase() : link.refNo };
                  }

                  return link;
               });

               // Overall status sync
               const statuses = cardLinks.map(l => l.status);
               let overallStatus = card.status;
               if (statuses.length > 0) {
                   if (statuses.every(s => s === 'Authorised')) overallStatus = 'Authorised';
                   else if (statuses.some(s => s === 'Rejected')) overallStatus = 'Rejected';
                   else if (statuses.some(s => s === 'Link Sent')) overallStatus = 'Link Sent';
                   else if (statuses.some(s => s === 'Pending Ops')) overallStatus = 'Pending Ops';
                   else if (statuses.some(s => s === 'New Approval')) overallStatus = 'New Approval';
                   else overallStatus = statuses[0];
               }

               card.links = cardLinks;
               card.status = overallStatus;
               updatedCards[matchedCardIdx] = card;
            }
         }

         return updatedCards;
      });
    } catch (err) {
      console.error('Gmail Polling Error:', err);
      if (err.status === 401 || err.status === 403) {
         setIsAuthenticated(false);
         setTokenResponse(null);
         sessionStorage.removeItem('gmailToken');
         console.warn('Gmail Session Expired. Please reconnect.');
      }
    } finally {
      setIsPolling(false);
    }
  };

  // Run polling every 15 seconds if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      checkGmailStatus(); // Scan immediately
      const interval = setInterval(checkGmailStatus, 15000); // 15 seconds
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, tokenResponse]);

  // Persist cards state
  useEffect(() => {
    localStorage.setItem('opstrack_cards', JSON.stringify(cards));
  }, [cards]);

  const handleLoadDemoData = () => {
    if (window.confirm('Load Multi-Link Demo Data? This will overwrite your current board.')) {
      const now = Date.now();
      const demoCards = [
        { id: now + 1, name: 'Capt. Rahul Sharma', email: 'rahul.s@navy.gov.in', status: 'Pending Ops', days: 0, links: [
          { type: 'Redemption', status: 'Pending Ops', refNo: null, expiryTime: null },
          { type: 'Switch', status: 'New Approval', refNo: null, expiryTime: null }
        ]},
        { id: now + 2, name: 'Col. Rajesh Khanna', email: 'r.khanna@army.mil.in', status: 'Link Sent', days: 1, links: [
          { type: 'Online Purchase', status: 'Link Sent', refNo: 'TXN8821', expiryTime: now + (36 * 60 * 60 * 1000) }
        ]},
        { id: now + 3, name: 'Brig. Amit Shah', email: 'amit.s@defence.gov.in', status: 'Authorised', days: 3, links: [
          { type: 'STP', status: 'Authorised', refNo: 'TXN99821', expiryTime: null }
        ]},
        { id: now + 4, name: 'Lt. Col. Anita Desai', email: 'anita.d@army.gov.in', status: 'Link Sent', days: 2, links: [
          { type: 'Redemption', status: 'Link Sent', refNo: 'TXN_OLD', expiryTime: now + (2 * 60 * 60 * 1000) }
        ]},
      ];
      setCards(demoCards);
      alert('Boutique Workflow Intelligence (Multi-Link) Loaded! ⏳🛡️');
    }
  };

  const handleFactoryReset = () => {
    if (window.confirm('Are you sure? This will wipe ALL current data.')) {
        setCards([]);
        localStorage.removeItem('opstrack_cards');
    }
  };

  const handleOpenDrafter = (card) => {
    setActiveCard(card);
    
    // Pre-fill Drafter with existing links from the card
    if (card.links && card.links.length > 0) {
      const initialDraftData = card.links.map(link => {
        // Find if this link type exists in our config
        if (LINK_CONFIG[link.type]) {
          return {
            type: link.type,
            // Try to pre-fill the first row with available data like RefNo or Folio if we have it
            rows: [new Array(LINK_CONFIG[link.type].length).fill('').map((_, i) => {
              const colName = LINK_CONFIG[link.type][i].name;
              if (colName === 'Folio Number' || colName === 'Folio') return link.folio || '';
              return '';
            })]
          };
        }
        return null;
      }).filter(Boolean);
      setDraftData(initialDraftData);
    } else {
      setDraftData([]);
    }
    
    setIsDrafterOpen(true);
  };

  const addLinkType = (type) => {
    if (!type) return;
    setDraftData([...draftData, { type, rows: [new Array(LINK_CONFIG[type].length).fill('')] }]);
  };

  const removeLinkType = (idx) => {
    const newData = draftData.filter((_, i) => i !== idx);
    setDraftData(newData);
  };

  const updateCell = (linkIdx, rowIdx, colIdx, val) => {
    const newData = [...draftData];
    newData[linkIdx].rows[rowIdx][colIdx] = val;
    setDraftData(newData);
  };

  const addRow = (linkIdx) => {
    const newData = [...draftData];
    const colCount = LINK_CONFIG[newData[linkIdx].type].length;
    newData[linkIdx].rows.push(new Array(colCount).fill(''));
    setDraftData(newData);
  };

  const removeRow = (linkIdx, rowIdx) => {
    const newData = [...draftData];
    newData[linkIdx].rows = newData[linkIdx].rows.filter((_, i) => i !== rowIdx);
    setDraftData(newData);
  };

  const handlePaste = (e, linkIdx, rowIdx, colIdx) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    const rows = pasteData.split(/\r?\n/).filter(r => r.trim());
    const newData = [...draftData];
    
    rows.forEach((rowStr, i) => {
        const cells = rowStr.split('\t');
        if (i === 0) {
            cells.forEach((cell, j) => {
                if (colIdx + j < LINK_CONFIG[newData[linkIdx].type].length) {
                    newData[linkIdx].rows[rowIdx][colIdx + j] = cell;
                }
            });
        } else {
            const newRow = new Array(LINK_CONFIG[newData[linkIdx].type].length).fill('');
            cells.forEach((cell, j) => {
                if (j < newRow.length) newRow[j] = cell;
            });
            newData[linkIdx].rows.push(newRow);
        }
    });
    setDraftData(newData);
  };

  const handleScanScreenshot = async (e) => {
    const file = e.target.files[0];
    if (!file || !scanTarget) return;

    setIsScanning(true);
    try {
      const { data: { text } } = await Tesseract.recognize(file, 'eng', {
        logger: m => console.log('Tesseract:', m.status, Math.round(m.progress * 100) + '%')
      });

      console.log('OCR Output:', text);
      
      // Pattern Matching for Folio and Ref No
      const folioMatch = text.match(/\b\d{9,12}\b/); // 9-12 digit folio
      const refMatch = text.match(/(TXN[A-Z0-9]+|REF[:\s]+[A-Z0-9]+)/i);

      setCards(prev => prev.map(card => {
        if (card.id !== scanTarget.cardId) return card;
        
        const updatedLinks = [...card.links];
        const link = updatedLinks[scanTarget.linkIdx];
        
        if (folioMatch) link.folio = folioMatch[0];
        if (refMatch) {
          const cleanRef = refMatch[0].replace(/REF[:\s]+/i, '').toUpperCase();
          link.refNo = cleanRef;
        }

        return { ...card, links: updatedLinks };
      }));
      
      alert(`Scan Complete! ${folioMatch ? 'Found Folio: ' + folioMatch[0] : ''} ${refMatch ? 'Found Ref: ' + refMatch[0] : ''}`);
    } catch (err) {
      console.error('OCR Error:', err);
      alert('Failed to scan screenshot.');
    } finally {
      setIsScanning(false);
      setScanTarget(null);
    }
  };

  const updateCardStatus = (cardId, newStatus, extraData = {}) => {
    setCards(prev => prev.map(card => 
      card.id === cardId 
        ? { 
            ...card, 
            status: newStatus, 
            completedAt: newStatus === 'Authorised' || newStatus === 'Rejected' ? Date.now() : null,
            expiryTime: newStatus === 'Link Sent' ? Date.now() + (48 * 60 * 60 * 1000) : null,
            ...extraData 
          } 
        : card
    ));
  };

  const calculateTimeLeft = (expiryTime) => {
    if (!expiryTime) return null;
    const difference = expiryTime - Date.now();
    if (difference <= 0) return 'EXPIRED';
    
    const hours = Math.floor(difference / (1000 * 60 * 60));
    const minutes = Math.floor((difference / 1000 / 60) % 60);
    
    if (hours > 24) return `${Math.floor(hours/24)}d ${hours%24}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const getTimerColor = (expiryTime) => {
    if (!expiryTime) return '#64748b';
    const difference = expiryTime - Date.now();
    if (difference <= 0) return '#ef4444';
    if (difference < (12 * 60 * 60 * 1000)) return '#f59e0b'; // Orange: <12h
    if (difference < (24 * 60 * 60 * 1000)) return '#3b82f6'; // Blue: <24h
    return '#10b981'; // Green: >24h
  };

  // Force render update for timer
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-container">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleScanScreenshot} 
        style={{ display: 'none' }} 
        accept="image/*"
      />
      
      {isScanning && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 100, background: '#1e293b', padding: '1rem 1.5rem', borderRadius: '1rem', border: '1px solid #3b82f6', color: 'white', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
          <div className="spinner" style={{ width: '20px', height: '20px', border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Scanning Screenshot...</span>
        </div>
      )}

      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && <div className="overlay" onClick={() => setIsSidebarOpen(false)}></div>}
      
      {/* Sidebar */}
      <aside className={`sidebar pt-8 ${isSidebarOpen ? 'open' : ''}`}>
        <div className="px-8 mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{ width: '40px', height: '40px', backgroundColor: '#2563eb', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(37,99,235,0.4)' }}>
              <span className="material-symbols-outlined" style={{ color: 'white' }}>analytics</span>
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.025em', color: 'white', lineHeight: 1.2 }}>OpsTrack</h1>
              <p style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '-2px' }}>Operational Intelligence</p>
            </div>
          </div>
          <button className="sidebar-toggle" onClick={() => setIsSidebarOpen(false)} style={{ display: isSidebarOpen ? 'flex' : 'none' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <nav style={{ flex: 1, padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {[
            { name: 'Workflow Hub', icon: 'grid_view', path: '/' },
            { name: 'Ops Performance', icon: 'groups', path: '/team' },
            { name: 'Ref No. Tracker', icon: 'receipt_long', path: '/ref' },
            { name: 'System Settings', icon: 'settings', path: '/settings' },
          ].map(item => (
            <Link 
              key={item.name}
              to={item.path}
              onClick={() => setIsSidebarOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                textDecoration: 'none',
                transition: 'all 0.2s',
                backgroundColor: location.pathname === item.path ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                color: location.pathname === item.path ? '#60a5fa' : '#94a3b8'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>{item.icon}</span>
              <span style={{ fontSize: '0.875rem', fontWeight: location.pathname === item.path ? 700 : 500 }}>{item.name}</span>
            </Link>
          ))}
          
          <div style={{ marginTop: '2rem', padding: '0 1rem' }}>
            <p style={{ fontSize: '10px', color: '#475569', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Automation Controls</p>
            
            {!isAuthenticated ? (
              <button 
                  onClick={handleAuthClick}
                  style={{ width: '100%', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', color: 'white', fontSize: '11px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}
              >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>key</span> Connect Gmail Live
              </button>
            ) : (
              <div style={{ width: '100%', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', fontSize: '11px', fontWeight: 800 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>verified</span> Gmail Connected
              </div>
            )}

            <button 
                onClick={handleLoadDemoData}
                style={{ width: '100%', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#94a3b8', fontSize: '10px', fontWeight: 900, cursor: 'pointer' }}
            >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>deployed_code</span> Load Workflow Demo
            </button>
            <button 
                onClick={handleFactoryReset}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', color: '#f87171', fontSize: '10px', fontWeight: 900, cursor: 'pointer' }}
            >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>restart_alt</span> Reset Database
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="header">
          <div className="flex items-center gap-4">
            <button className="sidebar-toggle" onClick={() => setIsSidebarOpen(true)}>
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div>
              <h2 style={{ fontSize: '0.75rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ops Dashboard</h2>
              <div className="flex items-center gap-2" style={{ marginTop: '2px' }}>
                <span style={{ 
                  width: '8px', 
                  height: '8px', 
                  backgroundColor: isPolling ? '#3b82f6' : '#10b981', 
                  borderRadius: '50%', 
                  boxShadow: isPolling ? '0 0 8px rgba(59,130,246,0.8)' : '0 0 8px rgba(16,185,129,0.8)',
                  animation: isPolling ? 'pulse 1.5s infinite' : 'none'
                }}></span>
                <span style={{ fontSize: '1.125rem', fontWeight: 800, color: 'white' }}>
                  {isPolling ? 'Syncing Gmail...' : 'Live Tracking'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={checkGmailStatus} title="Force Sync Now" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0.75rem', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa', cursor: 'pointer', transition: 'all 0.2s', opacity: isPolling ? 0.7 : 1 }}>
               <span className="material-symbols-outlined" style={{ animation: isPolling ? 'spin 1s linear infinite' : 'none' }}>sync</span>
            </button>
            <div className="flex items-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.75rem', padding: '0.5rem 1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '1.125rem', marginRight: '0.5rem' }}>search</span>
              <input type="text" placeholder="Search Client ID..." style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.75rem', color: 'white', width: '12rem' }} />
            </div>
            <button style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}>
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div style={{ width: '40px', height: '40px', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', color: '#94a3b8', fontWeight: 900, fontSize: '0.75rem' }}>PL</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scroll">
          <section style={{ marginBottom: '2.5rem' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white' }}>
                Systematic Transaction Ledger
              </h3>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>
                {cards.length} ACTIVE CLIENTS
              </div>
            </div>

            {viewMode === 'kanban' ? (
              <div className="kanban-board custom-scroll">
                {COLUMNS.map(col => (
                  <div key={col} className="column">
                    <div className="flex items-center justify-between" style={{ padding: '0 0.75rem', height: '40px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex items-center gap-2">
                        <span style={{ width: '6px', height: '6px', backgroundColor: 
                          col === 'Expired' ? '#ef4444' : 
                          col === 'Authorised' ? '#10b981' : 
                          col === 'Link Sent' ? '#3b82f6' : '#94a3b8', 
                          borderRadius: '50%' }}></span>
                        <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>{col}</span>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 900, backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px', color: '#64748b' }}>
                        {cards.filter(c => c.status === col).length}
                      </span>
                    </div>

                    <div className="flex flex-col gap-4" style={{ minHeight: '200px', padding: '1rem 0.5rem' }}>
                      {cards.filter(card => card.status === col).length === 0 ? (
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.1, padding: '2rem' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>inbox</span>
                          </div>
                      ) : (
                          cards.filter(card => card.status === col).map(card => {
                            const timeLeft = calculateTimeLeft(card.expiryTime);
                            return (
                            <div key={card.id} className="card">
                              {timeLeft && (
                                <div style={{ position: 'absolute', top: 0, right: 0, padding: '4px 8px', background: getTimerColor(card.expiryTime), color: 'white', fontSize: '8px', fontWeight: 900, borderBottomLeftRadius: '8px', letterSpacing: '0.05em' }}>
                                  {timeLeft}
                                </div>
                              )}

                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                 <div>
                                    <p style={{ fontSize: '0.875rem', fontWeight: 900, color: 'white', margin: 0 }}>{card.name}</p>
                                    <p style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>{card.email}</p>
                                 </div>
                              </div>
      
                              <div className="flex flex-wrap gap-2" style={{ marginBottom: '1rem' }}>
                                {card.links && card.links.length > 0 ? (
                                  card.links.map((link, idx) => (
                                    <div key={idx} className="flex items-center gap-1" style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '6px' }}>
                                      <span style={{ color: '#60a5fa', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {link.type}
                                      </span>
                                      {link.status === 'Authorised' && <span className="material-symbols-outlined" style={{ fontSize: '10px', color: '#10b981' }}>verified</span>}
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setScanTarget({ cardId: card.id, linkIdx: idx });
                                          fileInputRef.current.click();
                                        }}
                                        style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                        title="Scan Screenshot for Folio/Ref"
                                      >
                                        <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>photo_camera</span>
                                      </button>
                                    </div>
                                  ))
                                ) : (
                                  <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 8px', borderRadius: '6px' }}>
                                    {card.type}
                                  </span>
                                )}
                                {card.refNo && (
                                  <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '9px', fontWeight: 900, padding: '4px 8px', borderRadius: '6px' }}>
                                    #{card.refNo}
                                  </span>
                                )}
                              </div>
      
                              <div className="flex items-center justify-between" style={{ paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                 <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                       <span className="material-symbols-outlined" style={{ color: '#475569', fontSize: '14px' }}>history</span>
                                       <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>{card.days}d in flow</span>
                                    </div>
                                    {card.lastInteraction && (
                                       <div className="flex items-center gap-1" title="Last Message">
                                          <span className="material-symbols-outlined" style={{ color: '#3b82f6', fontSize: '12px' }}>schedule</span>
                                          <span style={{ fontSize: '9px', fontWeight: 900, color: '#60a5fa' }}>
                                             {new Date(card.lastInteraction).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                          </span>
                                       </div>
                                    )}
                                 </div>
                                 <div className="flex gap-2">
                                   <select 
                                     value={card.status}
                                     onChange={(e) => updateCardStatus(card.id, e.target.value)}
                                     style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '4px', fontSize: '9px', fontWeight: 700, color: '#94a3b8', cursor: 'pointer', padding: '0 4px' }}
                                   >
                                     {COLUMNS.map(c => <option key={c} value={c}>{c}</option>)}
                                   </select>
                                   {card.status === 'Link Sent' ? (
                                     <button onClick={() => updateCardStatus(card.id, 'Authorised')} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', border: 'none', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Mark as Authorised">
                                       <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                                     </button>
                                   ) : card.status === 'Expired' ? (
                                     <button onClick={() => handleOpenDrafter(card)} style={{ height: '32px', padding: '0 12px', borderRadius: '8px', background: 'rgba(245,158,11,0.1)', border: 'none', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 900 }}>
                                       <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>autorenew</span> RETRIGGER
                                     </button>
                                   ) : card.status === 'Rejected' ? (
                                     <button onClick={() => handleOpenDrafter(card)} style={{ height: '32px', padding: '0 12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 900 }}>
                                       <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>history</span> REGENERATE
                                     </button>
                                   ) : (
                                     <button onClick={() => handleOpenDrafter(card)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Open Drafter">
                                       <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>mail</span>
                                     </button>
                                   )}
                                 </div>
                              </div>
                            </div>
                          )})
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* LEDGER VIEW (PHASE 6) */
              <div style={{ backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem', padding: '0.5rem' }}>
                    {cards.length === 0 ? (
                      <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.3, gridColumn: '1 / -1' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>folder_open</span>
                        <p style={{ fontSize: '12px', marginTop: '1rem' }}>No active clients</p>
                      </div>
                    ) : (
                      cards.map(card => (
                        <div key={card.id || card.email} className="card" style={{ display: 'flex', flexDirection: 'column', background: '#1e293b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.5rem', padding: '1.5rem' }}>
                           {/* Card Header: Client Info */}
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                              <div>
                                 <p style={{ fontSize: '1.125rem', fontWeight: 900, color: 'white', margin: 0 }}>{card.name}</p>
                                 <p style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, marginTop: '4px' }}>{card.email}</p>
                                 {card.lastInteraction && (
                                    <div className="flex items-center gap-1" style={{ marginTop: '0.5rem' }}>
                                       <span className="material-symbols-outlined" style={{ fontSize: '10px', color: '#3b82f6' }}>schedule</span>
                                       <span style={{ fontSize: '9px', color: '#60a5fa', fontWeight: 900 }}>
                                          {new Date(card.lastInteraction).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                       </span>
                                    </div>
                                 )}
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                 {card.status === 'Expired' && (
                                    <button onClick={() => handleOpenDrafter(card)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245,158,11,0.1)', border: 'none', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="RETRIGGER">
                                       <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>autorenew</span>
                                    </button>
                                 )}
                                 {card.status === 'Rejected' && (
                                    <button onClick={() => handleOpenDrafter(card)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="REGENERATE">
                                       <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>history</span>
                                    </button>
                                 )}
                                 <button onClick={() => handleOpenDrafter(card)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="EMAIL">
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>mail</span>
                                 </button>
                              </div>
                           </div>

                           {/* Card Body: Active Links & History */}
                           <div className="flex flex-col gap-2" style={{ flex: 1 }}>
                              {card.links && (() => {
                                 const activeLinks = card.links.filter(link => {
                                    if (link.status !== 'Authorised' && link.status !== 'Rejected') return true;
                                    const completedTime = link.completedAt || card.completedAt || null;
                                    if (!completedTime) return true; // Keep visible if we don't know the exact time
                                    return (Date.now() - completedTime) <= 24 * 60 * 60 * 1000;
                                 });
                                 const archivedLinks = card.links.filter(link => !activeLinks.includes(link));

                                 return (
                                    <>
                                       {activeLinks.length > 0 ? activeLinks.map((link, idx) => {
                                          const timeLeft = calculateTimeLeft(link.expiryTime);
                                          return (
                                             <div key={idx} className="flex items-center justify-between" style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <div className="flex items-center gap-3">
                                                   <span style={{ fontSize: '10px', fontWeight: 900, color: '#60a5fa', textTransform: 'uppercase', width: '70px' }}>{link.type}</span>
                                                   <div className="flex items-center gap-1.5">
                                                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 
                                                         link.status === 'Authorised' ? '#10b981' : 
                                                         link.status === 'Link Sent' ? '#3b82f6' : 
                                                         link.status === 'Rejected' ? '#ef4444' : '#94a3b8' 
                                                      }}></div>
                                                      <span style={{ fontSize: '10px', fontWeight: 900, color: '#cbd5e1' }}>{link.status}</span>
                                                   </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                   {link.expiryTime && (
                                                      <span style={{ fontSize: '9px', fontWeight: 800, color: getTimerColor(link.expiryTime) }}>{timeLeft}</span>
                                                   )}
                                                   {link.refNo && (
                                                      <span style={{ fontSize: '9px', fontWeight: 900, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: '4px' }}>#{link.refNo}</span>
                                                   )}
                                                   <button 
                                                      onClick={() => {
                                                         setScanTarget({ cardId: card.id, linkIdx: idx });
                                                         fileInputRef.current.click();
                                                      }}
                                                      style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', padding: 0 }}
                                                      title="Scan Reference"
                                                   >
                                                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>photo_camera</span>
                                                   </button>
                                                </div>
                                             </div>
                                          )
                                       }) : (
                                          <div style={{ fontSize: '10px', color: '#475569', fontStyle: 'italic', padding: '0.5rem 0', fontWeight: 700 }}>No active requests</div>
                                       )}

                                       {archivedLinks.length > 0 && (
                                          <button 
                                             onClick={() => {
                                                const historyText = archivedLinks.map(l => `${l.type} - ${l.status} on ${new Date(l.completedAt || card.completedAt || Date.now()).toLocaleDateString()}`).join('\n');
                                                alert(`Archived History for ${card.name}:\n\n${historyText}`);
                                             }}
                                             style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '9px', fontWeight: 900, padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0.75rem' }}
                                             title="View past authorized or rejected transactions"
                                          >
                                             <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>history</span>
                                             VIEW {archivedLinks.length} ARCHIVED RECORD(S)
                                          </button>
                                       )}
                                    </>
                                 );
                              })()}
                           </div>
                        </div>
                      ))
                    )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Drafter Modal */}
      {isDrafterOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(11, 14, 20, 0.8)', backdropFilter: 'blur(8px)' }} onClick={() => setIsDrafterOpen(false)}></div>
          
          <div style={{ position: 'relative', width: '95%', maxWidth: '1200px', margin: 'auto', height: '90vh', backgroundColor: '#0f121a', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
             {/* Modal Header */}
             <div className="p-4 sm:p-6 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                <div className="flex items-center gap-4">
                   <div style={{ width: '40px', height: '40px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                       <span className="material-symbols-outlined">edit_square</span>
                   </div>
                   <div>
                       <h3 style={{ fontSize: '1rem', fontWeight: 900, color: 'white' }}>Multi-Link Drafter</h3>
                       <p style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{activeCard?.name}</p>
                   </div>
                </div>
                <div className="flex items-center gap-3">
                   <select 
                     onChange={(e) => addLinkType(e.target.value)}
                     className="custom-select"
                     style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: 'white', outline: 'none' }}
                   >
                     <option value="">+ Add Link</option>
                     {Object.keys(LINK_CONFIG).map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                   <button onClick={() => setIsDrafterOpen(false)} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined">close</span>
                   </button>
                </div>
             </div>

             <div className="drafter-content flex-1 overflow-hidden" style={{ display: 'flex' }}>
                {/* Editor Pane */}
                <div className="drafter-editor flex-1 overflow-y-auto p-4 sm:p-8 custom-scroll" style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                   {draftData.length === 0 ? (
                     <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '64px', marginBottom: '1rem', opacity: 0.1 }}>post_add</span>
                        <p style={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '11px', opacity: 0.5 }}>Select a link type to begin</p>
                     </div>
                   ) : (
                     draftData.map((section, lIdx) => (
                       <div key={lIdx} style={{ marginBottom: '2.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div className="flex items-center gap-3">
                                <h4 style={{ fontSize: '11px', fontWeight: 900, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{section.type}</h4>
                                <button onClick={() => removeLinkType(lIdx)} style={{ color: '#ef4444', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                                </button>
                            </div>
                            <button onClick={() => addRow(lIdx)} style={{ fontSize: '9px', fontWeight: 900, color: '#64748b', background: 'rgba(255,255,255,0.05)', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', textTransform: 'uppercase' }}>+ Add Row</button>
                          </div>
                          
                          <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }} className="custom-scroll">
                            <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                  {LINK_CONFIG[section.type].map(col => (
                                    <th key={col.name} style={{ padding: '0.75rem 1rem', fontSize: '9px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>{col.name}</th>
                                  ))}
                                  <th style={{ width: '40px' }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {section.rows.map((row, rIdx) => (
                                  <tr key={rIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    {row.map((cell, cIdx) => (
                                      <td key={cIdx} style={{ padding: '4px' }}>
                                        <input 
                                          type={LINK_CONFIG[section.type][cIdx].type} 
                                          value={cell}
                                          onChange={(e) => updateCell(lIdx, rIdx, cIdx, e.target.value)}
                                          onPaste={(e) => handlePaste(e, lIdx, rIdx, cIdx)}
                                          style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', padding: '8px', fontSize: '12px', color: '#cbd5e1' }}
                                          placeholder="..."
                                        />
                                      </td>
                                    ))}
                                    <td style={{ textAlign: 'center' }}>
                                        <button onClick={() => removeRow(lIdx, rIdx)} style={{ color: '#ef4444', opacity: 0.3, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                                        </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                       </div>
                     ))
                   )}
                </div>

                {/* Preview Pane */}
                <div className="drafter-preview overflow-y-auto p-4 sm:p-8 custom-scroll" style={{ width: '500px', backgroundColor: '#0b0e14', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                   <div className="flex items-center justify-between">
                     <h4 style={{ fontSize: '9px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Elite Preview</h4>
                     <span style={{ fontSize: '8px', backgroundColor: '#60a5fa', color: '#1e3a8a', padding: '2px 6px', borderRadius: '4px', fontWeight: 900 }}>PRODUCTION READY</span>
                   </div>
                   
                   <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem sm:2.5rem', color: '#0f172a', fontSize: '13px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                      <div style={{ marginBottom: '1.5rem', borderLeft: '3px solid #1e293b', paddingLeft: '1rem' }}>
                         <p style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', margin: '0 0 2px 0', textTransform: 'uppercase' }}>Subject</p>
                         <p style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                           {activeCard?.status === 'Expired' ? 'RETRIGGER Link: ' : 
                            activeCard?.status === 'Rejected' ? 'REGENERATE Request: ' : 
                            'Request for Investment Links // '}
                           {activeCard?.name || "[Client Name]"}
                         </p>
                      </div>

                      <p style={{ marginBottom: '1rem', fontWeight: 600 }}>Hi Team,</p>
                      <p style={{ marginBottom: '1.5rem', color: '#334155' }}>
                        {activeCard?.status === 'Expired' ? 'The previous links have expired. Kindly retrigger the execution links for ' :
                         activeCard?.status === 'Rejected' ? 'The previous request was rejected. Please regenerate the transaction links for ' :
                         'Please generate the specified transaction links for '}
                        <strong>{activeCard?.name || "[Client Name]"}</strong>:
                      </p>
                      
                      {draftData.map((section, idx) => (
                        <div key={idx} style={{ marginBottom: '2rem' }}>
                           <p style={{ fontSize: '10px', fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '2px solid #1e293b', display: 'inline-block' }}>{section.type}</p>
                           
                           <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflowX: 'auto' }}>
                             <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ backgroundColor: '#f8fafc' }}>
                                    {LINK_CONFIG[section.type].map(col => (
                                      <th key={col.name} style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '8px 10px', fontSize: '9px', fontWeight: 800, color: '#64748b', textAlign: 'left', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{col.name}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {section.rows.filter(r => r.some(c => c.trim())).map((row, rIdx) => (
                                    <tr key={rIdx}>
                                      {row.map((cell, cIdx) => (
                                        <td key={cIdx} style={{ borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9', padding: '8px 10px', fontSize: '11px', color: '#1e293b', whiteSpace: 'nowrap' }}>{cell || '-'}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                             </table>
                           </div>
                        </div>
                      ))}
                      
                      <div style={{ marginTop: '2rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                         <p style={{ fontSize: '11px', color: '#475569', marginBottom: '1rem' }}>Kindly revert with the links and screenshots.</p>
                         <p style={{ fontWeight: 800, margin: '0', fontSize: '12px' }}>Regards,</p>
                         <p style={{ fontWeight: 700, color: '#2563eb', margin: 0 }}>Financial Planning Team</p>
                         <p style={{ fontSize: '10px', color: '#94a3b8', margin: '2px 0 0 0' }}>Boutique Asset Management HQ</p>
                      </div>
                   </div>

                   <button 
                     onClick={() => alert('Elite Draft Copied!')}
                     className="btn-primary" 
                     style={{ width: '100%', padding: '1rem', borderRadius: '12px', fontSize: '14px' }}
                   >
                      <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '8px', fontSize: '20px' }}>content_copy</span> Copy Elite Draft
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
