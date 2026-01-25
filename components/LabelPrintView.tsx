
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
            body { 
              margin: 0; 
              padding: 0; 
              -webkit-print-color-adjust: exact; 
            }
            * {
              box-sizing: border-box;
            }
            .label-page { 
                page-break-after: always; 
                display: grid; 
                grid-template-columns: 1fr 1fr; 
                grid-template-rows: repeat(3, 1fr); 
                height: 297mm;
                width: 210mm;
                margin: 0 auto;
                overflow: hidden;
            }
            .label-item { 
                border: 0.1pt dashed #ccc; /* Thinner cutting guide */
                padding: 6mm 7mm; /* Reduced padding to fit 2x3 better */
                display: flex; 
                flex-direction: column; 
                justify-content: space-between; 
                overflow: hidden;
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
                <div className="flex flex-col gap-1">
                  {/* To Section */}
                  <div className="space-y-0.5">
                    <p className="text-[12px] font-normal leading-none">To:</p>
                    <h2 className="text-[17px] font-black leading-tight uppercase truncate">
                      {order.customerName} ({productName})
                    </h2>
                    <p className="text-[12px] font-bold leading-tight mt-1 line-clamp-2">
                      {order.customerAddress}
                    </p>
                    <p className="text-[19px] font-black mt-1 tracking-tighter">
                      {order.customerPhone}
                    </p>
                  </div>

                  {/* COD Section */}
                  <div className="mt-2 mb-1">
                    <h1 className="text-[28px] font-black tracking-tighter leading-none">
                      COD: Rs.{order.totalAmount.toLocaleString()}
                    </h1>
                  </div>

                  <div className="border-t-[1pt] border-black border-dashed my-2 w-full opacity-40"></div>

                  {/* From Section */}
                  <div className="space-y-0.5">
                    <p className="text-[12px] font-normal leading-none">From:</p>
                    <p className="text-[14px] font-black uppercase leading-tight truncate">{settings.shopName}</p>
                    <p className="text-[10px] font-bold text-gray-700 leading-tight line-clamp-1">{settings.shopAddress}</p>
                    <p className="text-[11px] font-black leading-none">{settings.shopPhone}</p>
                    <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-tighter">Ref: {order.id}</p>
                  </div>
                </div>

                {/* Barcode Section - Positioned at bottom of cell */}
                <div className="flex flex-col items-center mt-auto">
                  <Barcode 
                    value={displayId} 
                    width={1.5} 
                    height={42} /* Reduced height significantly to avoid cropping */
                    fontSize={12} 
                    font="monospace" 
                    background="transparent"
                    format="CODE128"
                  />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-0.5 leading-none">
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
