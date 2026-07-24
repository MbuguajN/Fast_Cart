'use client';

export default function ActionBar({ cart, products, onCheckout }) {
  if (cart.length === 0) return null;

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.id);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);

  return (
    <div
      className="fixed bottom-0 left-0 w-full z-[60] p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between max-w-7xl mx-auto md:left-1/2 md:-translate-x-1/2 ambient-shadow-lg"
      style={{ backgroundColor: '#f5f5dc', borderRadius: '0.75rem 0.75rem 0 0' }}
    >
      <div className="flex justify-between items-center md:flex-col md:items-start md:gap-0">
        <div className="flex flex-col">
          <span
            className="text-[11px]"
            style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, letterSpacing: '0.05em' }}
          >
            {totalItems} ITEMS
          </span>
          <span
            className="text-[20px]"
            style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}
          >
            KSh {totalPrice.toLocaleString()}
          </span>
        </div>
        <button
          className="text-[13px] underline underline-offset-4 active:opacity-70 transition-opacity"
          style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}
        >
          View Cart
        </button>
      </div>
      <button
        onClick={onCheckout}
        className="flex flex-col items-center justify-center text-white py-3 rounded-xl active:scale-[0.98] transition-all ambient-shadow group md:px-12"
        style={{ backgroundColor: '#840037' }}
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
          </svg>
          <span
            className="text-[16px] font-bold tracking-tight"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            1-TAP CHECKOUT
          </span>
        </div>
        <span
          className="text-[9px] font-medium opacity-80"
          style={{ fontFamily: 'Montserrat, sans-serif' }}
        >
          (Apple Pay / M-Pesa)
        </span>
      </button>
    </div>
  );
}
