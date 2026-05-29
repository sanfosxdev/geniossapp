import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { CloseIcon } from '../icons/CloseIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { CopyIcon } from '../icons/CopyIcon';
import type { Table } from '../../types';
import { getTableQrUrl } from '../../utils/url';
import { toastService } from '../../services/toastService';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: Table | null;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, table }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    if (isOpen && table && canvasRef.current) {
      const url = getTableQrUrl(table.id);
      setQrUrl(url);
      
      QRCode.toCanvas(canvasRef.current, url, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
            dark: '#000000',
            light: '#ffffff'
        }
      }, (error) => {
        if (error) console.error(error);
      });
    }
  }, [isOpen, table]);
  
  const handleCopyLink = () => {
      if (!qrUrl) return;
      navigator.clipboard.writeText(qrUrl).then(() => {
          toastService.show('Enlace copiado al portapapeles', 'success');
      }).catch(() => {
          toastService.show('Error al copiar el enlace', 'error');
      });
  };

  const handleDownload = () => {
      const canvas = canvasRef.current;
      if (!canvas || !table) return;
      
      const image = canvas.toDataURL("image/png");
      const link = document.createElement('a');
      link.href = image;
      link.download = `QR-Mesa-${table.name.replace(/\s+/g, '-')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toastService.show('Código QR descargado', 'success');
  };
  
  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas || !table) return;

    const printWindow = window.open('', '', 'height=600,width=800');
    if(printWindow) {
        const qrImage = canvas.toDataURL("image/png");
        
        printWindow.document.write('<html><head><title>Imprimir QR</title>');
        printWindow.document.write(`
            <style>
                body { 
                    text-align: center; 
                    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
                    padding: 40px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                } 
                .qr-container {
                    border: 2px solid #000;
                    padding: 40px;
                    border-radius: 20px;
                    display: inline-block;
                }
                h1 { 
                    font-size: 3rem; 
                    margin: 0 0 20px 0;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                } 
                p {
                    font-size: 1.2rem;
                    color: #555;
                    margin-top: 20px;
                }
                img { 
                    width: 400px; 
                    height: auto; 
                    display: block;
                } 
                @media print {
                    @page { margin: 0; size: auto; }
                    body { -webkit-print-color-adjust: exact; }
                }
            </style>
        `);
        printWindow.document.write('</head><body>');
        printWindow.document.write('<div class="qr-container">');
        printWindow.document.write(`<h1>${table.name}</h1>`);
        printWindow.document.write(`<img src="${qrImage}" alt="QR Code" />`);
        printWindow.document.write('<p>Escanea para ver el menú y pedir</p>');
        printWindow.document.write('</div>');
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        
        // Wait for image to load before printing (though base64 is instant, good practice)
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }, 250);
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md transform animate-slide-in-up overflow-hidden border border-gray-100 dark:border-gray-700">
        <header className="flex justify-between items-center p-5 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Código QR</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Mesa: <span className="font-semibold text-primary">{table?.name}</span></p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        
        <div className="p-8 flex flex-col items-center justify-center bg-white dark:bg-gray-800">
            <div className="p-4 bg-white rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 mb-6">
                <canvas ref={canvasRef} className="rounded-lg" />
            </div>
            
            <div className="w-full grid grid-cols-2 gap-3">
                <button 
                    onClick={handleCopyLink}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-sm"
                >
                    <CopyIcon className="w-5 h-5" />
                    Copiar Enlace
                </button>
                <button 
                    onClick={handleDownload}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-sm"
                >
                    <DownloadIcon className="w-5 h-5" />
                    Descargar
                </button>
            </div>
            
            <button
                type="button"
                onClick={handlePrint}
                className="w-full mt-3 px-4 py-3 bg-primary text-white rounded-xl hover:bg-red-700 transition-all shadow-md hover:shadow-lg font-bold text-sm flex items-center justify-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Imprimir QR
            </button>
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;
