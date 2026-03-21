import React, { useState, useMemo } from 'react';
import { Routes, Route, useNavigate, Link, useLocation } from 'react-router-dom';

// Simple Mock Data for v1 Prototype
const INITIAL_CARDS = [
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
  const [cards, setCards] = useState(INITIAL_CARDS);
  const [isDrafterOpen, setIsDrafterOpen] = useState(false);
  const [activeCard, setActiveCard] = useState(null);
  
  // Link types and their specific columns
  const LINK_CONFIG = {
    'NACH SIP': ['Fund Name', 'SIP Amount', 'SIP Date', 'Start Date', 'Folio Number'],
    'Online SIP': ['Fund Name', 'SIP Amount', 'SIP Date', 'Start Date', 'Folio Number'],
    'NACH Purchase': ['Fund Name', 'Amount', 'Folio Number'],
    'Online Purchase': ['Fund Name', 'Amount', 'Folio Number'],
    'STP': ['Source Fund', 'Target Fund', 'Amount', 'Frequency', 'Duration', 'Total Amt', 'Folio'],
    'Switch': ['Source Fund', 'Target Fund', 'Amount/Units', 'Folio Number']
  };

  const [draftData, setDraftData] = useState([]); // Array of { type, rows }

  const handleOpenDrafter = (card) => {
    setActiveCard(card);
    setDraftData([]);
    setIsDrafterOpen(true);
  };

  const addLinkType = (type) => {
    setDraftData([...draftData, { type, rows: [['', '', '', '', '', '', '']] }]);
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
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-[#0b0e14] text-[#f1f5f9] font-sans selection:bg-blue-500/30">
      {/* Sidebar (same as before) */}
      <aside className="w-64 bg-[#0f121a] border-r border-white/5 flex flex-col pt-8">
        <div className="px-8 mb-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            <span className="material-symbols-outlined text-white">analytics</span>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white leading-tight font-heading">OpsTrack</h1>
            <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest -mt-0.5">Management Hub</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {[
            { name: 'Overview', icon: 'grid_view', path: '/' },
            { name: 'Team Performance', icon: 'groups', path: '/team' },
            { name: 'Feedback Funnel', icon: 'filter_alt', path: '/feedback' },
            { name: 'Settings', icon: 'settings', path: '/settings' },
          ].map(item => (
            <Link 
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${location.pathname === item.path ? 'bg-blue-600/10 text-blue-400 font-bold' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <span className={`material-symbols-outlined text-xl ${location.pathname === item.path ? 'text-blue-400' : 'text-slate-500 group-hover:text-blue-300'}`}>{item.icon}</span>
              <span className="text-sm">{item.name}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#0b0e14]/50 backdrop-blur-xl sticky top-0 z-20">
          <div>
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Ops Dashboard</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
              <span className="text-lg font-extrabold text-white">Live Operations Pulse</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center bg-white/5 rounded-xl px-4 py-2 border border-white/5">
              <span className="material-symbols-outlined text-slate-400 text-lg mr-2">search</span>
              <input type="text" placeholder="Search Client..." className="bg-transparent border-none outline-none text-xs text-white placeholder:text-slate-500 w-48 font-medium" />
            </div>
            <button className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 transition-colors">
              <span className="material-symbols-outlined text-slate-300">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full border-2 border-[#0b0e14]"></span>
            </button>
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 p-0.5">
              <div className="w-full h-full bg-slate-800 rounded-lg flex items-center justify-center text-slate-300 font-black text-xs">RM</div>
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-8 space-y-10 custom-scroll">
          
          {/* Stats (simplified for brevity here) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 shrink-0">
             {/* ... metrics cards ... */}
          </div>

          {/* Kanban Board */}
          <section className="space-y-6">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xl font-black text-white">Workflow Board</h3>
            </div>

            <div className="flex gap-6 overflow-x-auto pb-8 min-h-[600px] items-start">
              {COLUMNS.map(col => (
                <div key={col} className="w-80 shrink-0 flex flex-col gap-4">
                  <div className="flex items-center justify-between px-3 h-10 border-b border-white/5 bg-white/2">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{col}</span>
                    </div>
                    <span className="text-[10px] font-black bg-white/5 px-2 py-0.5 rounded-full text-slate-500">
                      {cards.filter(c => c.status === col).length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-4 min-h-[200px]">
                    {cards.filter(card => card.status === col).map(card => (
                      <div key={card.id} className="bg-[#161b24] p-5 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all group cursor-pointer relative overflow-hidden">
                        <div className="flex justify-between items-start mb-4">
                           <div>
                              <p className="text-sm font-black text-white mb-0.5">{card.name}</p>
                              <p className="text-[10px] text-slate-500 font-bold">{card.email}</p>
                           </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                          <span className="bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg">
                            {card.type}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                           <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-slate-600 text-sm">schedule</span>
                              <span className="text-[10px] font-bold text-slate-500">{card.days}d ago</span>
                           </div>
                           <div className="flex gap-2">
                             <button onClick={() => handleOpenDrafter(card)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all shadow-lg active:scale-95">
                               <span className="material-symbols-outlined text-lg">mail</span>
                             </button>
                             <button className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:bg-emerald-600 hover:text-white transition-all shadow-lg active:scale-95">
                               <span className="material-symbols-outlined text-lg">visibility</span>
                             </button>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Full Screen Drafter Panel */}
      {isDrafterOpen && (
        <div className="fixed inset-0 z-50 flex animate-fade-in">
          <div className="absolute inset-0 bg-[#0b0e14]/80 backdrop-blur-md" onClick={() => setIsDrafterOpen(false)}></div>
          
          <div className="relative w-[90%] max-w-6xl m-auto h-[90vh] bg-[#0f121a] rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
             {/* Drafter Header */}
             <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/2">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-400">
                      <span className="material-symbols-outlined">edit_note</span>
                   </div>
                   <div>
                      <h3 className="text-xl font-black text-white">Multi-Link Email Drafter</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Client: {activeCard?.name} · {activeCard?.email}</p>
                   </div>
                </div>
                <div className="flex items-center gap-3">
                   <select 
                     onChange={(e) => addLinkType(e.target.value)}
                     className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                   >
                     <option value="">+ Add Link Type</option>
                     {Object.keys(LINK_CONFIG).map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                   <button onClick={() => setIsDrafterOpen(false)} className="w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-slate-400 transition-colors">
                      <span className="material-symbols-outlined">close</span>
                   </button>
                </div>
             </div>

             <div className="flex-1 flex overflow-hidden">
                {/* Left: Input Spreadsheet Area */}
                <div className="flex-1 overflow-y-auto p-8 space-y-10 border-r border-white/5 custom-scroll">
                   {draftData.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-slate-600">
                        <span className="material-symbols-outlined text-6xl mb-4 opacity-20">table_view</span>
                        <p className="font-black uppercase tracking-widest text-xs">Add a link type to start drafting</p>
                     </div>
                   ) : (
                     draftData.map((section, lIdx) => (
                       <div key={lIdx} className="space-y-4 animate-fade-in">
                          <div className="flex justify-between items-center">
                            <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest px-1">{section.type} Request</h4>
                            <button onClick={() => addRow(lIdx)} className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest">+ Add Row</button>
                          </div>
                          
                          <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/2">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-white/2 border-b border-white/5">
                                  {LINK_CONFIG[section.type].map(col => (
                                    <th key={col} className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">{col}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {section.rows.map((row, rIdx) => (
                                  <tr key={rIdx} className="border-b border-white/5 last:border-0 grow">
                                    {row.map((cell, cIdx) => (
                                      <td key={cIdx} className="px-1 py-1">
                                        <input 
                                          type="text" 
                                          value={cell}
                                          onChange={(e) => updateCell(lIdx, rIdx, cIdx, e.target.value)}
                                          onPaste={(e) => handlePaste(e, lIdx, rIdx, cIdx)}
                                          className="w-full bg-transparent border-none outline-none px-3 py-2 text-xs text-slate-300 focus:bg-blue-500/5 transition-all text-left"
                                          placeholder="..."
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p className="text-[9px] text-slate-600 font-bold px-1 italic">Tip: Paste from Excel into any cell to auto-fill the whole table.</p>
                       </div>
                     ))
                   )}
                </div>

                {/* Right: Live Email Preview */}
                <div className="w-[400px] bg-[#0b0e14] p-8 flex flex-col gap-6 overflow-y-auto custom-scroll">
                   <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Smart Preview</h4>
                   
                   <div className="flex-1 bg-white rounded-2xl p-6 overflow-hidden shadow-inner text-slate-800">
                      <div className="space-y-6 text-[12px] font-medium leading-relaxed font-sans">
                         <p className="font-bold">Hi Ops Team,</p>
                         <p>Request transaction links for <strong>{activeCard?.name}</strong>:</p>
                         
                         {draftData.map((section, idx) => (
                           <div key={idx} className="space-y-2">
                             <div className="bg-blue-600 text-white font-black text-[10px] py-1 px-3 rounded uppercase tracking-widest">
                               {section.type} Request
                             </div>
                             <table className="w-full border-collapse border border-slate-200">
                                <thead>
                                  <tr className="bg-slate-50">
                                    {LINK_CONFIG[section.type].map(col => (
                                      <th key={col} className="border border-slate-200 p-1 text-[8px] uppercase text-slate-500">{col}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {section.rows.filter(r => r.some(c => c.trim())).map((row, rIdx) => (
                                    <tr key={rIdx}>
                                      {row.map((cell, cIdx) => (
                                        <td key={cIdx} className="border border-slate-200 p-1 text-[9px]">{cell || '-'}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                             </table>
                           </div>
                         ))}
                         
                         <p className="pt-4 italic text-slate-500 text-[10px]">Kindly send screenshots and link on same thread.</p>
                         <p className="font-bold border-t border-slate-100 pt-4 mt-8">Best regards,<br/>{activeCard?.assignedPlanner || 'Financial Planner'}</p>
                      </div>
                   </div>

                   <button className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-xl shadow-blue-600/20 active:scale-95 transition-all text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3">
                      <span className="material-symbols-outlined">send</span> Send via Gmail API
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #232a35; border-radius: 10px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #2d3644; }
      `}</style>
    </div>
  );
};

export default App;
