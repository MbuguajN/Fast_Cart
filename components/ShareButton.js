'use client';

import { useState } from 'react';
import { shareProduct } from '@/lib/social-share';
import { haptic } from '@/lib/haptic';

export default function ShareButton({ product, variant = 'icon', className = '' }) {
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleShare = async (e, platform = 'native') => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    haptic('light');

    const res = await shareProduct(product, { platform });
    if (res.method === 'clipboard' && res.success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  if (variant === 'bar') {
    return (
      <div className={`flex flex-col gap-2.5 ${className}`}>
        <div className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          <svg className="w-4 h-4 text-[#840037]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span>Share with Friends</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* WhatsApp Direct */}
          <button
            onClick={(e) => handleShare(e, 'whatsapp')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold shadow-sm transition-all active:scale-95"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.971.53 1.77.813 2.796.813 3.179 0 5.767-2.587 5.767-5.766.001-3.181-2.587-5.767-5.767-5.767zm3.391 8.188c-.141.396-.708.73-1.018.775-.297.042-.68.077-2.18-.545-1.916-.793-3.136-2.738-3.232-2.865-.094-.127-.768-1.021-.768-1.946 0-.924.484-1.378.656-1.564.172-.187.375-.234.5-.234.126 0 .25.001.359.006.115.006.27-.044.423.324.156.376.532 1.298.578 1.392.047.094.078.204.016.329-.063.125-.094.203-.188.313-.094.109-.198.244-.282.328-.094.094-.192.196-.083.383.11.188.487.804 1.047 1.303.72.641 1.326.839 1.514.933.188.094.298.078.407-.047.11-.125.469-.547.594-.734.125-.187.25-.156.422-.094.172.062 1.094.516 1.282.609.188.094.313.141.359.219.047.078.047.453-.094.849z"/>
            </svg>
            <span>WhatsApp</span>
          </button>

          {/* Copy Link */}
          <button
            onClick={(e) => handleShare(e, 'clipboard')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs font-bold transition-all active:scale-95 ${
              copied
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-[#840037] hover:text-[#840037]'
            }`}
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span>Copy Link</span>
              </>
            )}
          </button>

          {/* X / Twitter */}
          <button
            onClick={(e) => handleShare(e, 'twitter')}
            className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-700 hover:text-black transition-all active:scale-95"
            title="Share on X"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </button>

          {/* Native OS Share Sheet */}
          <button
            onClick={(e) => handleShare(e, 'native')}
            className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-700 hover:text-[#840037] transition-all active:scale-95"
            title="More Share Options"
          >
            <svg className="w-4 h-4 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Default: discrete icon button for ProductCard
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={(e) => handleShare(e, 'native')}
        className="w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200/80 shadow-sm flex items-center justify-center text-gray-600 hover:text-[#840037] hover:bg-white hover:scale-110 active:scale-95 transition-all"
        title="Share Product"
        aria-label="Share product"
      >
        {copied ? (
          <svg className="w-3.5 h-3.5 text-green-600 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        )}
      </button>

      {copied && (
        <div className="absolute right-0 -top-8 bg-gray-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap animate-fade-in z-30">
          Copied!
        </div>
      )}
    </div>
  );
}

