import React from 'react';
import { Sprout, Facebook, Instagram, Youtube } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-[#155E3C] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Contenuto centrato */}
        <div className="flex flex-col items-center text-center">

          {/* Logo e nome */}
          <div className="flex items-center space-x-2 mb-3">
            <Sprout className="h-7 w-7 text-emerald-300" />
            <span className="font-bold text-lg">Greenfield Advisor</span>
          </div>

          
          <p className="text-emerald-100 mb-4 text-sm max-w-xl italic">
            Coltiva con passione, guidato dall'intelligenza.<br />
            La tecnologia che fa fiorire il tuo pollice verde.
          </p>

          {/* Social Icons */}
          <div className="flex space-x-3 mb-4">
            <Link
              to="#"
              aria-label="Facebook"
              className="bg-emerald-700 p-2 rounded-full hover:bg-emerald-600 transition-colors"
            >
              <Facebook className="h-4 w-4" />
            </Link>

            <Link
              to="#"
              aria-label="Instagram"
              className="bg-emerald-700 p-2 rounded-full hover:bg-emerald-600 transition-colors"
            >
              <Instagram className="h-4 w-4" />
            </Link>

            <Link
              to="#"
              aria-label="YouTube"
              className="bg-emerald-700 p-2 rounded-full hover:bg-emerald-600 transition-colors"
            >
              <Youtube className="h-4 w-4" />
            </Link>
          </div>

          {/* Copyright */}
          <div className="border-t border-emerald-700 w-full pt-4">
            <p className="text-emerald-100 text-xs text-center">
              © 2025 Greenfield Advisor. Tutti i diritti riservati.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;