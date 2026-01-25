
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
        @page { 
          margin: 0 !important; 
          size: A4 portrait;
        }
        @media print {
            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
            .label-page { 
                page-break-after: always; 
                display: grid; 
                grid-template-columns: 1fr 1fr; 
                grid-template-rows: repeat(3, 1fr); 
                height: 297mm; /* Standard A4 Height */
                width: 210mm;  /* Standard A4 Width */
                margin: 0 auto;
            }
            .label-item { 
                border: 0.5pt solid #eee; 
                padding: 10mm; 
                display: flex; 
                flex-direction: column; 
                justify-content: space-between; 
                overflow: hidden;
                box-sizing: border-box;
                height: 100%;
            }
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
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] font-bold uppercase text-gray-400">Recipient</p>
                    <span className="text-[9px] font-black text-gray-300"># {order.id.slice(-6)}</span>
                  </div>
                  <h2 className="text-xl font-black uppercase leading-tight">{order.customerName}</h2>
                  <p className="text-[11px] font-bold mt-1 leading-relaxed max-h-[45px] overflow-hidden">{order.customerAddress}</p>
                  <p className="text-xl font-black mt-3 tracking-tighter">{order.customerPhone}</p>
                </div>

                {/* COD Section - Striking Header */}
                <div className="border-y-2 border-black border-dashed py-3 my-2 text-center">
                  <span className="text-[8px] font-black uppercase tracking-widest block mb-1">Collect On Delivery</span>
                  <h1 className="text-3xl font-black tracking-tighter">
                    Rs.{order.totalAmount.toLocaleString()}
                  </h1>
                </div>

                {/* Logistics Metadata */}
                <div className="flex justify-between items-end">
                  <div className="space-y-0.5">
                    <p className="text-[8px] font-bold uppercase text-gray-400">Shipper</p>
                    <p className="text-[11px] font-black uppercase">{settings.shopName}</p>
                    <p className="text-[8px] font-bold text-gray-500 leading-none">{settings.shopAddress}</p>
                    <p className="text-[9px] font-black mt-1">{settings.shopPhone}</p>
                  </div>

                  {settings.showBillQr && (
                    <div className="flex flex-col items-center">
                      <div className="p-0.5 border border-black bg-white">
                          <QRCode value={order.id} size={38} />
                      </div>
                      <span className="text-[6px] font-black uppercase text-gray-400 mt-0.5">Return Key</span>
                    </div>
                  )}
                </div>

                {/* Scannable Block */}
                <div className="flex flex-col items-center pt-2">
                  <Barcode 
                    value={displayId} 
                    width={1.5} 
                    height={40} 
                    fontSize={10} 
                    font="monospace" 
                    background="transparent"
                    format="CODE128"
                  />
                  <p className="text-[8px] font-black uppercase tracking-[0.4em] mt-1 text-gray-400">{displayId}</p>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
