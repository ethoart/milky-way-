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
    <div className="print-only w-[100mm] min-h-[150mm] p-6 bg-white text-black font-sans mx-auto border-2 border-black mb-4">
      {/* "To" Section */}
      <div className="mb-4">
        <p className="text-sm font-bold text-gray-700">To:</p>
        <h2 className="text-2xl font-black uppercase leading-tight mt-1">{order.customerName}</h2>
        <p className="text-sm font-bold mt-2 leading-relaxed whitespace-pre-wrap">{order.customerAddress}</p>
        <p className="text-xl font-black mt-2 tracking-tight">{order.customerPhone}</p>
      </div>

      {/* Dynamic COD Divider */}
      <div className="border-t-2 border-black border-dashed my-4"></div>

      {/* COD Amount - High Visibility */}
      <div className="py-2">
        <h1 className="text-5xl font-black tracking-tighter">
          COD: Rs.{order.totalAmount.toLocaleString()}
        </h1>
      </div>

      <div className="border-t-2 border-black border-dashed my-4"></div>

      {/* "From" Section */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-sm font-bold text-gray-700">From:</p>
          <p className="text-md font-black uppercase">{settings.shopName}</p>
          <p className="text-[10px] font-bold text-gray-600 max-w-[150px]">{settings.shopAddress}</p>
          <p className="text-sm font-black">{settings.shopPhone}</p>
          <p className="text-[10px] font-bold text-gray-400 mt-2">Ref: {order.id}</p>
        </div>

        {/* Small Return QR for Internal Scanning */}
        <div className="flex flex-col items-center gap-1">
          <div className="p-1 border border-black bg-white">
            <QRCode value={order.id} size={50} />
          </div>
          <span className="text-[8px] font-black uppercase">Internal Return Key</span>
        </div>
      </div>

      {/* Barcode Section - Bottom Centered */}
      <div className="mt-8 flex flex-col items-center justify-center border-t border-gray-100 pt-6">
        <Barcode 
          value={displayId} 
          width={2.2} 
          height={60} 
          fontSize={14} 
          font="monospace" 
          background="transparent"
          format="CODE128"
        />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-2">
          {order.trackingNumber ? 'Courier Waybill ID' : 'System Reference ID'}
        </p>
      </div>

      {/* Branding Footer */}
      <div className="mt-10 text-center opacity-30">
        <p className="text-[8px] font-black uppercase tracking-widest">
          Milky Way OMS Terminal • Print: {new Date().toLocaleString()}
        </p>
      </div>
    </div>
  );
};