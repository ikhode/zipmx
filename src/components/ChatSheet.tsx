import React, { useState, useEffect, useRef } from 'react';
import APIClient, { APIUser } from '../lib/api';
import { triggerHaptic } from '../lib/haptics';

interface ChatSheetProps {
  rideId: string;
  currentUser: APIUser | null;
  onClose: () => void;
}

export const ChatSheet: React.FC<ChatSheetProps> = ({ rideId, currentUser, onClose }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await APIClient.getRideMessages(rideId);
        setMessages(history);
      } catch (err) {
        console.error('Error fetching chat history:', err);
      }
    };
    fetchHistory();
    
    const handleNewMessage = (e: any) => {
      const { rideId: msgRideId, message } = e.detail;
      if (msgRideId === rideId) {
        setMessages(prev => {
          // Evitar duplicados si el mensaje ya fue insertado localmente por el emisor
          if (prev.find(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
        triggerHaptic('light');
      }
    };

    window.addEventListener('zipp-chat-message', handleNewMessage);
    return () => window.removeEventListener('zipp-chat-message', handleNewMessage);
  }, [rideId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || loading) return;

    setLoading(true);
    triggerHaptic('medium');
    try {
      const msg = await APIClient.sendChatMessage(rideId, text.trim());
      // Optimistic update
      setMessages(prev => [...prev, msg]);
      setText('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-overlay fade-in">
      <div className="chat-sheet-premium slide-up">
        {/* Header */}
        <div className="chat-header">
           <button className="chat-close-btn" onClick={onClose}>✕</button>
           <div className="chat-title-group">
             <h3 className="chat-title">Chat de Viaje</h3>
             <span className="chat-status"><span className="pulse-mini"></span> En línea</span>
           </div>
        </div>

        {/* Messages */}
        <div className="chat-messages-container" ref={scrollRef}>
           {messages.length === 0 ? (
             <div className="chat-empty">
               <div className="chat-empty-icon">💬</div>
               <p>Dile algo al {currentUser?.userType === 'driver' ? 'pasajero' : 'conductor'}...</p>
             </div>
           ) : (
             messages.map((msg) => {
               const isMe = msg.senderId === currentUser?.id;
               return (
                 <div key={msg.id} className={`chat-bubble-row ${isMe ? 'me' : 'them'}`}>
                   <div className={`chat-bubble ${isMe ? 'me' : 'them'}`}>
                     {msg.text}
                     <span className="chat-time">
                       {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                     </span>
                   </div>
                 </div>
               );
             })
           )}
        </div>

        {/* Input Area */}
        <form className="chat-input-area" onSubmit={handleSend}>
           <input 
             className="chat-input"
             placeholder="Escribe un mensaje..."
             value={text}
             onChange={(e) => setText(e.target.value)}
             disabled={loading}
           />
           <button className="chat-send-btn interactive-scale" disabled={loading || !text.trim()}>
             {loading ? '...' : '→'}
           </button>
        </form>
      </div>
    </div>
  );
};
