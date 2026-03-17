'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// DYNAMIC DANCING TITLE
function RetroTitle({ text, showVersion }: { text: string; showVersion?: boolean }) {
  return (
    <div className="flex flex-col items-center mb-10 mt-6 select-none">
      <div className="flex justify-center flex-wrap">
        {text.split('').map((char, i) => (
          <span
            key={i}
            className="text-5xl font-pixel tracking-tighter animate-dance inline-block"
            style={{
              color: '#FFD166',
              animationDelay: `${i * 0.1}s`,
              textShadow: `-3px -3px 0 #1A1A1A, 3px -3px 0 #1A1A1A, -3px 3px 0 #1A1A1A, 3px 3px 0 #1A1A1A, 6px 6px 0px rgba(0,0,0,0.2)`,
              marginRight: char === ' ' ? '15px' : '2px'
            }}
          >
            {char}
          </span>
        ))}
      </div>
      {showVersion && (
        <span className="font-pixel text-xl text-[#1A1A1A] mt-2 opacity-80">v2.4.2</span>
      )}
    </div>
  );
}

export default function RetroBoard() {
  const [notices, setNotices] = useState<any[]>([])
  const [text, setText] = useState('')
  const [username, setUsername] = useState('')
  const [tempName, setTempName] = useState('')
  const [mounted, setMounted] = useState(false)
  const [newNoticeAlert, setNewNoticeAlert] = useState(false)
  
  const [view, setView] = useState<'public' | 'dm'>('public')
  const [dmRecipient, setDmRecipient] = useState('')
  const [hasUnreadDM, setHasUnreadDM] = useState(false)
  const [hasUnreadPublic, setHasUnreadPublic] = useState(false)
  const [activeUsers, setActiveUsers] = useState<string[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [showUserDropdown, setShowUserDropdown] = useState(false)

  // FUNCTION: Mark ALL my unread DMs as read
  const markAllAsRead = async () => {
    const currentMe = localStorage.getItem('board_username');
    if (!currentMe) return;
    await supabase
      .from('notices')
      .update({ is_read: true })
      .eq('recipient', currentMe)
      .eq('is_read', false);
  }

  // FUNCTION: Mark a SPECIFIC message as read (Triggered by Realtime)
  const markSpecificAsRead = async (id: number) => {
    await supabase.from('notices').update({ is_read: true }).eq('id', id);
  }

  useEffect(() => {
    setMounted(true)
    const savedUser = localStorage.getItem('board_username')
    if (savedUser) setUsername(savedUser)
    fetchNotices()
    
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, (payload) => {
        const currentMe = localStorage.getItem('board_username');

        if (payload.eventType === 'INSERT') {
          const isForMe = payload.new.recipient === currentMe;
          const isPublic = !payload.new.recipient;
          const iAmAuthor = payload.new.author === currentMe;

          if (isPublic || isForMe || iAmAuthor) {
            setNotices((prev) => [payload.new, ...prev])
          }

          if ((isPublic && !iAmAuthor) || isForMe) {
            setNewNoticeAlert(true)
            setTimeout(() => setNewNoticeAlert(false), 4000)
            
            const currentTab = window.localStorage.getItem('current_view') || 'public';
            
            if (isForMe) {
              if (currentTab === 'dm') {
                // If I am looking at the DM tab, mark this SPECIFIC new ID as read immediately
                markSpecificAsRead(payload.new.id);
              } else {
                setHasUnreadDM(true);
              }
            }
            if (isPublic && currentTab !== 'public') setHasUnreadPublic(true);
          }
        } 
        else if (payload.eventType === 'UPDATE') {
          setNotices((prev) => 
            prev.map(n => n.id === payload.new.id ? { ...n, ...payload.new } : n)
          )
        } 
        else if (payload.eventType === 'DELETE') {
          setNotices((prev) => prev.filter(n => n.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Sync users list whenever notices change
  useEffect(() => {
    if (notices.length > 0) {
      const authors = notices.map(n => n.author).filter(Boolean).map(a => a.toLowerCase())
      const recipients = notices.map(n => n.recipient).filter(Boolean).map(r => r.toLowerCase())
      const uniqueUsers = Array.from(new Set([...authors, ...recipients]))
        .filter(u => u !== username && u !== 'anonymous')
        .sort()
      setActiveUsers(uniqueUsers)
    }
  }, [notices, username])

  const fetchNotices = async () => {
    const { data } = await supabase.from('notices').select('*').order('created_at', { ascending: false })
    if (data) setNotices(data)
  }

  const handleLogin = () => {
    if (!tempName.trim()) return
    const cleanedName = tempName.trim().toLowerCase()
    localStorage.setItem('board_username', cleanedName)
    setUsername(cleanedName)
  }

  const handleLogout = () => {
    localStorage.removeItem('board_username')
    localStorage.removeItem('current_view')
    setUsername(''); setTempName('')
  }

  const handleSend = async () => {
    if (!text.trim() || !username) return
    if (view === 'dm' && !dmRecipient) return alert("Select a recipient!")
    const payload = { 
      content: text, 
      author: username,
      recipient: view === 'dm' ? dmRecipient : null,
      is_read: false 
    }
    await supabase.from('notices').insert([payload])
    setText('')
    setUserSearch('')
  }

  const handleDelete = async (id: number) => {
    await supabase.from('notices').delete().eq('id', id)
  }

  const switchView = (newView: 'public' | 'dm') => {
    setView(newView)
    window.localStorage.setItem('current_view', newView);
    if (newView === 'dm') {
      setHasUnreadDM(false)
      markAllAsRead()
    } else {
      setHasUnreadPublic(false)
    }
  }

  const filteredUsers = activeUsers.filter(u => u.toLowerCase().includes(userSearch.toLowerCase()))
  const filteredNotices = notices.filter(n => {
    if (view === 'public') return !n.recipient;
    return (n.recipient === username || (n.author === username && n.recipient));
  })

  if (!mounted) return null
  
  if (!username) {
    return (
      <div className="min-h-screen bg-[#87CEEB] flex flex-col items-center justify-center p-4 font-pixel text-[#1A1A1A]">
        <RetroTitle text="FAMILY BOARD" showVersion={true} />
        <div className="bg-[#FDFD96] border-[4px] border-[#1A1A1A] p-8 shadow-[10px_10px_0px_0px_rgba(26,26,26,1)] max-w-xs w-full">
          <h1 className="text-3xl mb-6 text-center leading-none uppercase">System Access</h1>
          <input className="w-full border-[3px] border-[#1A1A1A] p-3 text-2xl mb-4 bg-white outline-none" value={tempName} onChange={(e) => setTempName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="TYPE NAME..." />
          <button onClick={handleLogin} className="w-full bg-[#1A1A1A] text-[#FDFD96] py-3 text-2xl active:translate-y-1 transition-all uppercase">Enter</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#87CEEB] relative pb-40 font-pixel text-[#1A1A1A]">
      <div className="fixed bottom-0 w-full h-48 bg-[#2D6A4F] clip-mountain z-0 opacity-95"></div>
      <div className="relative z-10 max-w-lg mx-auto p-6">
        <RetroTitle text="FAMILY BOARD" showVersion={false} />
        
        {newNoticeAlert && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#FF4B4B] text-white border-4 border-[#1A1A1A] p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] animate-bounce text-center">
            <p className="text-2xl uppercase">! Something's Cooking !</p>
          </div>
        )}

        <div className="flex gap-2 mb-4">
            <button onClick={() => switchView('public')} className={`relative flex-1 py-2 border-4 border-[#1A1A1A] ${view === 'public' ? 'bg-[#FFD166]' : 'bg-white'} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-2xl uppercase`}>
              Public
              {hasUnreadPublic && <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 border-2 border-black rounded-full animate-pulse" />}
            </button>
            <button onClick={() => switchView('dm')} className={`relative flex-1 py-2 border-4 border-[#1A1A1A] ${view === 'dm' ? 'bg-[#A0C4FF]' : 'bg-white'} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-2xl uppercase`}>
              DM 
              {hasUnreadDM && <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 border-2 border-black rounded-full animate-pulse" />}
            </button>
        </div>

        <div className="flex justify-between items-center mb-8 bg-white/90 p-4 border-[3px] border-[#1A1A1A] shadow-[5px_5px_0px_0px_rgba(26,26,26,1)]">
          <span className="text-xl font-bold uppercase">USER: {username}</span>
          <button onClick={handleLogout} className="text-lg text-red-700 underline uppercase">Logout</button>
        </div>

        <div className={`mb-12 p-5 border-[4px] border-[#1A1A1A] shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] ${view === 'dm' ? 'bg-[#A0C4FF]' : 'bg-[#FFD166]'}`}>
          {view === 'dm' && (
            <div className="relative mb-2">
              <input className="w-full border-[3px] border-[#1A1A1A] p-2 text-xl bg-white outline-none uppercase" placeholder={dmRecipient ? `TO: ${dmRecipient.toUpperCase()}` : "SEARCH USER..."} value={userSearch} onFocus={() => setShowUserDropdown(true)} onChange={(e) => setUserSearch(e.target.value)} />
              {showUserDropdown && (
                <div className="absolute left-0 right-0 mt-1 bg-white border-[3px] border-[#1A1A1A] z-50 max-h-40 overflow-y-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  {filteredUsers.length > 0 ? filteredUsers.map(user => (
                    <div key={user} className="p-2 text-xl hover:bg-[#A0C4FF] cursor-pointer border-b-2 border-[#1A1A1A]/10 uppercase" onClick={() => { setDmRecipient(user); setUserSearch(''); setShowUserDropdown(false); }}>{user}</div>
                  )) : <div className="p-2 text-xl opacity-50 uppercase text-center">No users found</div>}
                </div>
              )}
              {showUserDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowUserDropdown(false)} />}
            </div>
          )}
          <textarea className="w-full border-[3px] border-[#1A1A1A] p-4 text-2xl bg-white outline-none h-28 resize-none mb-4 leading-tight" value={text} onChange={(e) => setText(e.target.value)} placeholder={view === 'dm' ? "Type secret message..." : "What's on your mind?..."} />
          <button onClick={handleSend} className="w-full bg-[#1A1A1A] text-white py-3 text-3xl active:scale-[0.97] transition-all uppercase">{view === 'dm' ? 'Send DM' : 'Send Notice'}</button>
        </div>

        <div className="space-y-10">
          {filteredNotices.map((n, index) => (
            <div key={n.id} className={`p-6 border-[4px] border-[#1A1A1A] shadow-[10px_10px_0px_0px_rgba(26,26,26,1)] transform ${index % 2 === 0 ? 'rotate-1' : '-rotate-1'} ${n.recipient ? 'bg-white' : ['bg-[#FFF1A8]', 'bg-[#B4E1FF]', 'bg-[#FFC4C4]', 'bg-[#C1E1C1]'][index % 4]}`}>
              <div className="flex justify-between items-start mb-5 border-b-2 border-[#1A1A1A]/10 pb-2">
                <div className="flex flex-col">
                  <span className="text-2xl font-bold uppercase">
                    {n.author === username ? 'YOU' : n.author} {n.recipient && ` > ${n.recipient === username ? 'YOU' : n.recipient}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg opacity-70">
                        {new Date(n.created_at).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {/* THE SEEN BADGE */}
                    {n.recipient && n.author === username && n.is_read && (
                        <span className="text-blue-600 font-bold text-sm uppercase">✓ Seen</span>
                    )}
                  </div>
                </div>
                {n.author === username && (
                  <button onClick={() => handleDelete(n.id)} className="bg-red-500 text-white border-2 border-[#1A1A1A] w-8 h-8 flex items-center justify-center text-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px]">×</button>
                )}
              </div>
              <p className="text-3xl leading-[1.1] break-words">{n.content}</p>
            </div>
          ))}
        </div>
      </div>
      <style jsx>{`
        .clip-mountain { clip-path: polygon(0% 100%, 0% 65%, 12% 35%, 25% 65%, 45% 15%, 65% 65%, 82% 40%, 100% 75%, 100% 100%); }
        @keyframes dance { 0%, 100% { transform: translateY(0px) rotate(0deg); } 25% { transform: translateY(-10px) rotate(-5deg); } 75% { transform: translateY(-5px) rotate(5deg); } }
        .animate-dance { animation: dance 0.8s infinite ease-in-out; }
      `}</style>
    </div>
  )
}