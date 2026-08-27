'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function AIBartenderModal({
  isOpen,
  onClose,
  onOpenRecipe,
  onAddToCart,
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "🍸 **Karibu! I'm Tipsy, your AI Sommelier & Master Mixologist.**\n\nI'm connected to our live cellar stocks, prices in KSh, cocktail recipes, and party calculators. Ask me anything about drinks, recipes, fun trivia, or pairing suggestions!",
      suggestedProducts: [],
      suggestedRecipes: [],
      followUps: [
        'What cocktails can I make with Jameson?',
        'Recommend a refreshing gin spritz',
        'How many bottles do I need for 10 people?',
        'Tell me a fun drink trivia fact',
      ],
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [addedProductId, setAddedProductId] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const msgCounter = useRef(1);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, loading]);

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputValue).trim();
    if (!text || loading) return;

    msgCounter.current += 1;
    const userMessage = {
      id: `user-${msgCounter.current}`,
      role: 'user',
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const chatHistory = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/ai/bartender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory }),
      });

      const data = await res.json();

      msgCounter.current += 1;
      if (data.success && data.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${msgCounter.current}`,
            role: 'assistant',
            content: data.message.content,
            suggestedProducts: data.suggestedProducts || [],
            suggestedRecipes: data.suggestedRecipes || [],
            followUps: data.followUps || [],
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${msgCounter.current}`,
            role: 'assistant',
            content:
              "Sorry, I was restocking the ice bin! What drink or cocktail can I help you with?",
            suggestedProducts: [],
            suggestedRecipes: [],
            followUps: [
              'Whiskey under 4,000 KSh',
              'What goes well with Beefeater?',
              'Party drink calculator',
            ],
          },
        ]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      msgCounter.current += 1;
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${msgCounter.current}`,
          role: 'assistant',
          content:
            "A quick bar hiccup occurred. Please ask again or check our cocktail menu!",
          suggestedProducts: [],
          suggestedRecipes: [],
          followUps: ['Show me gin cocktails', 'Popular whiskey choices'],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (productId) => {
    if (!onAddToCart) return;
    onAddToCart(productId);
    setAddedProductId(productId);
    setTimeout(() => setAddedProductId(null), 2000);
  };

  // Helper to format basic markdown (bold, lists)
  const formatContent = (content) => {
    if (!content) return null;
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      // Bold rendering
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedLine = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-extrabold text-gray-900">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      if (line.trim() === '') {
        return <div key={idx} className="h-2" />;
      }
      if (line.startsWith('• ') || line.startsWith('- ')) {
        return (
          <div key={idx} className="flex items-start gap-1.5 pl-1 my-0.5">
            <span className="text-[#840038] font-bold">•</span>
            <span className="flex-1">{formattedLine.slice(1)}</span>
          </div>
        );
      }
      return <p key={idx} className="my-0.5 leading-relaxed">{formattedLine}</p>;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col h-[85vh] max-h-[720px] animate-scale-up">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#5a0025] via-[#840038] to-[#2b0012] text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl shadow-inner relative">
              🍸
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#840038]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-black tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  Tipsy AI Bartender
                </h3>
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Live Sommelier
                </span>
              </div>
              <p className="text-[11px] text-pink-100/80">
                All-knowing drinks, mixes, party math &amp; live prices
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white text-xs font-bold transition-all"
            aria-label="Close Bartender AI"
          >
            ✕
          </button>
        </div>

        {/* Chat Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-gradient-to-b from-gray-50/50 via-white to-gray-50/30">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-2`}
            >
              {/* Message Bubble */}
              <div
                className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm shadow-xs ${
                  msg.role === 'user'
                    ? 'bg-[#840038] text-white rounded-br-xs'
                    : 'bg-white border border-gray-200/90 text-gray-800 rounded-bl-xs'
                }`}
              >
                {formatContent(msg.content)}
              </div>

              {/* Suggested Product Cards (Add to Cart in 1-Click) */}
              {msg.suggestedProducts && msg.suggestedProducts.length > 0 && (
                <div className="w-full max-w-[92%] sm:max-w-[85%] space-y-1.5 pt-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 block px-1">
                    🛒 Recommended In-Stock Bottles:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {msg.suggestedProducts.map((p) => {
                      const isJustAdded = addedProductId === p.id;
                      return (
                        <div
                          key={p.id}
                          className="bg-white border border-pink-200 rounded-2xl p-2.5 flex items-center justify-between gap-2.5 shadow-2xs hover:border-[#840038] transition-all"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            {p.image ? (
                              <img
                                src={p.image}
                                alt={p.name}
                                className="w-10 h-10 object-contain rounded-lg bg-gray-50 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-pink-50 text-[#840038] flex items-center justify-center font-bold text-xs shrink-0">
                                🍾
                              </div>
                            )}
                            <div className="overflow-hidden">
                              <h4 className="text-xs font-bold text-gray-900 truncate" title={p.name}>
                                {p.name}
                              </h4>
                              <span className="text-xs font-black text-[#840038]">
                                KSh {p.price.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddToCart(p.id)}
                            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 shrink-0 ${
                              isJustAdded
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#840038] hover:bg-[#6b002c] text-white shadow-2xs'
                            }`}
                          >
                            {isJustAdded ? '✓ Added' : '+ Add'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Suggested Recipes */}
              {msg.suggestedRecipes && msg.suggestedRecipes.length > 0 && (
                <div className="w-full max-w-[92%] sm:max-w-[85%] space-y-1.5 pt-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 block px-1">
                    🍸 Matching Cocktail Recipes:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {msg.suggestedRecipes.map((r) => (
                      <button
                        key={r.slug}
                        type="button"
                        onClick={() => {
                          onOpenRecipe?.(r);
                          onClose?.();
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 text-xs font-bold transition-all active:scale-95"
                      >
                        <span>🍹</span>
                        <span>{r.title}</span>
                        <span className="text-[10px] text-purple-600">→</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
          {loading && (
            <div className="flex items-center gap-2 p-3.5 bg-white rounded-2xl border border-gray-200 w-28 text-gray-500 shadow-xs animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[#840038] animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-[#840038] animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-[#840038] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Dynamic Follow-Up Prompts */}
        {messages[messages.length - 1]?.followUps && messages[messages.length - 1].followUps.length > 0 && !loading && (
          <div className="px-4 py-2 bg-gray-50/80 border-t border-gray-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 shrink-0">
              💡 Suggestions:
            </span>
            {messages[messages.length - 1].followUps.map((prompt, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                className="px-2.5 py-1 rounded-full bg-white hover:bg-pink-50 border border-gray-200 hover:border-pink-300 text-[11px] font-medium text-gray-700 hover:text-[#840038] transition-all active:scale-95 shrink-0 shadow-2xs"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 sm:p-4 bg-white border-t border-gray-200 flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask Tipsy (e.g. 'What can I make with Jameson?', 'Drink pairing for steak', 'Party for 10')..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-xs sm:text-sm focus:ring-2 focus:ring-[#840038]/20 focus:border-[#840038] outline-hidden transition-all bg-gray-50 focus:bg-white placeholder:text-gray-400"
          />

          <button
            type="submit"
            disabled={!inputValue.trim() || loading}
            className="px-4 py-2.5 rounded-xl bg-[#840038] hover:bg-[#6b002c] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm transition-all active:scale-95 shadow-xs flex items-center gap-1 shrink-0"
          >
            <span>Ask</span>
            <span>⚡</span>
          </button>
        </form>
      </div>
    </div>
  );
}
