import React, { useState, useEffect } from 'react';
import { clearLocalStorage, getSettings, saveSettings } from '../../services/settingsService';
import { SettingsIcon } from '../icons/SettingsIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { AppSettings } from '../../types';
import { MapPinIcon } from '../icons/MapPinIcon'; // Assuming you have or will create this icon

const SettingsPanel: React.FC = () => {
    
    const firebaseProjectId = process.env.VITE_FIREBASE_PROJECT_ID;
    const [settings, setSettings] = useState<AppSettings>({
        deliveryRadius: 500, // default 500 meters
        enableLocationValidation: false,
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            const data = await getSettings();
            if (data) {
                setSettings(data);
            }
            setLoading(false);
        };
        fetchSettings();
    }, []);

    const handleClearLocalData = () => {
        if (window.confirm('¿Estás seguro de que quieres borrar todos los datos locales? Esto cerrará tu sesión en el panel y forzará una recarga completa de los datos desde Firebase. No se borrarán datos de la base de datos.')) {
            clearLocalStorage();
        }
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await saveSettings(settings);
            alert('Ajustes guardados correctamente.');
        } catch (error) {
            console.error(error);
            alert('Error al guardar los ajustes.');
        } finally {
            setSaving(false);
        }
    };

    const handleGetCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setSettings(prev => ({
                        ...prev,
                        location: {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        }
                    }));
                },
                (error) => {
                    console.error("Error getting location:", error);
                    alert("No se pudo obtener la ubicación actual. Asegúrate de permitir el acceso a la ubicación.");
                }
            );
        } else {
            alert("Geolocalización no soportada por este navegador.");
        }
    };

    return (
        <div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">Ajustes</h2>
            
            {/* Location Settings */}
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 max-w-3xl mx-auto mb-8">
                <div className="flex items-center gap-3 mb-6 border-b dark:border-gray-700 pb-4">
                    <MapPinIcon className="w-8 h-8 text-blue-500" />
                    <div>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Ubicación y Validación</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Configura la ubicación del establecimiento y el radio de validación.</p>
                    </div>
                </div>
                
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Latitud</label>
                            <input
                                type="number"
                                value={settings.location?.lat || ''}
                                onChange={(e) => setSettings(prev => ({ ...prev, location: { ...prev.location!, lat: parseFloat(e.target.value) } }))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
                                placeholder="Ej: -12.0464"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Longitud</label>
                            <input
                                type="number"
                                value={settings.location?.lng || ''}
                                onChange={(e) => setSettings(prev => ({ ...prev, location: { ...prev.location!, lng: parseFloat(e.target.value) } }))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
                                placeholder="Ej: -77.0428"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleGetCurrentLocation}
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                    >
                        Usar mi ubicación actual como establecimiento
                    </button>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Radio de Validación (metros)</label>
                        <input
                            type="number"
                            value={settings.deliveryRadius}
                            onChange={(e) => setSettings(prev => ({ ...prev, deliveryRadius: parseInt(e.target.value) }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
                            placeholder="Ej: 500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Distancia máxima permitida desde el establecimiento para acceder a la mesa.</p>
                    </div>

                    <div className="flex items-center">
                        <input
                            id="enableValidation"
                            type="checkbox"
                            checked={settings.enableLocationValidation}
                            onChange={(e) => setSettings(prev => ({ ...prev, enableLocationValidation: e.target.checked }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="enableValidation" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                            Habilitar validación de ubicación al ingresar a la mesa
                        </label>
                    </div>

                    <div className="pt-4">
                        <button
                            onClick={handleSaveSettings}
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {saving ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 max-w-3xl mx-auto mb-8">
                <div className="flex items-center gap-3 mb-6 border-b dark:border-gray-700 pb-4">
                    <SettingsIcon className="w-8 h-8 text-primary" />
                    <div>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Base de Datos (Firebase)</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">La aplicación ahora está conectada a Firebase Firestore.</p>
                    </div>
                </div>
                 <div className="space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">
                        Los datos se sincronizan en tiempo real. No se requiere configuración manual aquí.
                    </p>
                    {firebaseProjectId && (
                        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md">
                            <p className="text-sm text-gray-600 dark:text-gray-400">ID del Proyecto de Firebase:</p>
                            <p className="font-mono font-semibold text-primary">{firebaseProjectId}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 max-w-3xl mx-auto">
                <div className="flex items-center gap-3 mb-6">
                     <TrashIcon className="w-8 h-8 text-red-500" />
                    <div>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Mantenimiento</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Acciones para desarrollo y solución de problemas.</p>
                    </div>
                </div>
                 <div className="space-y-4">
                    <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Limpiar caché local</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-3">
                            Esta acción borrará todos los datos almacenados en tu navegador (pedidos, productos, etc.) y los volverá a cargar desde Firebase. Es útil si encuentras inconsistencias en los datos. No afectará la base de datos.
                        </p>
                         <button
                            onClick={handleClearLocalData}
                            className="px-4 py-2 border border-red-500 rounded-md text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50"
                        >
                            Limpiar Datos Locales
                        </button>
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default SettingsPanel;