
import React from 'react';
import Barcode from 'react-barcode';
import QRCode from 'react-qr-code';
import { Order, TenantSettings } from '../types';

interface BillPrintViewProps {
  order: Order;
  settings: TenantSettings;
}

export const BillPrintView: React.FC<BillPrintViewProps> = ({ order, settings }) => {
  // Use Tracking Number if available, otherwise fall back to System ID
  const displayId = order.trackingNumber || order.id;
  
  return (
    <div className="print-only w-[100mm] min-h-[140mm] p-8 bg-white text-black font-sans mx-auto border border-gray-200 mb-10">
      {/* To Section */}
      <div className="mb-4">
        <p className="text-sm font-medium">To:</p>
        <h2 className="text-2xl font-black uppercase leading-tight mt-1">{order.customerName}</h2>
        <p className="text-md font-bold mt-1 leading-relaxed whitespace-pre-wrap">{order.customerAddress}</p>
        <p className="text-xl font-black mt-2">{order.customerPhone}</p>
      </div>

      <div className="border-t-2 border-black border-dashed my-6"></div>

      {/* COD Amount - Matches PDF Screenshot style */}
      <div className="py-2">
        <h1 className="text-5xl font-black tracking-tight">
          COD: Rs.{order.totalAmount.toLocaleString()}
        </h1>
      </div>

      <div className="border-t-2 border-black border-dashed my-6"></div>

      {/* From Section */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-sm font-medium">From:</p>
          <p className="text-md font-black uppercase">{settings.shopName}</p>
          <p className="text-[11px] font-bold text-gray-600 max-w-[200px]">{settings.shopAddress}</p>
          <p className="text-sm font-black">{settings.shopPhone}</p>
          <p className="text-[10px] font-bold text-gray-400 mt-2">Ref: {order.id}</p>
        </div>

        {/* Small Return QR side-by-side on bill for faster processing */}
        {settings.showBillQr && (
          <div className="flex flex-col items-center gap-1">
            <div className="p-1 border border-black bg-white">
              <QRCode value={order.id} size={50} />
            </div>
            <span className="text-[8px] font-black uppercase text-gray-400">Return Key</span>
          </div>
        )}
      </div>

      {/* Bottom Barcode - Matches PDF Screenshot */}
      <div className="mt-12 flex flex-col items-center justify-center">
        <Barcode 
          value={displayId} 
          width={2.2} 
          height={65} 
          fontSize={14} 
          font="monospace" 
          background="transparent"
          format="CODE128"
        />
        <p className="text-[11px] font-black uppercase tracking-[0.4em] mt-2">
          {order.trackingNumber ? order.trackingNumber : order.id}
        </p>
      </div>
      
      <div className="mt-8 text-center opacity-20">
        <p className="text-[8px] font-black uppercase tracking-widest">Milky Way Terminal • {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
};
