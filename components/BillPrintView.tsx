
import React from 'react';
import Barcode from 'react-barcode';
import { Order, TenantSettings } from '../types';

interface BillPrintViewProps {
  order: Order;
  settings: TenantSettings;
}

export const BillPrintView: React.FC<BillPrintViewProps> = ({ order, settings }) => {
  const displayId = order.trackingNumber || order.id;
  const productName = order.items[0]?.name || 'Product';
  
  return (
    <div className="print-only w-[105mm] min-h-[148mm] p-10 bg-white text-black font-sans mx-auto border border-gray-200 mb-10 box-border">
      {/* To Section */}
      <div className="space-y-1">
        <p className="text-[14px] font-medium">To:</p>
        <h2 className="text-[22px] font-black uppercase leading-tight">
          {order.customerName} ({productName})
        </h2>
        <p className="text-[15px] font-bold leading-relaxed whitespace-pre-wrap">{order.customerAddress}</p>
        <p className="text-[22px] font-black mt-2 tracking-tighter">{order.customerPhone}</p>
      </div>

      <div className="mt-6 mb-4">
        <h1 className="text-[42px] font-black tracking-tighter">
          COD: Rs.{order.totalAmount.toLocaleString()}
        </h1>
      </div>

      <div className="border-t-[2pt] border-black border-dashed my-6"></div>

      {/* From Section */}
      <div className="space-y-1">
        <p className="text-[14px] font-medium">From:</p>
        <p className="text-[16px] font-black uppercase">{settings.shopName}</p>
        <p className="text-[12px] font-bold text-gray-600 max-w-[250px]">{settings.shopAddress}</p>
        <p className="text-[14px] font-black">{settings.shopPhone}</p>
        <p className="text-[10px] font-bold text-gray-400 mt-4">Ref: {order.id}</p>
      </div>

      {/* Barcode */}
      <div className="mt-16 flex flex-col items-center justify-center">
        <Barcode 
          value={displayId} 
          width={2.2} 
          height={75} 
          fontSize={14} 
          font="monospace" 
          background="transparent"
          format="CODE128"
        />
        <p className="text-[12px] font-black uppercase tracking-[0.4em] mt-3">
          {displayId}
        </p>
      </div>
      
      <div className="mt-10 text-center opacity-20">
        <p className="text-[10px] font-black uppercase tracking-widest">Milky Way Terminal Registry</p>
      </div>
    </div>
  );
};
