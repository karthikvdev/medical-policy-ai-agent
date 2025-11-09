/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User } from 'lucide-react';

interface ChatbotProps {
  documentId: string | null;
  selectedPlan: any | null;
  billText: string;
  policy: any;
}

type Role = 'user' | 'assistant' | 'system';
interface Message { role: Role; content: string; }

export default function Chatbot({ documentId, selectedPlan, billText, policy }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const defaultMessages = [
    "What is my coverage percentage?",
    "When will my claim be processed?",
    "What is my deductible amount?",
    "What services are covered?",
  ];

  useEffect(() => {
    if (documentId) {
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [documentId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    // no-op: conversation is stored locally in state
    setMessages([]);
  };

  const callBackendChat = async (userMessage: string): Promise<string> => {
    const base = import.meta.env.VITE_API_URL as string;
    const payload = {
      history: messages.map(m => ({ role: m.role, content: m.content })),
      policy: policy || {},
      bill_text: billText || '',
      user_input: userMessage,
    };
    const resp = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error('Chat API failed');
    const j = await resp.json();
    return j.reply as string;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || !documentId || !selectedPlan) return;

    const userMessage = text.trim();
    if (userMessage === inputMessage.trim()) {
      setInputMessage('');
    }
    setIsLoading(true);

    try {
      // append user locally
      setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
      const reply = await callBackendChat(userMessage);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    await sendMessage(inputMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!documentId) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 flex items-center justify-center h-[600px]">
        <div className="text-center text-gray-500">
          <Bot className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg">Upload a document and select a plan to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md flex flex-col h-[600px]">
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <Bot className="w-5 h-5 mr-2 text-blue-600" />
          Medical Policy Assistant
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Ask me about your coverage, claims, and policy details
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="mb-4">Start a conversation! Here are some questions you can ask:</p>
            <div className="space-y-2 text-sm text-left max-w-md mx-auto">
              {defaultMessages.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => sendMessage(m)}
                  disabled={isLoading || !documentId || !selectedPlan}
                  className="w-full p-3 bg-gray-50 rounded-lg text-left hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`flex items-start space-x-2 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
              >
                {msg.role === 'user' ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-gray-600" />
                )}
              </div>
              <div
                className={`rounded-lg p-3 ${msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
                  }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start space-x-2 max-w-[80%]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <Bot className="w-4 h-4 text-gray-600" />
              </div>
              <div className="rounded-lg p-3 bg-gray-100">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 p-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your policy..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
