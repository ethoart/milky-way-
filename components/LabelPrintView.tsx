import React from 'react';
import Barcode from 'react-barcode';
import { Order, TenantSettings } from '../types';

interface LabelPrintViewProps {
  orders: Order[];
  settings: TenantSettings;
}

export const LabelPrintView: React.FC<LabelPrintViewProps> = ({ orders, settings }) => {
  const template = settings.billTemplate || 'portrait-classic';
  const itemsPerPage = template === 'landscape-waybill' ? 8 : 9;

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
            height: 297mm;
            width: 210mm;
            margin: 0 auto;
            overflow: hidden;
            background: white;
          }
          .grid-3x3 {
            grid-template-columns: repeat(3, 1fr); 
            grid-template-rows: repeat(3, 1fr); 
          }
          .grid-2x4 {
            grid-template-columns: repeat(2, 1fr); 
            grid-template-rows: repeat(4, 1fr); 
          }
          .label-item-classic { 
            border: 0.1pt dashed #ddd;
            padding: 4mm 4mm; 
            display: flex; 
            flex-direction: column; 
            justify-content: space-between; 
            overflow: hidden;
            height: 99mm;
            background: white;
          }
          .label-item-clean-logistics { 
            border: 0.1pt dashed #bbb;
            padding: 4mm 4mm; 
            display: flex; 
            flex-direction: column; 
            justify-content: space-between; 
            overflow: hidden;
            height: 99mm;
            background: white;
            font-family: sans-serif;
          }
          .label-item-compact { 
            border: 0.1pt dashed #999;
            padding: 3.5mm 3.5mm; 
            display: flex; 
            flex-direction: column; 
            justify-content: space-between; 
            overflow: hidden;
            height: 99mm;
            background: white;
            font-family: monospace;
          }
          .label-item-waybill { 
            border: 0.1pt dashed #666;
            padding: 3mm 4mm; 
            display: flex; 
            flex-direction: row; 
            justify-content: space-between; 
            overflow: hidden;
            height: 74.25mm;
            background: white;
            gap: 3mm;
          }
        }
      `}</style>
      
      {Array.from({ length: Math.ceil(orders.length / itemsPerPage) }).map((_, pageIdx) => (
        <div 
          key={pageIdx} 
          className={`label-page ${template === 'landscape-waybill' ? 'grid-2x4' : 'grid-3x3'}`}
        >
          {orders.slice(pageIdx * itemsPerPage, (pageIdx + 1) * itemsPerPage).map((order) => {
            const displayId = order.trackingNumber || order.id;
            const productName = order.items[0]?.name || 'Product';

            // --- 1. Classic Portrait Label ---
            if (template === 'portrait-classic') {
              return (
                <div key={order.id} className="label-item-classic">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-medium text-gray-500">To:</p>
                    <div className="text-[12px] leading-tight uppercase">
                      <span className="font-black">{order.customerName}</span>
                      <span className="font-black ml-1 text-[10px]">({productName})</span>
                    </div>
                    <p className="text-[10px] font-normal leading-relaxed whitespace-pre-wrap mt-1 text-gray-800">
                      {order.customerAddress} {order.customerCity ? `[${order.customerCity.toUpperCase()}]` : ''}
                    </p>
                    <div className="mt-2">
                      <p className="text-[13px] font-black tracking-tight leading-none text-black">
                        {order.customerPhone}{order.customerPhone2 ? ` / ${order.customerPhone2}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="my-1">
                    <h1 className="text-[18px] font-black tracking-tighter leading-none text-center border-y-2 border-black py-1">
                      COD: Rs.{order.totalAmount.toLocaleString()}
                    </h1>
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-[9px] font-medium text-gray-500">From:</p>
                    <p className="text-[11px] font-black uppercase leading-tight text-gray-900 truncate">{settings.shopName}</p>
                    <p className="text-[8px] font-bold text-gray-600 truncate">{settings.shopAddress}</p>
                    <p className="text-[9px] font-black text-gray-900">{settings.shopPhone}</p>
                    <div className="flex justify-between items-end mt-0.5">
                      <p className="text-[7px] font-bold text-gray-400">Ref: {order.id.slice(0, 8)}</p>
                      {order.trackingNumber && <p className="text-[7px] font-black text-blue-600 uppercase">Waybill Locked</p>}
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center pt-1">
                    <Barcode 
                      value={displayId} 
                      width={1.1} 
                      height={32} 
                      fontSize={8} 
                      font="monospace" 
                      background="transparent"
                      format="CODE128"
                      margin={0}
                    />
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] mt-0.5 text-center text-gray-700">
                      {displayId}
                    </p>
                  </div>
                </div>
              );
            }

            // --- 1.5 Clean Logistics Portrait Label ---
            if (template === 'portrait-clean-logistics') {
              return (
                <div key={order.id} className="label-item-clean-logistics">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-gray-500">To:</p>
                    <div className="text-[12px] leading-tight uppercase font-black text-black">
                      {order.customerName} {productName ? `(${productName.toUpperCase()})` : ''}
                    </div>
                    <p className="text-[10px] font-medium leading-tight whitespace-pre-wrap mt-1 text-gray-800 line-clamp-2">
                      {order.customerAddress}
                    </p>
                    {order.customerCity && (
                      <p className="text-[10px] font-black uppercase text-black mt-0.5">
                        [{order.customerCity.toUpperCase()}]
                      </p>
                    )}
                    <div className="mt-1.5">
                      <p className="text-[13px] font-black tracking-tight leading-none text-black">
                        {order.customerPhone}{order.customerPhone2 ? ` / ${order.customerPhone2}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 mb-1">
                    <h1 className="text-[18px] font-black tracking-tight leading-none text-left text-black">
                      COD: Rs.{order.totalAmount.toLocaleString()}
                    </h1>
                  </div>

                  <div className="border-t border-dashed border-gray-400 my-1"></div>

                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold text-gray-500">From:</p>
                    <p className="text-[11px] font-black uppercase leading-none text-black truncate">{settings.shopName}</p>
                    <p className="text-[8px] font-bold text-gray-600 truncate mt-0.5">{settings.shopAddress}</p>
                    <p className="text-[9px] font-black text-black mt-0.5">{settings.shopPhone}</p>
                    <div className="mt-0.5">
                      <p className="text-[7px] font-bold text-gray-400 uppercase">OMS REF: {order.id.toUpperCase()}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center pt-1">
                    <Barcode 
                      value={displayId} 
                      width={1.1} 
                      height={32} 
                      fontSize={0}
                      background="transparent"
                      format="CODE128"
                      margin={0}
                    />
                    <p className="text-[8px] font-bold uppercase text-center text-gray-600 leading-none mt-1 mb-0.5">
                      {displayId}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-center text-gray-800 leading-none font-mono">
                      {displayId}
                    </p>
                  </div>
                </div>
              );
            }

            // --- 2. Compact Thermal Label ---
            if (template === 'portrait-compact') {
              return (
                <div key={order.id} className="label-item-compact">
                  {/* Shop header */}
                  <div className="text-center border-b border-dashed border-black pb-1">
                    <h2 className="text-[11px] font-black tracking-tight uppercase leading-none text-black">{settings.shopName}</h2>
                    <p className="text-[7px] font-bold text-gray-600 truncate mt-0.5">{settings.shopAddress}</p>
                    <p className="text-[8px] font-black text-black leading-none mt-0.5">{settings.shopPhone}</p>
                  </div>
                  
                  {/* Shipping Address */}
                  <div className="space-y-0.5 mt-1">
                    <div className="flex justify-between items-center text-[7px] uppercase font-bold text-gray-400">
                      <span>DELIVER TO</span>
                      <span>REF: {order.id.slice(0, 6)}</span>
                    </div>
                    <div className="text-[10px] font-black uppercase text-black leading-tight">
                      {order.customerName}
                    </div>
                    <p className="text-[8px] font-bold leading-tight mt-0.5 line-clamp-2 text-gray-800">
                      {order.customerAddress} {order.customerCity ? `[${order.customerCity.toUpperCase()}]` : ''}
                    </p>
                    <p className="text-[10px] font-black leading-none mt-1 text-black">
                      {order.customerPhone}{order.customerPhone2 ? ` / ${order.customerPhone2}` : ''}
                    </p>
                  </div>

                  {/* Items list */}
                  <div className="border-t border-dashed border-black pt-1 my-1">
                    <div className="flex justify-between text-[7px] font-bold text-gray-400 uppercase">
                      <span>SKU / PRODUCT</span>
                      <span>QTY</span>
                    </div>
                    <div className="text-[8px] font-black uppercase mt-0.5 leading-none text-black truncate">
                      {productName}
                      {order.items.length > 1 && ` + ${order.items.length - 1} items`}
                      <span className="float-right">x{order.items.reduce((acc, it) => acc + it.quantity, 0)}</span>
                    </div>
                  </div>

                  {/* High Contrast COD */}
                  <div className="border-t border-black pt-1">
                    <div className="bg-black text-white p-1.5 text-center rounded">
                      <p className="text-[7px] font-black uppercase tracking-wider text-gray-300">CASH ON DELIVERY</p>
                      <h1 className="text-[13px] font-black mt-0.5 tracking-tight leading-none">
                        Rs. {order.totalAmount.toLocaleString()}
                      </h1>
                    </div>
                  </div>

                  {/* Condensed Barcode */}
                  <div className="flex flex-col items-center justify-center pt-1">
                    <Barcode 
                      value={displayId} 
                      width={0.8} 
                      height={24} 
                      fontSize={7} 
                      font="monospace" 
                      background="transparent"
                      format="CODE128"
                      margin={0}
                    />
                  </div>
                </div>
              );
            }

            // --- 3. Landscape Waybill Label ---
            return (
              <div key={order.id} className="label-item-waybill">
                {/* Left side: Recipient, Sender, and Products */}
                <div className="w-[58%] flex flex-col justify-between border-r border-gray-300 pr-2">
                  <div>
                    <div className="flex justify-between items-center border-b border-black pb-1 mb-1">
                      <span className="text-[7px] font-black uppercase bg-black text-white px-1 py-0.5 rounded">WAYBILL LABEL</span>
                      <span className="text-[7px] font-bold text-gray-400">REF: {order.id.slice(0, 6)}</span>
                    </div>
                    <p className="text-[7px] font-bold text-gray-400 uppercase">RECIPIENT:</p>
                    <p className="text-[10px] font-black uppercase leading-tight mt-0.5 text-black">{order.customerName}</p>
                    <p className="text-[8px] font-normal leading-tight whitespace-pre-wrap mt-0.5 text-gray-800 line-clamp-2">
                      {order.customerAddress} {order.customerCity ? `[${order.customerCity.toUpperCase()}]` : ''}
                    </p>
                    <p className="text-[10px] font-black mt-1 leading-none text-black">
                      {order.customerPhone}{order.customerPhone2 ? ` / ${order.customerPhone2}` : ''}
                    </p>
                  </div>

                  {/* Products */}
                  <div className="border-t border-gray-200 pt-1">
                    <div className="flex justify-between text-[7px] font-black text-gray-400 uppercase leading-none">
                      <span>PRODUCT INFO</span>
                      <span>QTY</span>
                    </div>
                    <div className="flex justify-between text-[8px] font-black uppercase mt-1 leading-none text-black">
                      <span className="truncate max-w-[85px]">{productName}</span>
                      <span>x{order.items.reduce((acc, it) => acc + it.quantity, 0)}</span>
                    </div>
                  </div>

                  {/* Sender details */}
                  <div className="border-t border-gray-200 pt-0.5 mt-0.5 text-[7px] text-gray-600 leading-tight">
                    <p className="font-bold uppercase text-black">SENDER: {settings.shopName}</p>
                    <p className="truncate">{settings.shopAddress} ({settings.shopPhone})</p>
                  </div>
                </div>

                {/* Right side: COD and Barcode */}
                <div className="w-[42%] flex flex-col justify-between items-stretch">
                  {/* Large COD Block */}
                  <div className="border-2 border-black p-1.5 rounded-lg text-center bg-gray-50 flex flex-col justify-center">
                    <p className="text-[7px] font-black uppercase tracking-wider text-gray-500">CASH ON DELIVERY</p>
                    <h2 className="text-[12px] font-black text-black mt-0.5 leading-none">
                      Rs. {order.totalAmount.toLocaleString()}
                    </h2>
                  </div>

                  {/* Barcode */}
                  <div className="flex flex-col items-center justify-center flex-grow pt-1">
                    <Barcode 
                      value={displayId} 
                      width={0.8} 
                      height={24} 
                      fontSize={7} 
                      font="monospace" 
                      background="transparent"
                      format="CODE128"
                      margin={0}
                    />
                    <p className="text-[7px] font-black uppercase tracking-wider mt-0.5 text-center text-gray-700">
                      {displayId}
                    </p>
                  </div>

                  {/* Registry Stamp */}
                  <div className="text-center opacity-40 border-t border-dashed border-gray-300 pt-0.5">
                    <p className="text-[5px] font-black uppercase tracking-widest text-gray-500">Logistics Hub Registry</p>
                  </div>
                </div>
              </div>
            );
          })}
          {Array.from({ length: itemsPerPage - orders.slice(pageIdx * itemsPerPage, (pageIdx + 1) * itemsPerPage).length }).map((_, i) => (
            <div 
              key={`empty-${i}`} 
              className={`${template === 'landscape-waybill' ? 'label-item-waybill' : template === 'portrait-compact' ? 'label-item-compact' : template === 'portrait-clean-logistics' ? 'label-item-clean-logistics' : 'label-item-classic'} opacity-0`}
            ></div>
          ))}
        </div>
      ))}
    </div>
  );
};
