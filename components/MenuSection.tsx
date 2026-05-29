import React, { useState, useEffect } from 'react';
import type { MenuItem, Category, Promotion } from '../types';
import { fetchAndCacheProducts } from '../services/productService';
import { fetchAndCacheCategories } from '../services/categoryService';
import { fetchAndCachePromotions } from '../services/promotionService';

const MenuItemCard: React.FC<{ item: MenuItem }> = ({ item }) => {
    return (
        <div className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl transition-all duration-300 hover:bg-white/10 hover:shadow-2xl hover:-translate-y-1 h-full flex flex-col w-full">
            {item.imageUrl && (
                <div className="relative h-48 sm:h-56 w-full overflow-hidden shrink-0">
                    <img 
                        src={item.imageUrl} 
                        alt={item.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                </div>
            )}
            <div className="p-5 flex flex-col flex-grow relative">
                {!item.imageUrl && (
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-primary/20 to-transparent rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500"></div>
                )}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 relative z-10 gap-2">
                    <h4 className="text-xl sm:text-2xl font-bold font-display leading-tight text-white">{item.name}</h4>
                    <span className="self-start sm:self-auto text-lg sm:text-xl font-bold text-secondary whitespace-nowrap bg-black/40 px-3 py-1 rounded-lg backdrop-blur-md border border-white/10">
                        ${Number(item.price).toLocaleString('es-AR')}
                    </span>
                </div>
                {item.description && (
                    <p className="text-gray-300 text-sm sm:text-base leading-relaxed flex-grow font-light relative z-10">
                        {item.description}
                    </p>
                )}
            </div>
        </div>
    );
}

const MenuSection: React.FC = () => {
  const [menu, setMenu] = useState<{ [category: string]: MenuItem[] }>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMenuData = async () => {
        try {
            const [products, loadedCategories, allPromotions] = await Promise.all([
                fetchAndCacheProducts(),
                fetchAndCacheCategories(),
                fetchAndCachePromotions()
            ]);

            const activePromotions = allPromotions.filter(p => p.isActive);

            setCategories(loadedCategories);
            setPromotions(activePromotions);

            const groupedMenu = products.reduce((acc, product) => {
              const category = product.category;
              if (!acc[category]) {
                acc[category] = [];
              }
              acc[category].push({
                name: product.name,
                price: product.price,
                description: product.description,
                imageUrl: product.imageUrl,
              });
              return acc;
            }, {} as { [category: string]: MenuItem[] });

            setMenu(groupedMenu);
        } catch (error) {
            console.error("Failed to load menu data", error);
            // Data will be loaded from cache by the services if API fails
        } finally {
            setIsLoading(false);
        }
    };
    
    loadMenuData();
  }, []);

  const promotionItems: MenuItem[] = promotions.map(promo => ({
    name: promo.name,
    price: promo.price.toString(),
    description: promo.items.map(item => `${item.quantity}x ${item.name}`).join(' + '),
    imageUrl: promo.imageUrl,
  }));

  return (
    <section id="menu" className="bg-dark">
      <div className="container mx-auto px-6 py-24 text-center">
        <h2 className="text-5xl font-bold font-display text-white mb-6 tracking-tight">Nuestro Delicioso Menú</h2>
        <p className="text-xl text-gray-400 max-w-3xl mx-auto font-light">Explora nuestras especialidades, preparadas con los ingredientes más frescos y mucho amor.</p>
      </div>
      
      {isLoading ? (
          <div className="text-center text-white py-32 flex justify-center items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
      ) : (
        <>
          {promotionItems.length > 0 && (
            <div 
              className="relative py-24 lg:py-32 bg-cover bg-center bg-fixed group"
              style={{ backgroundImage: `url('https://images.unsplash.com/photo-1504674900247-0877df9cc836?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')` }}
            >
              <div className="absolute inset-0 bg-black/70 transition-opacity duration-500 group-hover:bg-black/60"></div>
              <div className="relative z-10 container mx-auto px-6 flex flex-col items-center">
                <h3 className="text-4xl lg:text-6xl font-bold font-display text-white mb-16 text-center relative inline-block">
                  <span className="relative z-10">Promociones Especiales</span>
                  <div className="absolute -bottom-4 left-0 w-full h-2 bg-secondary/80 transform -skew-x-12"></div>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-7xl">
                  {promotionItems.map((item) => (
                    <div key={item.name} className="transform transition-all duration-300 hover:-translate-y-2">
                        <MenuItemCard item={item} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {Object.keys(menu).length === 0 && promotionItems.length === 0 ? (
              <div className="text-center text-white py-20 text-xl">No hay productos en el menú.</div>
          ) : (
            Object.entries(menu).map(([categoryName, items]: [string, MenuItem[]]) => {
              const categoryData = categories.find(c => c.name === categoryName);
              const imageUrl = categoryData?.imageUrl;
              
              return (
              <div 
                key={categoryName} 
                className="relative py-24 lg:py-32 bg-cover bg-center bg-fixed group"
                style={{ backgroundImage: imageUrl ? `url('${imageUrl}')` : 'none', backgroundColor: !imageUrl ? '#1A202C' : 'transparent' }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80 transition-opacity duration-500 group-hover:via-black/50"></div>
                <div className="relative z-10 container mx-auto px-4 sm:px-6 flex flex-col items-center">
                  <h3 className="text-4xl lg:text-5xl font-bold font-display text-white mb-12 sm:mb-16 text-center relative inline-block">
                    <span className="relative z-10 border-b-4 border-primary pb-2">{categoryName}</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 w-full max-w-7xl">
                    {items.map((item) => (
                      <MenuItemCard key={item.name} item={item} />
                    ))}
                  </div>
                </div>
              </div>
              )
            })
          )}
        </>
      )}
    </section>
  );
};

export default MenuSection;