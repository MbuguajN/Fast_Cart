'use client';

export default function FloatingCheckout({ cart, products, onCheckout, hidden }) {
  if (cart.length === 0 || hidden) return null;

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.id);
    if (!product) return sum;
    if (item.variantId) {
      const variant = product.variations?.find((v) => v.wcId === item.variantId);
      return sum + (variant ? parseFloat(variant.price) * item.quantity : product.price * item.quantity);
    }
    return sum + (product.price * item.quantity);
  }, 0);

  return (
    <div className="fixed bottom-[80px] left-0 w-full z-[60] px-4 pointer-events-none flex justify-center">
      <button
        onClick={onCheckout}
        className="bg-[#840037] text-white rounded-full px-5 py-3 flex items-center justify-between w-full max-w-sm pointer-events-auto active:scale-[0.98] transition-transform"
        style={{ boxShadow: '0 8px 20px rgba(132,0,55,0.3)' }}
      >
        <div className="flex flex-col items-start">
          <span
            className="text-[10px] font-bold text-white/80 uppercase tracking-wider"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            {totalItems} ITEM{totalItems !== 1 ? 'S' : ''}
          </span>
          <span
            className="text-[16px] font-bold text-white leading-none mt-0.5"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            KSh {totalPrice.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[14px] font-bold uppercase"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            View Cart
          </span>
          <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 12h14m-7-7l7 7-7 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>
    </div>
  );
}
