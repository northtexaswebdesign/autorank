
import React, { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { ChatbotIcon } from './icons/ChatbotIcon.tsx';
import { CloseIcon } from './icons/CloseIcon.tsx';
import { getChatbotResponse } from '../services/aiService.ts';
import { LogoIcon } from './icons/LogoIcon.tsx';

interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      parts: [{ text: "<p>Hi, I'm RankBot. Ask me about the app or for SEO tips.</p>" }],
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage: Message = { role: 'user', parts: [{ text: input }] };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await getChatbotResponse(newMessages);
      const modelMessage: Message = { role: 'model', parts: [{ text: responseText }] };
      setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error('Chatbot error:', error);
      const errorMessage: Message = { role: 'model', parts: [{ text: "<p>Sorry, I'm having trouble connecting right now. Please try again later.</p>" }] };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <>
      <div className={`fixed bottom-6 right-6 z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}>
        <button
          onClick={() => setIsOpen(true)}
          className="bg-stone-800 text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:bg-stone-900 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
          aria-label="Open AI Assistant"
        >
          <ChatbotIcon className="w-8 h-8" />
        </button>
      </div>

      <div
        className={`fixed bottom-6 right-6 z-50 w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-stone-200/80 flex flex-col transition-all duration-300 ease-in-out origin-bottom-right ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
        }`}
        style={{ height: 'min(70vh, 600px)' }}
      >
        <header className="flex items-center justify-between p-4 border-b border-stone-200/80 flex-shrink-0">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-stone-800 text-white rounded-lg flex items-center justify-center flex-shrink-0">
                <LogoIcon className="w-5 h-5" />
            </div>
            <h2 className="ml-3 text-lg font-semibold text-stone-900">AI Assistant</h2>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-1 text-stone-500 hover:text-stone-800">
            <CloseIcon className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-grow p-4 overflow-y-auto">
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-stone-800 text-white rounded-br-lg'
                      : 'bg-stone-100 text-stone-800 rounded-bl-lg'
                  }`}
                >
                  <div className="prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-1" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.parts[0].text) }} />
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-stone-100 text-stone-800 rounded-2xl rounded-bl-lg px-4 py-2.5">
                  <div className="flex items-center justify-center space-x-1">
                      <div className="w-2 h-2 bg-stone-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-stone-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-stone-400 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <footer className="p-3 border-t border-stone-200/80 flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question..."
              className="flex-grow bg-stone-100 border-transparent rounded-lg px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || input.trim() === ''}
              className="bg-stone-800 text-white px-4 py-2 rounded-lg font-semibold hover:bg-stone-900 disabled:bg-stone-400 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </footer>
      </div>
    </>
  );
};
