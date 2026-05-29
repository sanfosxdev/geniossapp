import React, { useState } from 'react';
import { PizzaIcon } from './icons/PizzaIcon';
import { LockIcon } from './icons/LockIcon';
import { MailIcon } from './icons/MailIcon';
import { loginWithEmailAndPassword } from '../services/authService';

interface AdminLoginProps {
  onLoginSuccess: () => void;
  onGoToSite: () => void;
}

const getLoginErrorMessage = (error: unknown): string => {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';

  if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password') || code.includes('auth/user-not-found')) {
    return 'Email o contrasena incorrectos.';
  }

  if (code.includes('auth/too-many-requests')) {
    return 'Demasiados intentos. Espera unos minutos y vuelve a intentar.';
  }

  if (error instanceof Error && error.message.includes('auth/missing-profile')) {
    return 'Tu usuario no tiene permisos asignados en Users/{uid}. Contacta a un administrador.';
  }

  return 'No se pudo iniciar sesion. Revisa tus datos e intenta nuevamente.';
};

const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onGoToSite }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await loginWithEmailAndPassword(email, password);
      onLoginSuccess();
    } catch (error) {
      setErrorMessage(getLoginErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <PizzaIcon className="w-9 h-9 text-primary" />
          </div>
          <h1 className="text-3xl font-bold font-display text-gray-900 dark:text-white">Panel Admin</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Ingresa con tu cuenta autorizada.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-6 space-y-5">
          <div>
            <label htmlFor="admin-email" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
              Email
            </label>
            <div className="relative">
              <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="admin@tudominio.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
              Contrasena
            </label>
            <div className="relative">
              <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Tu contrasena"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-200">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Ingresando...' : 'Ingresar'}
          </button>

          <button
            type="button"
            onClick={onGoToSite}
            className="w-full text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-primary transition-colors"
          >
            Volver al sitio
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
