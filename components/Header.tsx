import React, { useState, useEffect } from 'react';
import { PizzaIcon } from './icons/PizzaIcon';
import { MenuIcon } from './icons/MenuIcon';
import { CloseIcon } from './icons/CloseIcon';
import ThemeToggleButton from './ThemeToggleButton';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderProps {
  onOrderClick: () => void;
  onAdminClick: () => void;
  isBotActive: boolean;
  isStoreOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({ onOrderClick, onAdminClick, isBotActive, isStoreOpen }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll effect for header background
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);

  const menuVariants = {
    closed: {
      opacity: 0,
      height: 0,
      transition: {
        duration: 0.3,
        ease: "easeInOut",
        when: "afterChildren",
        staggerChildren: 0.05,
        staggerDirection: -1
      }
    },
    open: {
      opacity: 1,
      height: "100vh",
      transition: {
        duration: 0.3,
        ease: "easeInOut",
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    closed: { opacity: 0, y: -20 },
    open: { opacity: 1, y: 0 }
  };

  const navLinks = [
    { href: "#home", label: "Inicio" },
    { href: "#menu", label: "Menú" },
    { href: "#about", label: "Nosotros" },
  ];

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || isMenuOpen 
          ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-md py-3' 
          : 'bg-transparent py-5'
      }`}
    >
      <div className="container mx-auto px-6 flex justify-between items-center relative z-50">
        <a href="#" className="flex items-center space-x-2 group">
          <motion.div
            whileHover={{ rotate: 20 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <PizzaIcon className="w-8 h-8 md:w-10 md:h-10 text-primary" />
          </motion.div>
          <span className={`text-xl md:text-2xl font-bold font-display transition-colors duration-300 ${
            scrolled || isMenuOpen ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white md:text-white md:dark:text-white md:drop-shadow-md'
          }`}>
            Pizzería Los Genios
          </span>
        </a>
        
        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <a 
              key={link.label}
              href={link.href} 
              className={`text-sm font-medium uppercase tracking-wider hover:text-primary transition-colors duration-300 ${
                scrolled ? 'text-gray-600 dark:text-gray-300' : 'text-white drop-shadow-sm'
              }`}
            >
              {link.label}
            </a>
          ))}
          <button 
            onClick={onAdminClick} 
            className={`text-sm font-medium uppercase tracking-wider hover:text-primary transition-colors duration-300 ${
              scrolled ? 'text-gray-600 dark:text-gray-300' : 'text-white drop-shadow-sm'
            }`}
          >
            Admin
          </button>
          
          <ThemeToggleButton />

          {isBotActive && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onOrderClick}
              className="bg-primary text-white font-bold py-2 px-6 rounded-full shadow-lg hover:bg-red-600 transition-colors"
            >
              {isStoreOpen ? 'Pedir Online' : 'Reservar Online'}
            </motion.button>
          )}
        </nav>

        {/* Mobile Controls */}
        <div className="flex items-center md:hidden space-x-4">
          <ThemeToggleButton />
          
          <motion.button 
            onClick={() => setIsMenuOpen(!isMenuOpen)} 
            className="text-gray-900 dark:text-white focus:outline-none p-2"
            animate={isMenuOpen ? "open" : "closed"}
          >
            <AnimatePresence mode='wait' initial={false}>
              {isMenuOpen ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <CloseIcon className="w-7 h-7" />
                </motion.div>
              ) : (
                <motion.div
                  key="menu"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <MenuIcon className="w-7 h-7" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={menuVariants}
            className="fixed inset-0 bg-white dark:bg-gray-900 z-40 md:hidden flex flex-col justify-center items-center pt-20"
          >
            <nav className="flex flex-col items-center space-y-8 w-full px-8">
              {navLinks.map((link) => (
                <motion.a
                  key={link.label}
                  href={link.href}
                  variants={itemVariants}
                  onClick={() => setIsMenuOpen(false)}
                  className="text-3xl font-bold text-gray-800 dark:text-white hover:text-primary transition-colors"
                >
                  {link.label}
                </motion.a>
              ))}
              
              <motion.button
                variants={itemVariants}
                onClick={() => {
                  onAdminClick();
                  setIsMenuOpen(false);
                }}
                className="text-3xl font-bold text-gray-800 dark:text-white hover:text-primary transition-colors"
              >
                Admin
              </motion.button>

              <motion.div variants={itemVariants} className="w-full h-px bg-gray-200 dark:bg-gray-700 my-4" />

              {isBotActive && (
                <motion.button
                  variants={itemVariants}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    onOrderClick();
                    setIsMenuOpen(false);
                  }}
                  className="w-full bg-primary text-white text-xl font-bold py-4 px-8 rounded-xl shadow-lg hover:bg-red-600 transition-colors"
                >
                  {isStoreOpen ? 'Pedir Online' : 'Reservar Online'}
                </motion.button>
              )}
            </nav>
            
            {/* Decorative elements */}
            <motion.div 
              variants={itemVariants}
              className="absolute bottom-8 text-gray-400 dark:text-gray-500 text-sm"
            >
              © 2024 Pizzería Los Genios
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
