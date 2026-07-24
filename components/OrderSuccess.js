'use client';

export default function OrderSuccess({ order, onNewOrder }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center"
        style={{ backgroundColor: '#f5f5dc', border: '1px solid #E9ECEF' }}
      >
        <svg
          className="w-16 h-16 mx-auto mb-4"
          style={{ color: '#840037' }}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <h2
          className="text-2xl font-bold mb-2"
          style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
        >
          Order Placed!
        </h2>
        <p
          className="mb-4"
          style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
        >
          Your order #{order.id} is being prepared
        </p>
        <div
          className="rounded-xl p-4 mb-6"
          style={{ backgroundColor: '#F1F3F5' }}
        >
          <div
            className="text-sm mb-1"
            style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
          >
            Estimated delivery
          </div>
          <div
            className="font-bold text-lg"
            style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
          >
            30-45 minutes
          </div>
        </div>
        <button
          onClick={onNewOrder}
          className="w-full rounded-xl py-4 text-lg font-bold transition-colors"
          style={{
            backgroundColor: '#840037',
            color: '#ffffff',
            fontFamily: 'Montserrat, sans-serif',
          }}
        >
          Order More Drinks
        </button>
      </div>
    </div>
  );
}
