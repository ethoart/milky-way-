import React from 'react';
import Barcode from 'react-barcode';
import QRCode from 'react-qr-code';
import { Order, TenantSettings } from '../types';

interface LabelPrintViewProps {
  orders: Order[];
  settings: TenantSettings;
}

export const LabelPrintView: React.FC<LabelPrintViewProps> = ({ orders, settings }) => {
  return (
    <div className="print-only w-full bg-white text-black font-sans p-0">
      <style>{`
        @page { margin: 0; size: auto; }
        @media print {
            body { margin: 0; padding: 0; }
            .label-page { page-break-after: always; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(3, 1fr); height: 100vh; width: 100vw; }
            .label-item { border: 1px solid #eee; padding: 25px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
        }
      `}</style>
      
      {/* Chunk orders into groups of 6 for grid printing */}
      {Array.from({ length: Math.ceil(orders.length / 6) }).map((_, pageIdx) => (
        <div key={pageIdx} className="label-page">
          {orders.slice(pageIdx * 6, (pageIdx + 1) * 6).map((order) => {
            const displayId = order.trackingNumber || order.id;
            return (
              <div key={order.id} className="label-item">
                {/* To Section */}
                <div>
                  <p className="text-sm font-medium mb-1">To:</p>
                  <h2 className="text-xl font-black uppercase leading-tight">{order.customerName}</h2>
                  <p className="text-sm font-bold mt-1 leading-relaxed max-h-[60px] overflow-hidden">{order.customerAddress}</p>
                  <p className="text-lg font-black mt-2 tracking-tight">{order.customerPhone}</p>
                </div>

                {/* COD Section - PDF Style */}
                <div className="border-y-2 border-black border-dashed py-4 my-2">
                  <h1 className="text-4xl font-black tracking-tighter">
                    COD: Rs.{order.totalAmount.toLocaleString()}
                  </h1>
                </div>

                {/* From & Return QR Row */}
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-medium">From:</p>
                    <p className="text-sm font-black uppercase">{settings.shopName}</p>
                    <p className="text-[10px] font-bold text-gray-500">{settings.shopAddress}</p>
                    <p className="text-[10px] font-black">{settings.shopPhone}</p>
                    <p className="text-[9px] font-bold text-gray-400 mt-1">Ref: {order.id.slice(-12)}</p>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="p-1 border border-black">
                        <QRCode value={order.id} size={42} />
                    </div>
                    <span className="text-[7px] font-black uppercase text-gray-400 mt-1">Return</span>
                  </div>
                </div>

                {/* Barcode Section */}
                <div className="flex flex-col items-center pt-2">
                  <Barcode 
                    value={displayId} 
                    width={1.8} 
                    height={45} 
                    fontSize={12} 
                    font="monospace" 
                    background="transparent"
                    format="CODE128"
                  />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-1">{displayId}</p>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};