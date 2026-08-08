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
  const template = settings.billTemplate || 'portrait-classic';

  // 1. Classic Portrait Template (Original current design)
  if (template === 'portrait-classic') {
    return (
      <div className="print-only w-[69mm] h-[98mm] p-4 bg-white text-black font-sans border border-gray-400 box-border overflow-hidden flex flex-col justify-between">
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium">To:</p>
          <div className="text-[12px] leading-tight uppercase">
            <span className="font-black">{order.customerName}</span>
            <span className="font-black ml-1 text-[10px]">({productName})</span>
          </div>
          <p className="text-[10px] font-normal leading-relaxed whitespace-pre-wrap mt-1">
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
  }

  // 2. Compact Thermal Portrait Template (Elegant vertical thermal style receipt)
  if (template === 'portrait-compact') {
    return (
      <div className="print-only w-[69mm] h-[98mm] p-3.5 bg-white text-black font-mono border border-black box-border overflow-hidden flex flex-col justify-between">
        {/* Compact shop header */}
        <div className="text-center border-b border-dashed border-black pb-1.5">
          <h2 className="text-[13px] font-black tracking-tight uppercase leading-none">{settings.shopName}</h2>
          <p className="text-[8px] font-bold text-gray-700 truncate mt-0.5">{settings.shopAddress}</p>
          <p className="text-[9px] font-black mt-0.5">{settings.shopPhone}</p>
        </div>
        
        {/* Delivery target */}
        <div className="space-y-0.5 mt-1.5 flex-1">
          <div className="flex justify-between items-start text-[8px] uppercase font-bold text-gray-500">
            <span>SHIPPING TARGET</span>
            <span>REF: {order.id.slice(0, 8)}</span>
          </div>
          <div className="text-[11px] font-black uppercase mt-1">
            {order.customerName}
          </div>
          <p className="text-[9px] font-bold leading-tight mt-0.5 line-clamp-2">
            {order.customerAddress} {order.customerCity ? `[${order.customerCity.toUpperCase()}]` : ''}
          </p>
          <p className="text-[11px] font-black leading-none mt-1">
            {order.customerPhone}{order.customerPhone2 ? ` / ${order.customerPhone2}` : ''}
          </p>
        </div>

        {/* Dynamic Items list */}
        <div className="border-t border-dashed border-black pt-1.5 my-1">
          <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase">
            <span>SKU / PRODUCT</span>
            <span>QTY</span>
          </div>
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-[9px] font-black uppercase mt-0.5 leading-none">
              <span className="truncate max-w-[170px]">{item.name}</span>
              <span>x{item.quantity}</span>
            </div>
          ))}
        </div>

        {/* High Contrast COD Box */}
        <div className="border-t-2 border-black pt-1.5">
          <div className="bg-black text-white p-2 text-center rounded">
            <p className="text-[8px] font-black uppercase tracking-wider text-gray-300">CASH ON DELIVERY</p>
            <h1 className="text-[15px] font-black mt-0.5 tracking-tight leading-none">
              Rs. {order.totalAmount.toLocaleString()}
            </h1>
          </div>
        </div>

        {/* Condensed barcode */}
        <div className="mt-1 flex flex-col items-center justify-center">
          <Barcode 
            value={displayId} 
            width={0.9} 
            height={28} 
            fontSize={8} 
            font="monospace" 
            background="transparent"
            format="CODE128"
            margin={0}
          />
        </div>
      </div>
    );
  }

  // 3. Landscape Waybill Template (Horizontal Logistics Waybill)
  return (
    <div className="print-only w-[98mm] h-[69mm] p-3 bg-white text-black font-sans border-2 border-black box-border overflow-hidden flex flex-row gap-3">
      {/* Left Column (Shipping details) */}
      <div className="w-[58%] flex flex-col justify-between border-r border-gray-300 pr-2">
        <div>
          <div className="flex justify-between items-center border-b border-black pb-1 mb-1.5">
            <span className="text-[8px] font-black uppercase bg-black text-white px-1.5 py-0.5 rounded">WAYBILL LABEL</span>
            <span className="text-[8px] font-bold text-gray-500">REF: {order.id.slice(0, 8)}</span>
          </div>
          <p className="text-[8px] font-bold text-gray-500 uppercase">RECIPIENT:</p>
          <p className="text-[11px] font-black uppercase leading-tight mt-0.5">{order.customerName}</p>
          <p className="text-[9px] font-normal leading-tight whitespace-pre-wrap mt-1 text-gray-800 line-clamp-2">
            {order.customerAddress} {order.customerCity ? `[${order.customerCity.toUpperCase()}]` : ''}
          </p>
          <p className="text-[11px] font-black mt-1.5 leading-none">
            {order.customerPhone}{order.customerPhone2 ? ` / ${order.customerPhone2}` : ''}
          </p>
        </div>

        {/* Items descriptor */}
        <div className="border-t border-gray-200 pt-1.5">
          <div className="flex justify-between text-[8px] font-black text-gray-500 uppercase leading-none">
            <span>PRODUCT INFO</span>
            <span>QTY</span>
          </div>
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-[9px] font-black uppercase mt-1 leading-none text-gray-900">
              <span className="truncate max-w-[110px]">{item.name}</span>
              <span>x{item.quantity}</span>
            </div>
          ))}
        </div>

        {/* Sender Info */}
        <div className="border-t border-gray-200 pt-1 mt-1 text-[8px] text-gray-600 leading-tight">
          <p className="font-bold uppercase text-black">SENDER: {settings.shopName}</p>
          <p className="truncate">{settings.shopAddress} ({settings.shopPhone})</p>
        </div>
      </div>

      {/* Right Column (COD amount box and Barcode) */}
      <div className="w-[42%] flex flex-col justify-between items-stretch">
        {/* Large COD Block */}
        <div className="border-2 border-black p-2 rounded-lg text-center bg-gray-50 flex flex-col justify-center">
          <p className="text-[8px] font-black uppercase tracking-wider text-gray-600">CASH ON DELIVERY</p>
          <h2 className="text-[15px] font-black text-black mt-1 leading-none">
            Rs. {order.totalAmount.toLocaleString()}
          </h2>
        </div>

        {/* Professional Barcode */}
        <div className="flex flex-col items-center justify-center flex-grow mt-1.5">
          <Barcode 
            value={displayId} 
            width={0.9} 
            height={32} 
            fontSize={8} 
            font="monospace" 
            background="transparent"
            format="CODE128"
            margin={0}
          />
          <p className="text-[8px] font-black uppercase tracking-wider mt-1 text-center">
            {displayId}
          </p>
        </div>

        {/* Stamp registry */}
        <div className="text-center opacity-40 border-t border-dashed border-gray-300 pt-1">
          <p className="text-[6px] font-black uppercase tracking-widest">Milky Way Logistics Hub</p>
        </div>
      </div>
    </div>
  );
};
