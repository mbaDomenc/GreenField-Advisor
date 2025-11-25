import React from 'react';
import { Link } from 'react-router-dom';
import { Sprout, Brain, Sliders, ArrowRight, Stars } from 'lucide-react';

const HomePage = () => {
    return (
        <div className="min-h-screen pt-28 pb-20 px-4 overflow-hidden bg-emerald-50">
            
            {/* Sfondo sfocato decorativo */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                 <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-emerald-300/20 rounded-full blur-[120px]"></div>
                 <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-teal-300/20 rounded-full blur-[120px]"></div>
            </div>

            {/* HERO SECTION */}
            <div className="max-w-7xl mx-auto text-center mb-24 relative">
                
                <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white border border-emerald-100 shadow-sm text-emerald-700 text-sm font-bold mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <Stars className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                    L'agricoltura del futuro è qui
                </div>
                
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-gray-900 mb-8 leading-[1.1] animate-in fade-in slide-in-from-bottom-6 duration-1000">
                    Coltiva con <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">
                        Intelligenza
                    </span>
                </h1>
                
                <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed font-medium mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
                    Greenfield Advisor è il tuo assistente personale. Analisi del terreno, diagnosi visiva e piani di irrigazione su misura per il tuo orto.
                </p>
                
                <div className="flex flex-col sm:flex-row justify-center gap-5 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200">
                    <Link to="/register" className="btn-bouncy bg-emerald-600 text-white px-10 py-4 rounded-full text-lg font-bold shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 hover:bg-emerald-500 transition-colors">
                        Inizia Gratis <ArrowRight className="h-5 w-5" />
                    </Link>
                    <button 
                        onClick={() => document.getElementById('features').scrollIntoView({behavior: 'smooth'})} 
                        className="btn-bouncy bg-white text-gray-700 px-10 py-4 rounded-full text-lg font-bold shadow-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                        Scopri di più
                    </button>
                </div>

                {/* Immagine Hero Fluttuante */}
                <div className="mt-20 relative mx-auto max-w-5xl animate-in fade-in zoom-in duration-1000 delay-300">
                    <div className="rounded-[2.5rem] overflow-hidden shadow-2xl border-[8px] border-white bg-emerald-100 aspect-video relative group transform hover:scale-[1.01] transition-transform duration-700">
                         <img 
                            src="https://images.unsplash.com/photo-1625246333195-78d9c38ad449?q=80&w=2000&auto=format&fit=crop" 
                            alt="Greenfield Dashboard" 
                            className="w-full h-full object-cover opacity-95 group-hover:opacity-100 transition-opacity duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/60 to-transparent pointer-events-none"></div>
                        
                        {/* Floating Badge */}
                        <div className="absolute bottom-8 left-8 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg flex items-center gap-4 animate-bounce-slow">
                             <div className="bg-green-100 p-3 rounded-xl text-green-600"><Sprout size={24} /></div>
                             <div className="text-left">
                                 <p className="text-xs font-bold text-gray-500 uppercase">Status</p>
                                 <p className="text-sm font-bold text-gray-900">Ottima Salute 🌿</p>
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* FEATURES SECTION */}
            <div id="features" className="max-w-7xl mx-auto px-6 lg:px-8 pb-20">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold text-emerald-900 mb-4">Tecnologia al servizio della natura</h2>
                    <p className="text-gray-600 max-w-2xl mx-auto">Abbiamo unito agronomia e intelligenza artificiale per darti gli strumenti migliori.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <FeatureCard 
                        icon={<Sprout className="h-8 w-8 text-emerald-600" />}
                        title="Gestione Crescita"
                        desc="Un diario digitale avanzato. Tieni traccia di ogni fase, dalla semina al raccolto."
                        color="bg-emerald-100"
                    />
                    <FeatureCard 
                        icon={<Brain className="h-8 w-8 text-purple-600" />}
                        title="Diagnosi IA"
                        desc="Scatta una foto e la nostra rete neurale identificherà malattie e parassiti all'istante."
                        color="bg-purple-100"
                    />
                    <FeatureCard 
                        icon={<Sliders className="h-8 w-8 text-blue-600" />}
                        title="Consulenza Idrica"
                        desc="Piani di irrigazione intelligenti basati sul meteo reale e sul tuo tipo di terreno."
                        color="bg-blue-100"
                    />
                </div>
            </div>
        </div>
    );
};

const FeatureCard = ({ icon, title, desc, color }) => (
    <div className="hover-float bg-white p-10 rounded-[2.5rem] shadow-xl shadow-emerald-900/5 border border-white/50 flex flex-col items-start h-full group transition-all duration-300 hover:border-emerald-100">
        <div className={`w-16 h-16 ${color} rounded-2xl flex items-center justify-center mb-6 transform rotate-3 group-hover:rotate-12 transition-transform duration-500 shadow-sm`}>
            {icon}
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-3 group-hover:text-emerald-700 transition-colors">{title}</h3>
        <p className="text-gray-600 leading-relaxed text-lg">{desc}</p>
    </div>
);

export default HomePage;