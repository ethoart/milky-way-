
import React from 'react';
import Barcode from 'react-barcode';
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
                height: 297mm;
                width: 210mm;
                margin: 0 auto;
            }
            .label-item { 
                border: 0.2pt dashed #bbb; /* Distinct Cutting Margin */
                padding: 10mm 8mm; 
                display: flex; 
                flex-direction: column; 
                justify-content: flex-start; 
                overflow: hidden;
                box-sizing: border-box;
                height: 100%;
                background: white;
            }
        }
      `}</style>
      
      {Array.from({ length: Math.ceil(orders.length / 6) }).map((_, pageIdx) => (
        <div key={pageIdx} className="label-page">
          {orders.slice(pageIdx * 6, (pageIdx + 1) * 6).map((order) => {
            const displayId = order.trackingNumber || order.id;
            const productName = order.items[0]?.name || 'Item';
            
            return (
              <div key={order.id} className="label-item">
                {/* To Section */}
                <div className="space-y-0.5">
                  <p className="text-[14px] font-normal">To:</p>
                  <h2 className="text-[20px] font-black leading-tight uppercase">
                    {order.customerName} ({productName})
                  </h2>
                  <p className="text-[14px] font-bold leading-tight mt-1">{order.customerAddress}</p>
                  <p className="text-[20px] font-black mt-2 tracking-tighter">{order.customerPhone}</p>
                </div>

                {/* COD Section */}
                <div className="mt-5 mb-3">
                  <h1 className="text-[36px] font-black tracking-tighter leading-none">
                    COD: Rs.{order.totalAmount.toLocaleString()}
                  </h1>
                </div>

                <div className="border-t-[1.5pt] border-black border-dashed my-3 w-full opacity-60"></div>

                {/* From Section */}
                <div className="flex-1 space-y-0.5">
                  <p className="text-[14px] font-normal">From:</p>
                  <p className="text-[15px] font-black uppercase">{settings.shopName}</p>
                  <p className="text-[12px] font-bold text-gray-700 leading-tight">{settings.shopAddress}</p>
                  <p className="text-[13px] font-black">{settings.shopPhone}</p>
                  <p className="text-[11px] font-bold text-gray-400 mt-2 uppercase tracking-tight">Ref: {order.id}</p>
                </div>

                {/* Barcode Section */}
                <div className="flex flex-col items-center pt-4">
                  <Barcode 
                    value={displayId} 
                    width={1.8} 
                    height={55} 
                    fontSize={14} 
                    font="monospace" 
                    background="transparent"
                    format="CODE128"
                  />
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] mt-1">
                    {displayId}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
