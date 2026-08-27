'use client';

import React, { useState } from 'react';

export default function MixologyModal({ recipe, onClose, onAddToCart, products = [] }) {
  const [unitMode, setUnitMode] = useState('metric'); // 'metric' or 'parts'
  const [checkedIngredients, setCheckedIngredients] = useState({});
  const [copied, setCopied] = useState(false);
  const [added, setAdded] = useState(false);

  if (!recipe) return null;

  // Comprehensive Spirit & Product Matcher
  const findMatchingProduct = () => {
    if (!products || products.length === 0) return null;

    const brand = (recipe.brand || '').toLowerCase();
    const title = (recipe.title || '').toLowerCase();
    const spirit = (recipe.spiritType || '').toLowerCase();
    const allText = `${title} ${brand} ${spirit} ${(recipe.ingredients || []).join(' ')}`.toLowerCase();

    const findP = (predicate) => products.find((p) => predicate(p));

    // 1. Jameson
    if (allText.includes('jameson')) {
      if (allText.includes('black barrel')) {
        return findP((p) => p.name.toLowerCase().includes('black barrel')) || findP((p) => p.name.toLowerCase().includes('jameson'));
      }
      return findP((p) => p.name.toLowerCase().includes('jameson') && !p.name.toLowerCase().includes('cradle')) || findP((p) => p.name.toLowerCase().includes('jameson'));
    }

    // 2. Malfy
    if (allText.includes('malfy')) {
      if (allText.includes('rosa')) return findP((p) => p.name.toLowerCase().includes('con rosa')) || findP((p) => p.name.toLowerCase().includes('malfy'));
      if (allText.includes('limone') || allText.includes('lemon')) return findP((p) => p.name.toLowerCase().includes('con limone')) || findP((p) => p.name.toLowerCase().includes('malfy'));
      return findP((p) => p.name.toLowerCase().includes('malfy originale')) || findP((p) => p.name.toLowerCase().includes('malfy'));
    }

    // 3. Chivas Regal
    if (allText.includes('chivas')) {
      return findP((p) => p.name.toLowerCase().includes('chivas 12 yo 750ml')) || findP((p) => p.name.toLowerCase().includes('chivas'));
    }

    // 4. Beefeater
    if (allText.includes('beefeater')) {
      if (allText.includes('blood orange') || allText.includes('orange')) return findP((p) => p.name.toLowerCase().includes('blood orange')) || findP((p) => p.name.toLowerCase().includes('beefeater'));
      if (allText.includes('pink')) return findP((p) => p.name.toLowerCase().includes('pink gin')) || findP((p) => p.name.toLowerCase().includes('beefeater'));
      return findP((p) => p.name.toLowerCase().includes('beefeater gin 750ml')) || findP((p) => p.name.toLowerCase().includes('beefeater'));
    }

    // 5. Olmeca / Tequila / Margaritas
    if (allText.includes('olmeca') || allText.includes('tequila') || allText.includes('margarita') || allText.includes('batanga')) {
      if (allText.includes('choco')) return findP((p) => p.name.toLowerCase().includes('fusion choco')) || findP((p) => p.name.toLowerCase().includes('olmeca'));
      if (allText.includes('gold')) return findP((p) => p.name.toLowerCase().includes('olmeca gold') || p.name.toLowerCase().includes('tequila gold')) || findP((p) => p.name.toLowerCase().includes('olmeca'));
      return findP((p) => p.name.toLowerCase().includes('olmeca silver 700ml') || p.name.toLowerCase().includes('olmeca silver 1l')) || findP((p) => p.name.toLowerCase().includes('olmeca'));
    }

    // 6. Martell / Cognac / Brandy
    if (allText.includes('martell') || allText.includes('cognac') || allText.includes('martelito') || allText.includes('fine à l')) {
      if (allText.includes('blue swift')) return findP((p) => p.name.toLowerCase().includes('blue swift')) || findP((p) => p.name.toLowerCase().includes('martell'));
      if (allText.includes('vsop')) return findP((p) => p.name.toLowerCase().includes('martell vsop 700ml')) || findP((p) => p.name.toLowerCase().includes('martell'));
      return findP((p) => p.name.toLowerCase().includes('martell vs 700ml')) || findP((p) => p.name.toLowerCase().includes('martell'));
    }

    // 7. Malibu / Coconut Rum
    if (allText.includes('malibu') || (allText.includes('colada') && !allText.includes('havana'))) {
      return findP((p) => p.name.toLowerCase().includes('malibu'));
    }

    // 8. Havana Club / Spiced Rum / Bumbu
    if (allText.includes('havana') || allText.includes('cuba libre') || allText.includes('mojito') || spirit === 'rum') {
      if (allText.includes('7')) return findP((p) => p.name.toLowerCase().includes('havana club rum 7')) || findP((p) => p.name.toLowerCase().includes('havana'));
      return findP((p) => p.name.toLowerCase().includes('havana club') || p.name.toLowerCase().includes('bumbu') || p.name.toLowerCase().includes('malibu'));
    }

    // 9. The Glenlivet / Single Malt Scotch
    if (allText.includes('glenlivet') || allText.includes('matcha') || allText.includes('turmeric') || allText.includes('best in pour') || allText.includes('apple pop') || allText.includes('ndu by')) {
      return findP((p) => p.name.toLowerCase().includes('founders reserve 750ml') || p.name.toLowerCase().includes('the glenlivet 12 yo 750 ml') || p.name.toLowerCase().includes('glenlivet'));
    }

    // 10. Ballantine's / Blended Scotch
    if (allText.includes('ballantine') || allText.includes('old fashioned') || allText.includes('the godfather')) {
      return findP((p) => p.name.toLowerCase().includes("ballantine's whisky 10 yo") || p.name.toLowerCase().includes('ballantines finest whisky 750ml') || p.name.toLowerCase().includes('ballantine'));
    }

    // 11. Absolut / Vodka / Coffee Liqueur
    if (allText.includes('absolut') || allText.includes('vodka') || allText.includes('martini') || allText.includes('lemon drop') || allText.includes('orange shot') || spirit === 'vodka') {
      if (allText.includes('espresso') || allText.includes('coffee') || allText.includes('kahlua')) {
        return findP((p) => p.name.toLowerCase().includes('kahlua')) || findP((p) => p.name.toLowerCase().includes('absolut'));
      }
      if (allText.includes('citron') || allText.includes('lemon')) return findP((p) => p.name.toLowerCase().includes('citron')) || findP((p) => p.name.toLowerCase().includes('absolut'));
      if (allText.includes('mango')) return findP((p) => p.name.toLowerCase().includes('mango')) || findP((p) => p.name.toLowerCase().includes('absolut'));
      if (allText.includes('vanilla') || allText.includes('pornstar')) return findP((p) => p.name.toLowerCase().includes('vanilla')) || findP((p) => p.name.toLowerCase().includes('absolut'));
      return findP((p) => p.name.toLowerCase().includes('absolut vodka 750ml')) || findP((p) => p.name.toLowerCase().includes('absolut'));
    }

    // 12. Gin general fallback
    if (spirit === 'gin' || allText.includes('gin') || allText.includes('spritz') || allText.includes('tonic') || allText.includes('collins')) {
      return findP((p) => p.name.toLowerCase().includes('beefeater gin 750ml')) || findP((p) => p.name.toLowerCase().includes('malfy'));
    }

    // 13. Whiskey general fallback
    if (spirit === 'whiskey' || allText.includes('whiskey') || allText.includes('whisky') || allText.includes('sour')) {
      return findP((p) => p.name.toLowerCase().includes('jameson whiskey 750 ml')) || findP((p) => p.name.toLowerCase().includes('chivas 12 yo 750ml'));
    }

    // 14. Fallback to any matching spirit
    return products[0] || null;
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

  const handleAddToCart = () => {
    if (!matchedProduct || !onAddToCart) return;
    onAddToCart(matchedProduct.id);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
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
        {/* Sticky Header Image & Close */}
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

              {/* Metric vs Parts Toggle */}
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
          {matchedProduct && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-50 via-rose-50 to-amber-50/40 border border-pink-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-300 shadow-2xs">
              <div className="flex items-center gap-3">
                {matchedProduct.image && (
                  <img
                    src={matchedProduct.image}
                    alt={matchedProduct.name}
                    className="w-14 h-14 rounded-xl object-contain bg-white p-1 border border-pink-100 shadow-2xs shrink-0"
                  />
                )}
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#840038] block">
                    Featured Spirit in Stock
                  </span>
                  <h4 className="text-xs sm:text-sm font-bold text-gray-900 leading-snug">
                    {matchedProduct.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-black text-gray-900 font-mono">
                      KSh {Number(matchedProduct.price || 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.2 rounded-full">
                      In Stock
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-95 ${
                  added
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#840038] hover:bg-[#6b002c] text-white'
                }`}
              >
                <span>{added ? '✓ Added to Cart!' : '🛒 Add Spirit to Cart'}</span>
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
