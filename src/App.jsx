import React, { useState, useMemo, useEffect } from 'react';
import { Routes, Route, useNavigate, Link, useLocation } from 'react-router-dom';

// Simple Mock Data for v1 Prototype
const DEMO_CARDS = [
  { id: '1', name: 'Rahul Sharma', email: 'rahul@example.com', status: 'New Approval', type: 'NACH SIP', transactions: 3, days: 2, priority: 'High' },
  { id: '2', name: 'Anjali Gupta', email: 'anjali@example.com', status: 'Pending Ops', type: 'STP', transactions: 1, days: 5, priority: 'Normal' },
  { id: '3', name: 'Vikram Singh', email: 'vikram@example.com', status: 'Link Sent', type: 'Online Purchase', transactions: 2, days: 8, priority: 'High' },
  { id: '4', name: 'Sanjay Kumar', email: 'sanjay@example.com', status: 'Authorised', type: 'Switch', transactions: 4, days: 1, priority: 'Normal' },
];

const COLUMNS = [
  'New Approval',
  'Pending Ops',
  'Link Sent',
  'Authorised',
  'Done',
  'Rejected'
];

const App = () => {
  const [cards, setCards] = useState(() => {
    const saved = localStorage.getItem('opstrack_cards');
    return saved ? JSON.parse(saved) : [];
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

  // Persist cards state
  useEffect(() => {
    localStorage.setItem('opstrack_cards', JSON.stringify(cards));
  }, [cards]);

  const handleLoadDemoData = () => {
    if (window.confirm('Load Demo Data? This will overwrite your current board.')) {
        setCards(DEMO_CARDS);
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
    setDraftData([]);
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

  const location = useLocation();

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar pt-8">
        <div className="px-8 mb-10 flex items-center gap-3">
          <div style={{ width: '40px', height: '40px', backgroundColor: '#2563eb', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(37,99,235,0.4)' }}>
            <span className="material-symbols-outlined" style={{ color: 'white' }}>analytics</span>
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.025em', color: 'white', lineHeight: 1.2 }}>OpsTrack</h1>
            <p style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '-2px' }}>Management Hub</p>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {[
            { name: 'Overview', icon: 'grid_view', path: '/' },
            { name: 'Team Performance', icon: 'groups', path: '/team' },
            { name: 'Feedback Funnel', icon: 'filter_alt', path: '/feedback' },
            { name: 'Settings', icon: 'settings', path: '/settings' },
          ].map(item => (
            <Link 
              key={item.name}
              to={item.path}
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
            <p style={{ fontSize: '10px', color: '#475569', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>System Controls</p>
            <button 
                onClick={handleLoadDemoData}
                style={{ width: '100%', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#94a3b8', fontSize: '10px', fontWeight: 900, cursor: 'pointer' }}
            >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>deployed_code</span> Load Demo Data
            </button>
            <button 
                onClick={handleFactoryReset}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', color: '#f87171', fontSize: '10px', fontWeight: 900, cursor: 'pointer' }}
            >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>restart_alt</span> Factory Reset
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="header">
          <div>
            <h2 style={{ fontSize: '0.75rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ops Dashboard</h2>
            <div className="flex items-center gap-2" style={{ marginTop: '2px' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px rgba(16,185,129,0.8)' }}></span>
              <span style={{ fontSize: '1.125rem', fontWeight: 800, color: 'white' }}>Live Operations Pulse</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.75rem', padding: '0.5rem 1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '1.125rem', marginRight: '0.5rem' }}>search</span>
              <input type="text" placeholder="Search Client..." style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.75rem', color: 'white', width: '12rem' }} />
            </div>
            <button style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}>
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div style={{ width: '40px', height: '40px', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', color: '#94a3b8', fontWeight: 900, fontSize: '0.75rem' }}>RM</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scroll">
          <section style={{ marginBottom: '2.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white', marginBottom: '1.5rem' }}>Workflow Board</h3>

            <div className="kanban-board">
              {COLUMNS.map(col => (
                <div key={col} className="column">
                  <div className="flex items-center justify-between" style={{ padding: '0 0.75rem', height: '40px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center gap-2">
                      <span style={{ width: '6px', height: '6px', backgroundColor: '#3b82f6', borderRadius: '50%', boxShadow: '0 0 8px rgba(59,130,246,0.6)' }}></span>
                      <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>{col}</span>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 900, backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px', color: '#64748b' }}>
                      {cards.filter(c => c.status === col).length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-4" style={{ minHeight: '200px' }}>
                    {cards.filter(card => card.status === col).length === 0 ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.1, padding: '2rem' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>inbox</span>
                        </div>
                    ) : (
                        cards.filter(card => card.status === col).map(card => (
                          <div key={card.id} className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                               <div>
                                  <p style={{ fontSize: '0.875rem', fontWeight: 900, color: 'white', margin: 0 }}>{card.name}</p>
                                  <p style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>{card.email}</p>
                               </div>
                            </div>
    
                            <div style={{ marginBottom: '1rem' }}>
                              <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 8px', borderRadius: '6px' }}>
                                {card.type}
                              </span>
                            </div>
    
                            <div className="flex items-center justify-between" style={{ paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                               <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined" style={{ color: '#475569', fontSize: '14px' }}>schedule</span>
                                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>{card.days}d ago</span>
                               </div>
                               <div className="flex gap-2">
                                 <button onClick={() => handleOpenDrafter(card)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                   <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>mail</span>
                                 </button>
                                 <button style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                   <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
                                 </button>
                               </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Drafter Modal */}
      {isDrafterOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(11, 14, 20, 0.8)', backdropFilter: 'blur(8px)' }} onClick={() => setIsDrafterOpen(false)}></div>
          
          <div style={{ position: 'relative', width: '90%', maxWidth: '1200px', margin: 'auto', maxHeight: '90vh', backgroundColor: '#0f121a', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
             <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                <div className="flex items-center gap-4">
                   <div style={{ width: '48px', height: '48px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                       <span className="material-symbols-outlined">edit_square</span>
                   </div>
                   <div>
                       <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white' }}>Multi-Link Email Drafter</h3>
                       <p style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Client: {activeCard?.name} · {activeCard?.email}</p>
                   </div>
                </div>
                <div className="flex items-center gap-3">
                   <select 
                     onChange={(e) => addLinkType(e.target.value)}
                     className="custom-select"
                     style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'white', outline: 'none' }}
                   >
                     <option value="" style={{ color: '#64748b' }}>+ Add Link Type</option>
                     {Object.keys(LINK_CONFIG).map(t => <option key={t} value={t} style={{ backgroundColor: '#0f172a', color: 'white' }}>{t}</option>)}
                   </select>
                   <button onClick={() => setIsDrafterOpen(false)} style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined">close</span>
                   </button>
                </div>
             </div>

             <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', borderRight: '1px solid rgba(255,255,255,0.05)' }} className="custom-scroll">
                   {draftData.length === 0 ? (
                     <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '64px', marginBottom: '1rem', opacity: 0.2 }}>post_add</span>
                        <p style={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '12px' }}>Start by selecting a link type</p>
                     </div>
                   ) : (
                     draftData.map((section, lIdx) => (
                       <div key={lIdx} style={{ marginBottom: '2.5rem', position: 'relative' }}>
                          <div style={{ display: 'flex', justify-content: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div className="flex items-center gap-3">
                                <h4 style={{ fontSize: '12px', fontWeight: 900, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{section.type}</h4>
                                <button onClick={() => removeLinkType(lIdx)} style={{ color: '#ef4444', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                                </button>
                            </div>
                            <button onClick={() => addRow(lIdx)} style={{ fontSize: '10px', fontWeight: 900, color: '#64748b', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', textTransform: 'uppercase' }}>+ Add Row</button>
                          </div>
                          
                          <div style={{ overflow: 'hidden', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
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
                                        <button onClick={() => removeRow(lIdx, rIdx)} style={{ color: '#ef4444', opacity: 0.3, background: 'transparent', border: 'none', cursor: 'pointer', verticalAlign: 'middle' }}>
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

                <div style={{ width: '500px', backgroundColor: '#0b0e14', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }} className="custom-scroll">
                   <div className="flex items-center justify-between">
                     <h4 style={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Preview: Boutique Draft</h4>
                     <span style={{ fontSize: '9px', backgroundColor: '#60a5fa', color: '#1e3a8a', padding: '2px 8px', borderRadius: '4px', fontWeight: 900, textTransform: 'uppercase' }}>Elite View</span>
                   </div>
                   
                   <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', padding: '2.5rem', color: '#0f172a', fontSize: '14px', fontFamily: '"Inter", sans-serif', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                      <div style={{ marginBottom: '2rem', borderLeft: '4px solid #1e293b', paddingLeft: '1.25rem' }}>
                         <p style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase' }}>Subject</p>
                         <p style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Request for Investment Links // {activeCard?.name || "[Client Name]"}</p>
                      </div>

                      <p style={{ marginBottom: '1.5rem', fontWeight: 600 }}>Hi Team,</p>
                      <p style={{ marginBottom: '2rem', color: '#334155' }}>Please generate the specified transaction links for <strong>{activeCard?.name || "[Client Name]"}</strong> as per the requirements details below:</p>
                      
                      {draftData.map((section, idx) => (
                        <div key={idx} style={{ marginBottom: '2.5rem' }}>
                           <p style={{ fontSize: '11px', fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', marginBottom: '12px', borderBottom: '2px solid #1e293b', display: 'inline-block' }}>{section.type} DETAILS</p>
                           
                           <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                             <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
                                <thead>
                                  <tr style={{ backgroundColor: '#f8fafc' }}>
                                    {LINK_CONFIG[section.type].map(col => (
                                      <th key={col.name} style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '10px 12px', fontSize: '10px', fontWeight: 800, color: '#64748b', textAlign: 'left', textTransform: 'uppercase' }}>{col.name}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {section.rows.filter(r => r.some(c => c.trim())).map((row, rIdx) => (
                                    <tr key={rIdx}>
                                      {row.map((cell, cIdx) => (
                                        <td key={cIdx} style={{ borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9', padding: '10px 12px', fontSize: '12px', color: '#1e293b' }}>{cell || '-'}</td>
                                      ))}
                                    </tr>
                                  ))}
                                  {section.rows.filter(r => r.some(c => c.trim())).length === 0 && (
                                    <tr>
                                      <td colSpan={LINK_CONFIG[section.type].length} style={{ padding: '15px', textAlign: 'center', fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>Pending data entry...</td>
                                    </tr>
                                  )}
                                </tbody>
                             </table>
                           </div>
                        </div>
                      ))}
                      
                      <div style={{ marginTop: '3rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                         <p style={{ fontSize: '12px', color: '#475569', marginBottom: '1.5rem' }}>Kindly revert with the transaction links and execution screenshots on this email thread.</p>
                         <p style={{ fontWeight: 800, margin: '0 0 5px 0' }}>Warm regards,</p>
                         <p style={{ fontWeight: 700, color: '#2563eb', margin: 0 }}>Financial Planning Team</p>
                         <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 0 0' }}>Boutique Asset Management Services</p>
                      </div>
                   </div>

                   <button 
                     onClick={() => {
                        alert('Ready to Copy! Your professional draft is formatted. (Manual copy enabled in prototype)');
                     }}
                     className="btn-primary" 
                     style={{ width: '100%', padding: '1.25rem', backgroundColor: '#1e293b', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(30,41,59,0.5)' }}
                   >
                      <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '8px' }}>content_copy</span> Copy Elite Draft
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
