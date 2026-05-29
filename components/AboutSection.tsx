import React from 'react';

const AboutSection: React.FC = () => {
  return (
    <section id="about" className="py-24 bg-white dark:bg-gray-900">
      <div className="container mx-auto px-6 flex flex-col md:flex-row items-center gap-16">
        <div className="md:w-1/2 animate-slide-in-up relative">
          <div className="absolute -top-4 -left-4 w-24 h-24 bg-secondary/20 rounded-full z-0"></div>
          <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-primary/10 rounded-full z-0"></div>
          <img 
            src="https://lh3.googleusercontent.com/gg-dl/AOI_d_9ig6bKwF7Fcepr8M3vW77W4UdVK9CEzySgxJ5FdrXaXSU4DU52zkiI6Pipulddf6c3BwjiueEIl94T-7qacLxtfDQtufUzI89rbTwDevGsoBYVKPQRXiraTTFf70QW2884fK1PWM7vcnXH0nA-NMU6Brf4tJesBdteQYxlbvAkLp3b3w=s1024-rj" 
            alt="Chef preparando pizza en horno de leña" 
            className="rounded-2xl shadow-2xl relative z-10 transform transition-transform hover:scale-[1.02] duration-500" 
          />
        </div>
        <div className="md:w-1/2 animate-slide-in-up" style={{animationDelay: '200ms'}}>
          <h2 className="text-5xl font-bold font-display text-dark dark:text-gray-100 mb-8 leading-tight">
            Nuestra Historia,<br/> <span className="text-primary">Tu Experiencia.</span>
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed mb-6 font-light">
            <strong className="font-semibold text-dark dark:text-white">Pizzería Los Genios</strong> nació de una idea simple: crear la mejor pizza usando solo los ingredientes más frescos y de origen local. Nuestra masa se hace a diario, nuestra salsa es una receta familiar transmitida por generaciones, y nuestra pasión se infunde en cada pizza que hacemos.
          </p>
          <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed font-light">
            Creemos que una buena pizza une a la gente. Ya sea que estés compartiendo una comida con la familia o disfrutando una rebanada con amigos, estamos dedicados a hacer que tu experiencia sea inolvidable.
          </p>
          <div className="mt-8 flex gap-4">
             <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-secondary">15+</span>
                <span className="text-sm text-gray-500 uppercase tracking-wide">Años</span>
             </div>
             <div className="w-px bg-gray-300 h-12"></div>
             <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-secondary">10k+</span>
                <span className="text-sm text-gray-500 uppercase tracking-wide">Clientes Felices</span>
             </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;