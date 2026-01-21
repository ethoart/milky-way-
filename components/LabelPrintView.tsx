import React from 'react';
import Barcode from 'react-barcode';
import { Order, TenantSettings } from '../types';

interface LabelPrintViewProps {
  orders: Order[];
  settings: TenantSettings;
}

export const LabelPrintView: React.FC<LabelPrintViewProps> = ({ orders, settings }) => {
  return (
    <div className="print-only w-full bg-white text-black font-sans">
      <div className="grid grid-cols-2 gap-4 p-4">
        {orders.map((order) => (
          <div 
            key={order.id} 
            className="border border-gray-300 p-4 h-[120mm] flex flex-col justify-between relative bg-white"
            style={{ pageBreakInside: 'avoid' }}
          >
            {/* Top Section: To & COD */}
            <div>
              <div className="mb-2">
                <span className="text-sm text-gray-600 block mb-1">To:</span>
                <h3 className="text-lg font-bold leading-tight">{order.customerName}</h3>
                <p className="text-sm mt-1 leading-snug max-w-[90%]">{order.customerAddress}</p>
                <p className="text-md font-bold mt-1">{order.customerPhone}</p>
              </div>

              <div className="mt-4 mb-4">
                <h1 className="text-4xl font-extrabold tracking-tight">
                  COD: Rs.{order.totalAmount.toLocaleString()}
                </h1>
              </div>
            </div>

            {/* Separator */}
            <div className="border-t-2 border-dotted border-gray-400 my-2"></div>

            {/* Bottom Section: From & Barcode */}
            <div>
              <div className="text-sm mb-4">
                <span className="text-gray-600 block text-xs">From:</span>
                <p className="font-bold">{settings.shopName}</p>
                <p className="text-xs">{settings.shopAddress}</p>
                <p className="text-xs font-bold">{settings.shopPhone}</p>
                <p className="text-[10px] text-gray-500 mt-1">Ref: {order.id}</p>
              </div>

              <div className="flex flex-col items-center justify-center">
                <Barcode 
                  value={order.trackingNumber || order.id}
                  width={1.5}
                  height={40}
                  fontSize={12}
                  displayValue={true}
                  margin={0}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};