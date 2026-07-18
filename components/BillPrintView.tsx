
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
  
  // Base font size for customer details
  const detailSize = "text-[12px]";

  return (
    <div className="print-only w-[69mm] h-[98mm] p-4 bg-white text-black font-sans border border-gray-400 box-border overflow-hidden flex flex-col justify-between">
      <div className="space-y-0.5">
        <p className="text-[10px] font-medium">To:</p>
        <div className={`${detailSize} leading-tight uppercase`}>
          <span className="font-black">{order.customerName}</span>
          <span className="font-black ml-1 text-[10px]">({productName})</span>
        </div>
        <p className={`text-[10px] font-normal leading-relaxed whitespace-pre-wrap mt-1`}>
          {order.customerAddress} {order.customerCity ? `[${order.customerCity.toUpperCase()}]` : ''}
        </p>
        <div className="mt-2">
            <p className="text-[14px] font-black tracking-tight leading-none">
              {order.customerPhone}{order.customerPhone2 ? ` / ${order.customerPhone2}` : ''}
            </p>
        </div>
      </div>

      <div className="mt-2 mb-2">
        <h1 className="text-[20px] font-black tracking-tighter leading-none text-center border-y-2 border-black py-1">
          COD: Rs.{order.totalAmount.toLocaleString()}
        </h1>
      </div>

      <div className="space-y-0.5 mt-1">
        <p className="text-[10px] font-medium">From:</p>
        <p className="text-[12px] font-black uppercase leading-tight">{settings.shopName}</p>
        <p className="text-[9px] font-bold text-gray-600 truncate">{settings.shopAddress}</p>
        <p className="text-[10px] font-black">{settings.shopPhone}</p>
        <div className="flex justify-between items-end mt-1">
            <p className="text-[8px] font-bold text-gray-400">Ref: {order.id.slice(0,8)}</p>
            {order.trackingNumber && <p className="text-[8px] font-black text-blue-600 uppercase">Waybill Locked</p>}
        </div>
      </div>

      <div className="mt-2 flex flex-col items-center justify-center flex-grow">
        <Barcode 
          value={displayId} 
          width={1.2} 
          height={40} 
          fontSize={10} 
          font="monospace" 
          background="transparent"
          format="CODE128"
          margin={0}
        />
        <p className="text-[9px] font-black uppercase tracking-[0.2em] mt-1">
          {displayId}
        </p>
      </div>
      
      <div className="mt-1 text-center opacity-30">
        <p className="text-[7px] font-black uppercase tracking-widest">Milky Way OMS Registry</p>
      </div>
    </div>
  );
};
