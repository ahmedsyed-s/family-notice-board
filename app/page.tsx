'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

function RetroTitle({ text, showVersion }: { text: string; showVersion?: boolean }) {
  return (
    <div className="flex flex-col items-center mb-10 mt-6 select-none">
      <div className="flex justify-center flex-wrap">
        {text.split('').map((char, i) => (
          <span key={i} className="text-5xl font-pixel tracking-tighter animate-dance inline-block"
            style={{ color: '#FFD166', animationDelay: `${i * 0.1}s`,
              textShadow: `-3px -3px 0 #1A1A1A, 3px -3px 0 #1A1A1A, -3px 3px 0 #1A1A1A, -3px 3px 0 #1A1A1A, 6px 6px 0px rgba(0,0,0,0.2)`,
              marginRight: char === ' ' ? '15px' : '2px' }}>
            {char}
          </span>
        ))}
      </div>
      {showVersion && <span className="font-pixel text-xl text-[#1A1A1A] mt-2 opacity-80 uppercase">v3.3.4-stable</span>}
    </div>
  );
}

export default function RetroBoard() {
  const [notices, setNotices] = useState<any[]>([])
  const [dms, setDms] = useState<any[]>([])
  const [text, setText] = useState('')
  const [user, setUser] = useState<{id: string, username: string} | null>(null)
  const [tempName, setTempName] = useState('')
  const [tempPin, setTempPin] = useState('')
  const [isChangingPin, setIsChangingPin] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [mounted, setMounted] = useState(false)
  const [newNoticeAlert, setNewNoticeAlert] = useState(false)
  const [view, setView] = useState<'public' | 'dm'>('public')
  const [dmRecipientId, setDmRecipientId] = useState('')
  const [hasUnreadDM, setHasUnreadDM] = useState(false)
  const [activeUsers, setActiveUsers] = useState<any[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [showUserDropdown, setShowUserDropdown] = useState(false)

  const fetchAll = useCallback(async () => {
    const { data: pub } = await supabase.from('notices').select('*, author:profiles(username)').order('created_at', { ascending: false })
    if (pub) setNotices(pub)

    const { data: priv } = await supabase.from('direct_messages')
      .select('*, sender:profiles!sender_link(username), recipient:profiles!recipient_link(username)')
      .order('created_at', { ascending: false })
    if (priv) setDms(priv)

    const { data: usr } = await supabase.from('profiles').select('id, username').order('username', { ascending: true })
    if (usr) setActiveUsers(usr)
  }, [])

  useEffect(() => {
    setMounted(true)
    const savedUser = localStorage.getItem('board_user')
    if (savedUser) setUser(JSON.parse(savedUser))
    fetchAll()

    const channel = supabase.channel('global-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, (payload) => {
        const me = JSON.parse(localStorage.getItem('board_user') || '{}');
        if (payload.eventType === 'INSERT' && payload.new.recipient_id === me.id) {
          setNewNoticeAlert(true); setTimeout(() => setNewNoticeAlert(false), 4000)
          if (window.localStorage.getItem('current_view') !== 'dm') setHasUnreadDM(true)
          else markAsRead(payload.new.id)
        }
        fetchAll()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchAll])

  const handleLogin = async () => {
    if (!tempName.trim() || tempPin.length !== 4) return
    const username = tempName.trim().toLowerCase()
    let { data: profile } = await supabase.from('profiles').select('*').eq('username', username).single()
    if (!profile) {
      const { data: newUser } = await supabase.from('profiles').insert([{ username, pin: '1234' }]).select().single()
      profile = newUser
    }
    if (profile?.pin === tempPin) {
      const userData = { id: profile.id, username: profile.username }
      localStorage.setItem('board_user', JSON.stringify(userData)); setUser(userData)
      if (window.localStorage.getItem('current_view') === 'dm') markAsRead()
    } else { alert("INVALID PIN") }
  }

  const handleChangePin = async () => {
    if (newPin.length !== 4) return alert("PIN MUST BE 4 DIGITS")
    const { error } = await supabase.from('profiles').update({ pin: newPin }).eq('id', user?.id)
    if (error) alert("FAILED TO UPDATE PIN")
    else {
      alert("PIN UPDATED SUCCESSFULLY!"); setIsChangingPin(false); setNewPin('')
    }
  }

  const handleSend = async () => {
    if (!text.trim() || !user) return
    if (view === 'public') { await supabase.from('notices').insert([{ content: text, author_id: user.id }]) }
    else {
      if (!dmRecipientId) return alert("Select recipient!")
      await supabase.from('direct_messages').insert([{ content: text, sender_id: user.id, recipient_id: dmRecipientId }])
    }
    setText(''); setUserSearch('')
  }

  const handleDelete = async (id: number, isDM: boolean) => {
    if (!confirm("Are you sure you want to delete this message forever?")) return;
    
    const table = isDM ? 'direct_messages' : 'notices'
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) alert("Could not delete message.")
    else fetchAll()
  }

  const markAsRead = async (id?: number) => {
    const me = JSON.parse(localStorage.getItem('board_user') || '{}');
    if (!me.id) return
    const q = supabase.from('direct_messages').update({ is_read: true }).eq('recipient_id', me.id)
    if (id) await q.eq('id', id); else await q.eq('is_read', false)
  }

  const switchView = (v: 'public' | 'dm') => {
    setView(v); window.localStorage.setItem('current_view', v)
    if (v === 'dm' && user) { setHasUnreadDM(false); markAsRead(); }
  }

  if (!mounted) return null
  if (!user) {
    return (
      <div className="min-h-screen bg-[#87CEEB] flex flex-col items-center justify-center p-4 font-pixel text-[#1A1A1A]">
        <RetroTitle text="FAMILY BOARD" showVersion={true} />
        <div className="bg-[#FDFD96] border-[4px] border-[#1A1A1A] p-8 shadow-[10px_10px_0px_0px_rgba(26,26,26,1)] max-w-xs w-full">
          <input className="w-full border-[3px] border-[#1A1A1A] p-3 text-2xl mb-2 bg-white outline-none uppercase" placeholder="NAME" value={tempName} onChange={(e) => setTempName(e.target.value)} />
          <input className="w-full border-[3px] border-[#1A1A1A] p-3 text-2xl mb-4 bg-white outline-none" placeholder="PIN" type="password" maxLength={4} value={tempPin} onChange={(e) => setTempPin(e.target.value)} />
          <button onClick={handleLogin} className="w-full bg-[#1A1A1A] text-[#FDFD96] py-3 text-2xl active:translate-y-1 transition-all uppercase">Login</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#87CEEB] relative pb-40 font-pixel text-[#1A1A1A]">
      <div className="fixed bottom-0 w-full h-48 bg-[#2D6A4F] clip-mountain z-0 opacity-95"></div>
      <div className="relative z-10 max-w-lg mx-auto p-6">
        <RetroTitle text="FAMILY BOARD" />
        
        {newNoticeAlert && <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#FF4B4B] text-white border-4 border-[#1A1A1A] p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] animate-bounce text-center uppercase px-4">Something's Cooking!!!</div>}

        <div className="flex gap-2 mb-4">
          <button onClick={() => switchView('public')} className={`flex-1 py-2 border-4 border-[#1A1A1A] ${view === 'public' ? 'bg-[#FFD166]' : 'bg-white'} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-2xl uppercase`}>Public</button>
          <button onClick={() => switchView('dm')} className={`relative flex-1 py-2 border-4 border-[#1A1A1A] ${view === 'dm' ? 'bg-[#A0C4FF]' : 'bg-white'} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-2xl uppercase`}>DM {hasUnreadDM && <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 border-2 border-black rounded-full animate-pulse" />}</button>
        </div>

        <div className="bg-white/90 p-4 border-[3px] border-[#1A1A1A] shadow-[5px_5px_0px_0px_rgba(26,26,26,1)] mb-8">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-xl font-bold uppercase">HI, {user.username}</span>
              <button onClick={() => setIsChangingPin(!isChangingPin)} className="text-xs text-left underline uppercase opacity-70 hover:opacity-100">Change PIN</button>
            </div>
            <button onClick={() => { localStorage.removeItem('board_user'); setUser(null); }} className="text-red-700 underline uppercase text-sm">Logout</button>
          </div>
          
          {isChangingPin && (
            <div className="mt-4 p-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex gap-2 animate-in fade-in slide-in-from-top-2">
              <input className="border-2 border-black p-1 w-28 outline-none uppercase font-pixel text-lg" type="password" maxLength={4} placeholder="NEW PIN" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
              <button onClick={handleChangePin} className="bg-black text-white px-3 text-xs uppercase hover:bg-gray-800 active:scale-95 transition-all">Save</button>
              <button onClick={() => setIsChangingPin(false)} className="text-xs uppercase opacity-60">Cancel</button>
            </div>
          )}
        </div>

        <div className={`p-5 border-[4px] border-[#1A1A1A] shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] mb-12 ${view === 'dm' ? 'bg-[#A0C4FF]' : 'bg-[#FFD166]'}`}>
          {view === 'dm' && (
            <div className="relative mb-2">
              <input className="w-full border-[3px] border-[#1A1A1A] p-2 text-xl bg-white outline-none uppercase" placeholder={dmRecipientId ? `TO: ${activeUsers.find(u => u.id === dmRecipientId)?.username}` : "SEARCH USER..."} value={userSearch} onFocus={() => setShowUserDropdown(true)} onChange={(e) => setUserSearch(e.target.value)} />
              {showUserDropdown && (
                <div className="absolute left-0 right-0 mt-1 bg-white border-[3px] border-[#1A1A1A] z-50 max-h-40 overflow-y-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  {activeUsers.filter(u => u.username.includes(userSearch.toLowerCase()) && u.id !== user.id).map(u => (
                    <div key={u.id} className="p-2 text-xl hover:bg-[#A0C4FF] cursor-pointer border-b uppercase" onClick={() => { setDmRecipientId(u.id); setUserSearch(''); setShowUserDropdown(false); }}>{u.username}</div>
                  ))}
                </div>
              )}
              {showUserDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowUserDropdown(false)} />}
            </div>
          )}
          <textarea className="w-full border-[3px] border-[#1A1A1A] p-4 text-2xl bg-white outline-none h-28 resize-none mb-4 leading-tight" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type here..." />
          <button onClick={handleSend} className="w-full bg-[#1A1A1A] text-white py-3 text-3xl active:scale-[0.97] transition-all uppercase">Send</button>
        </div>

        <div className="space-y-10">
          {(view === 'public' ? notices : dms.filter(d => d.sender_id === user.id || d.recipient_id === user.id)).map((n, i) => {
            const isDM = !!n.recipient_id;
            const canDelete = isDM ? n.sender_id === user.id : n.author_id === user.id;
            
            return (
              <div key={n.id} className={`p-6 border-[4px] border-[#1A1A1A] shadow-[10px_10px_0px_0px_rgba(26,26,26,1)] transform ${i % 2 === 0 ? 'rotate-1' : '-rotate-1'} ${isDM ? 'bg-white' : ['bg-[#FFF1A8]', 'bg-[#B4E1FF]', 'bg-[#FFC4C4]', 'bg-[#C1E1C1]'][i % 4]}`}>
                <div className="flex justify-between items-start border-b-2 border-black/10 pb-2 mb-4">
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold uppercase">
                      {n.author?.username || n.sender?.username} 
                      {n.recipient?.username && view === 'dm' && ` > ${n.recipient.username}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg opacity-70">
                        {new Date(n.created_at).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isDM && n.sender_id === user.id && n.is_read && <span className="text-blue-600 font-bold text-sm uppercase">✓ Seen</span>}
                    </div>
                  </div>
                  {canDelete && (
                    <button onClick={() => handleDelete(n.id, isDM)} className="bg-red-500 text-white border-2 border-black w-8 h-8 flex items-center justify-center text-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-red-600 active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all uppercase font-bold">×</button>
                  )}
                </div>
                <p className="text-3xl leading-tight break-words">{n.content}</p>
              </div>
            );
          })}
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