'use client';

import Image from 'next/image';
import { haptic } from '@/lib/haptic';

export default function ProductCard({ product, quantity, onAdd, onIncrement, onDecrement }) {
  const outOfStock = product.inStock === false || product.stockQty === 0;

  const handleAdd = () => {
    if (outOfStock) return;
    haptic('light');
    onAdd();
  };

  const handleIncrement = () => {
    haptic('light');
    onIncrement();
  };

  const handleDecrement = () => {
    haptic('light');
    onDecrement();
  };

  return (
    <div
      className="group bg-white rounded-xl border shadow-sm overflow-hidden transition-all duration-300 flex flex-col hover:shadow-md h-full"
      style={{
        borderColor: outOfStock ? '#e5e7eb' : 'rgba(132, 0, 55, 0.2)',
        opacity: outOfStock ? 0.6 : 1,
      }}
    >
      <div className="aspect-square relative overflow-hidden bg-gray-50">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            loading="eager"
            className={`object-cover transition-transform duration-500 ${outOfStock ? 'grayscale blur-[2px] scale-105' : 'group-hover:scale-105'}`}
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl">🍹</div>
        )}
        {product.fast6 && !outOfStock && (
          <div className="absolute top-2 left-2 bg-[#840037] text-white text-[10px] font-bold px-2 py-1 rounded-sm shadow-sm">
            FAST 6
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-gray-900/70 text-white text-[11px] font-bold px-3 py-1.5 rounded-full" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              OUT OF STOCK
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-col flex-1 p-2 bg-white">
        <h3
          className={`text-[14px] ${outOfStock ? 'text-gray-400' : 'text-gray-900'}`}
          style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}
        >
          {product.name}
        </h3>
        <div className="mt-auto pt-1 flex flex-col gap-1.5">
          <span
            className={`text-[18px] font-bold ${outOfStock ? 'text-gray-400' : 'text-[#840037]'}`}
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            KSh {product.price.toLocaleString()}
          </span>

          {outOfStock ? (
            <div className="w-full py-1.5 rounded-full border border-gray-200 text-gray-400 text-[12px] text-center"
              style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
              Sold Out
            </div>
          ) : quantity === 0 ? (
            <button
              onClick={handleAdd}
              className="w-full py-1.5 rounded-full border text-[#840037] text-[12px] hover:bg-[#840037] hover:text-white transition-all active:scale-95"
              style={{
                borderColor: '#840037',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 600,
                letterSpacing: '0.05em',
              }}
            >
              QUICK ADD
            </button>
          ) : (
            <div
              className="flex items-center justify-between rounded-full overflow-hidden"
              style={{ backgroundColor: '#840037' }}
            >
              <button
                onClick={handleDecrement}
                className="flex-1 text-white text-lg font-bold hover:opacity-80 active:scale-95 transition-all h-8 flex items-center justify-center"
              >
                -
              </button>
              <span className="text-white font-bold text-sm px-3 min-w-[2rem] text-center">
                {quantity}
              </span>
              <button
                onClick={handleIncrement}
                className="flex-1 text-white text-lg font-bold hover:opacity-80 active:scale-95 transition-all h-8 flex items-center justify-center"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
