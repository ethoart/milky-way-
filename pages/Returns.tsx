import React, { useState, useRef, useEffect } from 'react';
import { db } from '../services/mockBackend';
import { ScanLine, ArrowRight, CheckCircle, AlertOctagon, Camera, X } from 'lucide-react';
import { Order } from '../types';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface ReturnsProps {
  tenantId: string;
}

export const Returns: React.FC<ReturnsProps> = ({ tenantId }) => {
  const [scanInput, setScanInput] = useState('');
  const [processedOrder, setProcessedOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
        // Cleanup scanner on unmount
        if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error);
        }
    };
  }, []);

  useEffect(() => {
      if (isCameraActive) {
        // Initialize scanner when active
        const scanner = new Html5QrcodeScanner(
            "reader", 
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false
        );
        scanner.render(onScanSuccess, onScanFailure);
        scannerRef.current = scanner;
      } else {
         if (scannerRef.current) {
             scannerRef.current.clear().catch(console.error);
             scannerRef.current = null;
         }
      }
  }, [isCameraActive]);

  const onScanSuccess = (decodedText: string, decodedResult: any) => {
      setScanInput(decodedText);
      setIsCameraActive(false); // Stop scanning on success
      handleScanProcess(decodedText);
  };

  const onScanFailure = (error: any) => {
      // Handle scan failure, usually ignore
  };

  const handleScanProcess = async (code: string) => {
    setError(null);
    setProcessedOrder(null);

    if (!code.trim()) return;

    try {
      const result = await db.processReturn(code, tenantId);
      if (result) {
        setProcessedOrder(result);
        setScanInput(''); 
      } else {
        setError('Order not found or not eligible for return update.');
      }
    } catch (err) {
      setError('System error processing return.');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      handleScanProcess(scanInput);
  };

  return (
    <div className="flex flex-col items-center justify-center h-fit min-h-[80vh] space-y-8 max-w-2xl mx-auto">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
            <ScanLine size={32} className="text-white" />
        </div>
        <h2 className="text-3xl font-bold text-black">Returns Scanner</h2>
        <p className="text-gray-500">Scan barcode or enter tracking ID to restock.</p>
      </div>

      <div className="w-full bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100">
          
          {/* Camera View */}
          {isCameraActive ? (
              <div className="mb-6 relative">
                  <div id="reader" className="overflow-hidden rounded-xl border-2 border-black"></div>
                   <button 
                    onClick={() => setIsCameraActive(false)}
                    className="absolute top-2 right-2 bg-white p-2 rounded-full text-black shadow-lg z-10"
                  >
                      <X size={20} />
                  </button>
                  <p className="text-center text-xs text-gray-400 mt-2">Point camera at shipping label barcode</p>
              </div>
          ) : (
            <div className="mb-6">
                <button 
                    type="button"
                    onClick={() => setIsCameraActive(true)}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg"
                >
                    <Camera size={20} />
                    Open Camera Scanner
                </button>
            </div>
          )}

          <div className="relative flex items-center gap-4 my-4">
              <div className="flex-1 h-px bg-gray-200"></div>
              <span className="text-xs text-gray-400 font-bold uppercase">Or Enter Manually</span>
              <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="relative group">
            <input
                ref={inputRef}
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-200 text-black text-2xl font-mono text-center py-6 rounded-2xl focus:border-black focus:outline-none transition-all"
                placeholder="TRACKING ID"
                disabled={isCameraActive}
            />
            <button type="submit" className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-black">
                <ArrowRight size={24} />
            </button>
            </div>
          </form>
      </div>

      {processedOrder && (
        <div className="w-full bg-green-50 border border-green-200 p-6 rounded-3xl animate-fade-in shadow-sm">
          <div className="flex items-center gap-4 text-green-700">
            <CheckCircle size={32} />
            <div>
              <h3 className="text-xl font-bold">Processed Successfully</h3>
              <p className="text-sm">Status updated to: {processedOrder.status}</p>
            </div>
          </div>
          <div className="mt-4 bg-white p-4 rounded-xl text-sm text-gray-600 border border-green-100">
            <p>ID: <span className="font-mono text-black font-bold">{processedOrder.id}</span></p>
            <p>Customer: {processedOrder.customerName}</p>
            <p className="mt-2 text-xs uppercase tracking-wide text-green-600 font-bold">Stock Updated</p>
          </div>
        </div>
      )}

      {error && (
        <div className="w-full bg-red-50 border border-red-200 p-6 rounded-3xl animate-shake">
          <div className="flex items-center gap-4 text-red-600">
            <AlertOctagon size={32} />
            <div>
              <h3 className="text-xl font-bold">Scan Error</h3>
              <p>{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};