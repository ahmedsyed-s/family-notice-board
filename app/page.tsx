'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Retro Title with Floating Animation
function RetroTitle({ text }: { text: string }) {
  return (
    <div className="flex justify-center mb-10 mt-6 select-none">
      <h1 
        className="text-5xl font-pixel tracking-widest animate-float"
        style={{
          color: '#FFD166',
          textShadow: `
            -3px -3px 0 #1A1A1A,  
             3px -3px 0 #1A1A1A,
            -3px  3px 0 #1A1A1A,
             3px  3px 0 #1A1A1A,
             6px  6px 0px rgba(0,0,0,0.2)
          `
        }}
      >
        {text}
      </h1>
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

  useEffect(() => {
    setMounted(true)
    const savedUser = localStorage.getItem('board_username')
    if (savedUser) setUsername(savedUser)
    fetchNotices()
    
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setNotices((prev) => [payload.new, ...prev])
          setNewNoticeAlert(true)
          setTimeout(() => setNewNoticeAlert(false), 4000)
        } else if (payload.eventType === 'DELETE') {
          setNotices((prev) => prev.filter(n => n.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchNotices = async () => {
    const { data } = await supabase.from('notices').select('*').order('created_at', { ascending: false })
    if (data) setNotices(data)
  }

  const handleLogin = () => {
    if (!tempName.trim()) return
    localStorage.setItem('board_username', tempName)
    setUsername(tempName)
  }

  const handleLogout = () => {
    localStorage.removeItem('board_username')
    setUsername('')
    setTempName('')
  }

  const handleSend = async () => {
    if (!text || !username) return
    const { error } = await supabase.from('notices').insert([{ content: text, author: username }])
    if (!error) setText('')
  }

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from('notices').delete().eq('id', id)
    if (error) console.error("Error deleting:", error)
  }

  if (!mounted) return null

  // --- LOGIN SCREEN ---
  if (!username) {
    return (
      <div className="min-h-screen bg-[#87CEEB] flex flex-col items-center justify-center p-4 font-pixel">
        <RetroTitle text="FAMILY BOARD" />
        <div className="bg-[#FDFD96] border-[4px] border-[#1A1A1A] p-8 shadow-[10px_10px_0px_0px_rgba(26,26,26,1)] max-w-xs w-full">
          <h1 className="text-3xl mb-6 text-[#1A1A1A] text-center leading-none">SYSTEM ACCESS</h1>
          <input 
            className="w-full border-[3px] border-[#1A1A1A] p-3 text-2xl mb-4 bg-white text-[#1A1A1A] outline-none"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="TYPE NAME..."
            maxLength={15}
          />
          <button onClick={handleLogin} className="w-full bg-[#1A1A1A] text-[#FDFD96] py-3 text-2xl active:translate-y-1 transition-all">ENTER</button>
        </div>
      </div>
    )
  }

  // --- MAIN BOARD ---
  return (
    <div className="min-h-screen bg-[#87CEEB] relative pb-40 font-pixel text-[#1A1A1A]">
      <div className="fixed bottom-0 w-full h-48 bg-[#2D6A4F] clip-mountain z-0 opacity-95"></div>
      
      <div className="relative z-10 max-w-lg mx-auto p-6">
        <RetroTitle text="FAMILY BOARD" />
        
        {newNoticeAlert && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#FF4B4B] text-white border-4 border-[#1A1A1A] p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] animate-bounce">
            <p className="text-2xl">! NEW MESSAGE RECEIVED !</p>
          </div>
        )}

        <div className="flex justify-between items-center mb-8 bg-white/90 p-4 border-[3px] border-[#1A1A1A] shadow-[5px_5px_0px_0px_rgba(26,26,26,1)]">
          <span className="text-2xl font-bold uppercase">USER: {username}</span>
          <button onClick={handleLogout} className="text-xl text-red-700 underline">LOGOUT</button>
        </div>

        <div className="mb-12 bg-[#FFD166] p-5 border-[4px] border-[#1A1A1A] shadow-[6px_6px_0px_0px_rgba(26,26,26,1)]">
          <textarea 
            className="w-full border-[3px] border-[#1A1A1A] p-4 text-2xl bg-white text-[#1A1A1A] outline-none h-28 resize-none mb-4 leading-tight"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind?..."
          />
          <button onClick={handleSend} className="w-full bg-[#1A1A1A] text-[#FFD166] py-3 text-3xl active:scale-[0.97] transition-all uppercase">Send Notice</button>
        </div>

        <div className="space-y-10">
          {notices.map((n, index) => (
            <div 
              key={n.id} 
              className={`p-6 border-[4px] border-[#1A1A1A] shadow-[10px_10px_0px_0px_rgba(26,26,26,1)] transform
                ${index % 2 === 0 ? 'rotate-1' : '-rotate-1'} 
                ${['bg-[#FFF1A8]', 'bg-[#B4E1FF]', 'bg-[#FFC4C4]', 'bg-[#C1E1C1]'][index % 4]}`}
            >
              <div className="flex justify-between items-start mb-5 border-b-2 border-[#1A1A1A]/10 pb-2">
                <div className="flex flex-col">
                  <span className="text-2xl font-bold uppercase">BY: {n.author || 'ANONYMOUS'}</span>
                  <span className="text-lg opacity-70">
                    {new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
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
        .clip-mountain {
          clip-path: polygon(0% 100%, 0% 65%, 12% 35%, 25% 65%, 45% 15%, 65% 65%, 82% 40%, 100% 75%, 100% 100%);
        }

        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }

        .animate-float {
          display: inline-block;
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}