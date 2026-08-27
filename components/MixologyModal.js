'use client';

import React, { useState } from 'react';

export default function MixologyModal({ recipe, onClose, onAddToCart, products = [] }) {
  const [unitMode, setUnitMode] = useState('metric'); // 'metric' or 'parts'
  const [checkedIngredients, setCheckedIngredients] = useState({});
  const [copied, setCopied] = useState(false);

  if (!recipe) return null;

  // Find matching product in store
  const findMatchingProduct = () => {
    if (!products.length) return null;
    const searchTerms = [
      recipe.brand,
      recipe.title,
      ...(recipe.ingredients || []),
    ].filter(Boolean);

    for (const term of searchTerms) {
      const t = term.toLowerCase();
      const match = products.find((p) => {
        const pName = (p.name || '').toLowerCase();
        if (t.includes('black barrel') && pName.includes('black barrel')) return true;
        if (t.includes('jameson') && pName.includes('jameson')) return true;
        if (t.includes('malfy') && pName.includes('malfy')) return true;
        if (t.includes('chivas') && pName.includes('chivas')) return true;
        if (t.includes('beefeater') && pName.includes('beefeater')) return true;
        if (t.includes('olmeca') && pName.includes('olmeca')) return true;
        if (t.includes('martell') && pName.includes('martell')) return true;
        if (t.includes('malibu') && pName.includes('malibu')) return true;
        if (t.includes('absolut') && pName.includes('absolut')) return true;
        if (t.includes('glenlivet') && pName.includes('glenlivet')) return true;
        if (t.includes('kahlua') && pName.includes('kahlua')) return true;
        if (t.includes('jaba') && pName.includes('jaba')) return true;
        return false;
      });
      if (match) return match;
    }
    return null;
  };

  const matchedProduct = findMatchingProduct();

  const toggleCheck = (idx) => {
    setCheckedIngredients((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const handleShare = () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/mixology?recipe=${recipe.slug}` : '';
    if (navigator.share) {
      navigator.share({
        title: `${recipe.title} Recipe - Happy Hour Mixology`,
        text: `Check out how to make a ${recipe.title} on Happy Hour!`,
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const ingredientsList = unitMode === 'metric' || !recipe.parts?.length ? recipe.ingredients : recipe.parts;

  const difficultyColors = {
    Easy: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    Medium: 'bg-amber-50 text-amber-700 border-amber-200/80',
    Expert: 'bg-purple-50 text-purple-700 border-purple-200/80',
    Advanced: 'bg-rose-50 text-rose-700 border-rose-200/80',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in transition-all duration-300 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-slide-up sm:animate-scale-in text-gray-900 transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header Image & Close with smooth entrance */}
        <div className="relative h-64 sm:h-72 w-full shrink-0 bg-gray-900 overflow-hidden">
          <img
            src={recipe.image || recipe.originalImageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover opacity-90 transition-transform duration-700 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md flex items-center justify-center transition-all z-10 text-sm font-bold active:scale-90"
            aria-label="Close"
          >
            ✕
          </button>

          {/* Share button */}
          <button
            onClick={handleShare}
            className="absolute top-4 left-4 px-3.5 py-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md flex items-center gap-1.5 transition-all z-10 text-xs font-bold active:scale-95"
          >
            <span>{copied ? '✓ Link Copied' : '🔗 Share'}</span>
          </button>

          {/* Header text content overlay */}
          <div className="absolute bottom-4 left-4 right-4 space-y-1.5 text-white">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-[#840038] text-white shadow-xs">
                {recipe.brand}
              </span>
              <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border backdrop-blur-xs shadow-2xs ${difficultyColors[recipe.difficulty] || 'bg-gray-800 text-white'}`}>
                {recipe.difficulty}
              </span>
              <span className="text-[11px] text-gray-300 font-medium">
                ⏱️ {recipe.prepTime}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white drop-shadow-md">
              {recipe.title}
            </h2>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* About / Description */}
          {recipe.description && (
            <div className="text-xs sm:text-sm text-gray-600 leading-relaxed italic border-l-3 border-[#840038] pl-3 py-0.5 bg-rose-50/30 rounded-r-xl">
              &ldquo;{recipe.description}&rdquo;
            </div>
          )}

          {/* Specs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Spirit Base</span>
              <span className="font-bold text-gray-800">{recipe.spiritType}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Glassware</span>
              <span className="font-bold text-gray-800">{recipe.glassware}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Servings</span>
              <span className="font-bold text-gray-800">{recipe.servings}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Garnish</span>
              <span className="font-bold text-gray-800 truncate block" title={recipe.garnish}>{recipe.garnish}</span>
            </div>
          </div>

          {/* Ingredients Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold uppercase tracking-tight text-gray-900">
                  Ingredients
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  ({ingredientsList?.length || 0})
                </span>
              </div>

              {/* Metric vs Parts Toggle with smooth transition */}
              {recipe.parts?.length > 0 && (
                <div className="flex items-center bg-gray-100 p-0.5 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setUnitMode('metric')}
                    className={`px-3 py-1 rounded-lg transition-all duration-200 ${
                      unitMode === 'metric' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    Metric (ml)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitMode('parts')}
                    className={`px-3 py-1 rounded-lg transition-all duration-200 ${
                      unitMode === 'parts' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    Parts
                  </button>
                </div>
              )}
            </div>

            {/* Checklist of Ingredients */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ingredientsList?.map((ing, idx) => {
                const checked = Boolean(checkedIngredients[idx]);
                return (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => toggleCheck(idx)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs font-medium transition-all duration-200 active:scale-98 ${
                      checked
                        ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 line-through opacity-75'
                        : 'bg-white border-gray-200/80 hover:border-[#840038]/30 hover:bg-gray-50/60 text-gray-800'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 transition-colors duration-200 ${
                        checked ? 'bg-emerald-600 text-white' : 'border border-gray-300 bg-gray-50'
                      }`}
                    >
                      {checked && <span className="text-[10px] font-bold">✓</span>}
                    </div>
                    <span className="flex-1">{ing}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step-by-Step Instructions */}
          <div className="space-y-3">
            <h3 className="text-base font-bold uppercase tracking-tight text-gray-900">
              How to Prepare
            </h3>
            <div className="space-y-2.5">
              {recipe.instructions?.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3.5 rounded-2xl bg-gray-50/80 border border-gray-100 text-xs leading-relaxed text-gray-800 transition-colors hover:bg-gray-100/70"
                >
                  <span className="w-5 h-5 rounded-full bg-[#840038] text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 shadow-2xs">
                    {idx + 1}
                  </span>
                  <div className="flex-1 font-medium">{step}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Shop The Spirit / Add to Cart Section */}
          {matchedProduct && onAddToCart && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-300 shadow-2xs">
              <div className="flex items-center gap-3">
                {matchedProduct.image && (
                  <img
                    src={matchedProduct.image}
                    alt={matchedProduct.name}
                    className="w-12 h-12 rounded-xl object-cover bg-white p-1 shadow-2xs shrink-0"
                  />
                )}
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#840038] block">Featured Spirit in Stock</span>
                  <h4 className="text-xs font-bold text-gray-900">{matchedProduct.name}</h4>
                  <span className="text-xs font-black text-gray-900">KSh {Number(matchedProduct.price || 0).toLocaleString()}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onAddToCart(matchedProduct.id);
                  onClose();
                }}
                className="px-4 py-2.5 bg-[#840038] hover:bg-[#6b002c] active:scale-95 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <span>🛒 Add Spirit to Cart</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-gray-500 font-medium">
            Enjoy responsibly · 18+ only
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 active:scale-95 text-gray-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

