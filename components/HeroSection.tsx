import React from 'react';

interface HeroSectionProps {
  onOrderClick: () => void;
  isBotActive: boolean;
  isStoreOpen: boolean;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onOrderClick, isBotActive, isStoreOpen }) => {
  const getHeroText = () => {
    if (!isBotActive) {
      return "Hecha con pasión, horneada a la perfección. Explora nuestro menú y haz tu pedido.";
    }
    if (isStoreOpen) {
      return "Hecha con pasión, horneada a la perfección. ¡Deja que nuestro asistente de IA te ayude a encontrar tu pizza perfecta hoy!";
    }
    return "Hecha con pasión, horneada a la perfección. Aunque estamos cerrados, ¡nuestro asistente de IA puede ayudarte a reservar una mesa!";
  };
  
  return (
    <section id="home" className="relative h-[calc(100vh-80px)] min-h-[600px] bg-cover bg-center flex items-center justify-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1590947132387-155cc02f3212?q=80&w=2070&auto=format&fit=crop')" }}>
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80"></div>
      <div className="relative z-10 container mx-auto px-6 flex flex-col justify-center items-center text-center text-white">
        <h2 className="text-5xl sm:text-6xl md:text-8xl font-bold font-display tracking-tight leading-tight animate-fade-in drop-shadow-lg">
          <span className="text-secondary">Pizza Auténtica</span>,<br />Una Rebanada a la Vez.
        </h2>
        <p className="mt-6 text-lg sm:text-xl md:text-2xl max-w-3xl font-light text-gray-200 animate-fade-in drop-shadow-md" style={{ animationDelay: '0.2s' }}>
          {getHeroText()}
        </p>
        {isBotActive && (
          <button
            onClick={onOrderClick}
            className="mt-10 bg-primary text-white font-bold py-4 px-12 rounded-full text-xl shadow-lg shadow-primary/30 hover:bg-red-600 hover:shadow-primary/50 transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-105 animate-fade-in"
            style={{ animationDelay: '0.4s' }}
          >
            {isStoreOpen ? 'Pedir con Asistente IA' : 'Reservar con Asistente IA'}
          </button>
        )}
      </div>
    </section>
  );
};

export default HeroSection;
