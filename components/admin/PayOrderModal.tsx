import React, { useState } from 'react';
import { PaymentMethod, EnrichedTable, Order } from '../../types';
import { CloseIcon } from '../icons/CloseIcon';

interface PayOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: PaymentMethod, paymentProofUrl?: string) => void;
  table?: EnrichedTable | null;
  order?: Order | null;
}

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
};

const PayOrderModal: React.FC<PayOrderModalProps> = ({ isOpen, onClose, onConfirm, table, order }) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        setPaymentProofFile(e.target.files[0]);
    }
  };

  const handleConfirm = async () => {
    let proofUrl: string | undefined = undefined;
    if (paymentProofFile) {
        proofUrl = await fileToDataUrl(paymentProofFile);
    }
    onConfirm(paymentMethod, proofUrl);
  };
  
  if (!isOpen) return null;
  if (!table && !order) return null;

  const targetName = table ? `Mesa ${table.name}` : (order ? order.customer.name : 'Pedido');
  
  const ordersToPay = table 
    ? (table.activeOrdersOnTable?.filter(o => !o.isPaid && o.status !== 'Cancelado') || [])
    : (order ? [order] : []);

  const totalToPay = ordersToPay.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg transform animate-slide-in-up max-h-[90vh] flex flex-col">
        <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Confirmar Pago - {targetName}</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        
        <div className="p-6 space-y-4 overflow-y-auto flex-grow">
            
            {/* Order Details Breakdown */}
            <div className="space-y-3">
                <h3 className="font-semibold text-gray-700 dark:text-gray-300">Detalle de Pedidos Pendientes</h3>
                {ordersToPay.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 italic">No hay pedidos pendientes de pago.</p>
                ) : (
                    ordersToPay.map(o => (
                        <div key={o.id} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-gray-800 dark:text-gray-200">Pedido #{o.id.split('-')[1]}</span>
                                <span className="font-bold text-gray-700 dark:text-gray-300">${o.total.toLocaleString('es-AR')}</span>
                            </div>
                            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 pl-2 border-l-2 border-gray-300 dark:border-gray-500">
                                {o.items.map((item, idx) => (
                                    <li key={idx} className="flex justify-between">
                                        <span>{item.quantity}x {item.name}</span>
                                        <span>${(item.price * item.quantity).toLocaleString('es-AR')}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))
                )}
            </div>

            <div className="text-center py-4 border-t border-b border-gray-200 dark:border-gray-700 my-4">
                <p className="text-gray-600 dark:text-gray-400 font-semibold">Total a Pagar Ahora:</p>
                <p className="text-4xl font-bold text-primary">${totalToPay.toLocaleString('es-AR')}</p>
            </div>
          
            <fieldset>
                <legend className="text-lg font-bold px-2 text-gray-800 dark:text-gray-100 mb-4">Forma de Pago</legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {Object.values(PaymentMethod).map(method => (
                         <label key={method} className={`
                            cursor-pointer flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all
                            ${paymentMethod === method 
                                ? 'border-primary bg-primary/5 text-primary dark:bg-primary/10 shadow-sm' 
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'}
                        `}>
                            <input 
                                type="radio" 
                                name="paymentMethod" 
                                value={method} 
                                checked={paymentMethod === method} 
                                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                                className="sr-only"
                            />
                            <span className="font-bold text-lg">{method}</span>
                        </label>
                    ))}
                </div>
            </fieldset>

            {paymentMethod === 'Transferencia' && (
                <div className="mt-4 p-4 border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500 animate-fade-in rounded-r-lg">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-300">Datos para la Transferencia</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-400 mt-1 font-mono bg-white/50 dark:bg-black/20 p-2 rounded">
                        <strong>CBU:</strong> 1234567890123456789012<br/>
                        <strong>Alias:</strong> PIZZERIA.LOS.GENIOS
                    </p>
                    <div className="mt-3">
                        <label htmlFor="paymentProof" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subir Comprobante (Opcional)</label>
                        <input type="file" id="paymentProof" onChange={handleFileChange} accept="image/*" className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-red-700 transition-colors cursor-pointer"/>
                    </div>
                </div>
            )}
        </div>
        <footer className="flex justify-end items-center p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
          >
            Confirmar Pago
          </button>
        </footer>
      </div>
    </div>
  );
};

export default PayOrderModal;