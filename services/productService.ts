import type { Product, MenuItem } from '../types';
import { db, collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from './firebase';

const PRODUCTS_STORAGE_KEY = 'pizzeria-products';
const SHEET_NAME = 'Products';

// In-memory cache for synchronous access
let productsCache: Product[] | null = null;

// Helper to update both caches
export const updateCaches = (products: Product[]) => {
    productsCache = products;
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
};

const initialMenu: { [category: string]: MenuItem[] } = {
    "Pizzas": [
        { "name": "Muzzarella", "price": "9200", "description": "Muzzarella, salsa, oregano, y aceitunas verdes" },
        { "name": "Tomate Natural", "price": "9700", "description": "Muzzarella, salsa, Tomate natural en rodajas, orégano y aceitunas verdes" },
        { "name": "Napolitana", "price": "9700", "description": "Muzzarella, salsa, ajies, orégano y aceitunas verdes" },
        { "name": "Ajies", "price": "9700", "description": "Muzzarella, salsa, Tomate natural en rodajas, orégano y aceitunas verdes" },
        { "name": "Jamon", "price": "9700", "description": "Muzzarella, salsa, jamón, orégano y aceitunas verdes" },
        { "name": "Morron", "price": "9700", "description": "Muzzarella, salsa, morron, orégano y aceitunas verdes" },
        { "name": "Americana", "price": "9700", "description": "Muzzarella, salsa, cebolla fina, orégano y aceitunas verdes" },
        { "name": "Calabresa", "price": "9900", "description": "Muzzarella, salsa, longaniza, orégano y aceitunas verdes" },
        { "name": "Provolone", "price": "9900", "description": "Muzzarella, salsa, provolone, orégano y aceitunas verdes" },
        { "name": "Roquefort", "price": "9700", "description": "Muzzarella, salsa, roquefort, orégano y aceitunas verdes" },
        { "name": "3 Quesos", "price": "9700", "description": "Muzzarella, salsa, provolone, roquefort, orégano y aceitunas verdes" }
    ],
    "Empanadas": [
        { "name": "Empanadas de Carne", "price": "600" },
        { "name": "Empanadas Queso", "price": "500" },
        { "name": "Empanadas JyQ", "price": "600" },
        { "name": "Empanadas Humita", "price": "600" },
        { "name": "FRISNACKS GRANDE", "price": "4500" },
    ],
    "Hamburguesas": [
        { "name": "Burger Común", "price": "3000" },
        { "name": "Burger Especial", "price": "4000" },
        { "name": "Super Burger", "price": "6000" },
        { "name": "Burger Doble Carne Clasica", "price": "5000" }
    ],
    "Lomitos": [
        { "name": "Lomito Común pan Baguet", "price": "4000" },
        { "name": "Lomito Especial pan Baguet", "price": "6000" }
    ],
    "Sandwichs": [
        { "name": "Carlito Común", "price": "2000" },
        { "name": "Carilito Especial", "price": "3500" }
    ]
};

const initializeProducts = () => {
    try {
        const productsJson = localStorage.getItem(PRODUCTS_STORAGE_KEY);
        if (productsJson) {
            productsCache = JSON.parse(productsJson);
            return;
        }

        const productList: Product[] = [];
        Object.entries(initialMenu).forEach(([category, items]) => {
            items.forEach(item => {
                productList.push({
                    id: `PROD-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    category,
                    name: item.name,
                    description: item.description || '',
                    price: item.price,
                });
            });
        });
        updateCaches(productList);
    } catch (error) {
        console.error("Error crítico al inicializar productos desde localStorage:", error);
        // Fallback to empty array to prevent app crash
        productsCache = []; 
    }
};

initializeProducts();

export const getProductsFromCache = (): Product[] => {
    return productsCache || [];
};

export const fetchAndCacheProducts = async (): Promise<Product[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, SHEET_NAME));
        
        if (querySnapshot.empty && getProductsFromCache().length > 0) {
            console.log(`La colección '${SHEET_NAME}' en Firebase está vacía. Intentando sembrar desde localStorage.`);
            const localData = getProductsFromCache();
            const batch = writeBatch(db);
            localData.forEach(item => {
                const docRef = doc(db, SHEET_NAME, item.id);
                batch.set(docRef, item);
            });
            await batch.commit();
            return localData;
        }

        const products = querySnapshot.docs.map(doc => doc.data() as Product);
        updateCaches(products);
        return products;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`Fallo al obtener productos de Firebase. Usando caché local. Error: ${errorMessage}`);
        // Optionally notify user via a toast service if available, or just rely on console for dev
        return getProductsFromCache();
    }
};

export const addProduct = async (productData: Omit<Product, 'id'>): Promise<Product> => {
    const newProduct: Product = {
        ...productData,
        id: `PROD-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };
    try {
        await setDoc(doc(db, SHEET_NAME, newProduct.id), newProduct);
        // Update cache immediately
        const currentCache = getProductsFromCache();
        updateCaches([...currentCache, newProduct]);
        return newProduct;
    } catch(e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("Error adding product:", errorMessage);
        throw new Error(`No se pudo guardar el producto "${productData.name}". Verifique su conexión a internet.`);
    }
};

export const updateProduct = async (updatedProduct: Product): Promise<Product> => {
    try {
        await setDoc(doc(db, SHEET_NAME, updatedProduct.id), updatedProduct);
        // Update cache immediately
        const currentCache = getProductsFromCache();
        const index = currentCache.findIndex(p => p.id === updatedProduct.id);
        if (index !== -1) {
            const newCache = [...currentCache];
            newCache[index] = updatedProduct;
            updateCaches(newCache);
        }
        return updatedProduct;
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("Error updating product:", errorMessage);
        throw new Error(`No se pudo actualizar el producto "${updatedProduct.name}". Verifique su conexión a internet.`);
    }
};

export const deleteProduct = async (productId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, SHEET_NAME, productId));
        // Update cache immediately
        const currentCache = getProductsFromCache();
        const newCache = currentCache.filter(p => p.id !== productId);
        updateCaches(newCache);
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("Error deleting product:", errorMessage);
        throw new Error(`No se pudo eliminar el producto. Verifique su conexión a internet.`);
    }
};

export const adjustProductPrices = async (
  targetCategory: string,
  percentage: number,
  rounding: 'none' | 'integer' | '10' | '50' | '100'
): Promise<void> => {
  const products = getProductsFromCache();
  const adjustmentFactor = 1 + percentage / 100;

  const roundPrice = (price: number): number => {
    if (isNaN(price)) return 0;
    switch (rounding) {
      case 'integer': return Math.round(price);
      case '10': return Math.round(price / 10) * 10;
      case '50': return Math.round(price / 50) * 50;
      case '100': return Math.round(price / 100) * 100;
      case 'none': default: return parseFloat(price.toFixed(2));
    }
  };

  const productsToUpdate = products.filter(p => targetCategory === 'all' || p.category === targetCategory);

  const updatedProducts = products.map(product => {
    if (targetCategory === 'all' || product.category === targetCategory) {
      const currentPrice = parseFloat(product.price);
      if (!isNaN(currentPrice)) {
        const newPrice = currentPrice * adjustmentFactor;
        return { ...product, price: roundPrice(newPrice).toString() };
      }
    }
    return product;
  });
  
  try {
    const batch = writeBatch(db);
    productsToUpdate.forEach(product => {
        const currentPrice = parseFloat(product.price);
        if(!isNaN(currentPrice)) {
            const newPrice = currentPrice * adjustmentFactor;
            const docRef = doc(db, SHEET_NAME, product.id);
            batch.update(docRef, { price: roundPrice(newPrice).toString() });
        }
    });
    await batch.commit();
    updateCaches(updatedProducts);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to sync adjusted prices:', errorMessage);
    throw new Error('Falló la actualización masiva de precios. Por favor intente nuevamente más tarde.');
  }
};

export const importProducts = async (
  productsToImport: Omit<Product, 'id' | 'imageUrl'>[]
): Promise<{ added: number; updated: number; errors: number }> => {
  const existingProducts = getProductsFromCache();
  let added = 0;
  let updated = 0;
  let errors = 0;

  try {
      const batch = writeBatch(db);

      productsToImport.forEach(newProd => {
        if (!newProd.name || !newProd.category || !newProd.price) {
          errors++;
          return;
        }
        const existingProduct = existingProducts.find(p => p.name.trim().toLowerCase() === newProd.name.trim().toLowerCase() && p.category === newProd.category);
        
        if (existingProduct) {
          const docRef = doc(db, SHEET_NAME, existingProduct.id);
          batch.set(docRef, { ...existingProduct, ...newProd });
          updated++;
        } else {
          const newId = `PROD-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const newProduct: Product = { ...newProd, id: newId };
          const docRef = doc(db, SHEET_NAME, newId);
          batch.set(docRef, newProduct);
          added++;
        }
      });

      await batch.commit();
      await fetchAndCacheProducts();
      
      return { added, updated, errors };
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error importing products:", errorMessage);
      throw new Error("Ocurrió un error durante la importación masiva. Verifique el formato de los datos y su conexión.");
  }
};