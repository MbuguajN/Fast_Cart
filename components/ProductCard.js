'use client';

import Image from 'next/image';
import { haptic } from '@/lib/haptic';

export default function ProductCard({ product, quantity, onAdd, onIncrement, onDecrement }) {
  const handleAdd = () => {
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
      className="group rounded-xl border overflow-hidden flex flex-col transition-all duration-300"
      style={{
        backgroundColor: '#f5f5dc',
        borderColor: '#E9ECEF',
      }}
    >
      <div
        className="aspect-square relative overflow-hidden"
        style={{ backgroundColor: '#f5f5dc' }}
      >
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        {product.fast6 && (
          <div
            className="absolute top-2 left-2 text-white text-[10px] font-bold px-2 py-1 rounded-sm"
            style={{ backgroundColor: '#840037' }}
          >
            FAST 6
          </div>
        )}
      </div>
      <div className="flex flex-col flex-grow p-2">
        <h3
          className="text-[14px] line-clamp-1"
          style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}
        >
          {product.name}
        </h3>
        <p
          className="text-[11px]"
          style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
        >
          {product.size}
        </p>
        <div className="mt-1 flex flex-col gap-1.5">
          <span
            className="text-[18px]"
            style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}
          >
            KSh {product.price.toLocaleString()}
          </span>

          {quantity === 0 ? (
            <button
              onClick={handleAdd}
              className="w-full py-1.5 rounded-full border-2 text-[12px] font-semibold transition-all active:scale-95"
              style={{
                borderColor: '#840037',
                color: '#840037',
                fontFamily: 'Montserrat, sans-serif',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#840037';
                e.target.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = '#840037';
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
