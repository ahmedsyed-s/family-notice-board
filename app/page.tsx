'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [notices, setNotices] = useState<any[]>([])
  const [text, setText] = useState('')

  // Load messages when the page opens
  useEffect(() => {
    const fetchNotices = async () => {
      const { data } = await supabase.from('notices').select('*').order('created_at', { ascending: false })
      if (data) setNotices(data)
    }
    fetchNotices()
  }, [])

  // Send a message to the database
  const handleSend = async () => {
    if (!text) return
    const { error } = await supabase.from('notices').insert([{ content: text }])
    if (!error) {
      setText('')
      window.location.reload() // We'll make this instant/realtime in the next step!
    }
  }

  return (
    <main className="max-w-md mx-auto p-6 min-h-screen bg-white">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Family Board</h1>
      
      <div className="flex gap-2 mb-8">
        <input 
          className="flex-1 border p-2 rounded text-black" 
          value={text} 
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a notice..."
        />
        <button onClick={handleSend} className="bg-blue-500 text-white px-4 py-2 rounded">Post</button>
      </div>

      <div className="space-y-4">
        {notices.map((n) => (
          <div key={n.id} className="p-4 border rounded shadow-sm bg-gray-50">
            <p className="text-gray-700">{n.content}</p>
            <small className="text-gray-400">{new Date(n.created_at).toLocaleTimeString()}</small>
          </div>
        ))}
      </div>
    </main>
  )
}