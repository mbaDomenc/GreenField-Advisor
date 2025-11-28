import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Menu, X, Sprout, User, UserPlus, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
    const [openMobile, setOpenMobile] = useState(false);
    const [openPiante, setOpenPiante] = useState(false);
    const [openAI, setOpenAI] = useState(false);
    const mobileRef = useRef(null);
    const pianteRef = useRef(null);
    const aiRef = useRef(null);

    const navigate = useNavigate();
    const { isAuthenticated, user, logout } = useAuth();
    const avatarUrl = user?.avatarUrl ?? null;
    const initials = (user?.username || user?.email || 'U').slice(0, 2).toUpperCase();

    // Gestione chiusura menu al click esterno
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (mobileRef.current && !mobileRef.current.contains(event.target)) setOpenMobile(false);
            if (pianteRef.current && !pianteRef.current.contains(event.target)) setOpenPiante(false);
            if (aiRef.current && !aiRef.current.contains(event.target)) setOpenAI(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    
    // Barra fissa in alto, tutta larghezza, sfondo bianco semitrasparente
    const navClasses = "absolute top-0 left-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-emerald-100 shadow-sm h-20";
    
    // Contenitore interno centrato standard
    const containerClasses = "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between";

    const linkBase = "relative font-medium text-gray-600 hover:text-emerald-600 transition-colors px-3 py-2 rounded-lg hover:bg-emerald-50";
    const linkActive = "text-emerald-700 bg-emerald-50 font-bold";

    const btnPrimary = "bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-200 flex items-center gap-2";
    const btnGhost = "border border-emerald-200 text-emerald-700 px-5 py-2.5 rounded-lg font-semibold hover:bg-emerald-50 transition-colors";

    const dropPanel = "absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-emerald-100 overflow-hidden p-2 animate-in fade-in slide-in-from-top-2 duration-200";
    const dropItem = "block px-4 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors";

    const handleLogout = async () => {
        await logout();
        navigate('/', { replace: true });
    };

    return (
        <nav className={navClasses}>
            <div className={containerClasses}>
                
                {/* LOGO */}
                <Link to="/" className="flex items-center gap-2.5 group">
                    <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600 group-hover:rotate-12 transition-transform duration-300">
                        <Sprout className="h-6 w-6" />
                    </div>
                    <span className="text-xl font-extrabold text-gray-800 tracking-tight group-hover:text-emerald-700 transition-colors">
                        Greenfield
                    </span>
                </Link>

                {/* DESKTOP MENU */}
                <div className="hidden md:flex items-center gap-4">
                    {!isAuthenticated ? (
                        <>
                            <NavLink to="/" end className={({isActive}) => `${linkBase} ${isActive ? linkActive : ''}`}>Home</NavLink>
                            <a href="/#funzionalita" className={linkBase}>Funzionalità</a>
                        </>
                    ) : (
                        <>
                            <NavLink to="/dashboard" className={({isActive}) => `${linkBase} ${isActive ? linkActive : ''}`}>Dashboard</NavLink>
                            
                            {/* Dropdown Piante */}
                            <div className="relative" ref={pianteRef}>
                                <button onClick={() => { setOpenPiante(!openPiante); setOpenAI(false); }} className={`${linkBase} flex items-center gap-1`}>
                                    Piante <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${openPiante ? 'rotate-180':''}`} />
                                </button>
                                {openPiante && (
                                    <div className={dropPanel}>
                                        <div className="px-4 py-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">Il tuo giardino</div>
                                        <Link to="/piante" className={dropItem} onClick={() => setOpenPiante(false)}>🌿 Le mie piante</Link>
                                    </div>
                                )}
                            </div>

                            {/* Dropdown AI Tools */}
                            <div className="relative" ref={aiRef}>
                                <button onClick={() => { setOpenAI(!openAI); setOpenPiante(false); }} className={`${linkBase} flex items-center gap-1`}>
                                    AI Tools <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${openAI ? 'rotate-180':''}`} />
                                </button>
                                {openAI && (
                                    <div className={dropPanel}>
                                        <div className="px-4 py-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">Strumenti Smart</div>
                                        <Link to="/ai/irrigazione" className={dropItem} onClick={() => setOpenAI(false)}>🤖 Assistente Coltivazione</Link>
                                        <Link to="/ai/pipeline-test" className={dropItem} onClick={() => setOpenAI(false)}>🧪 Analisi Idoneità</Link>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* AZIONI DESTRA */}
                <div className="hidden md:flex items-center gap-4">
                    {!isAuthenticated ? (
                        <>
                            <Link to="/login" className={btnGhost}>Accedi</Link>
                            <Link to="/register" className={btnPrimary}>Inizia Ora</Link>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 pl-4 border-l border-gray-200 h-8">
                                <div className="h-9 w-9 rounded-full p-[1px] bg-emerald-100 border border-emerald-200">
                                    {avatarUrl ? 
                                        <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover rounded-full" /> : 
                                        <div className="h-full w-full rounded-full flex items-center justify-center text-emerald-700 font-bold text-sm">{initials}</div>
                                    }
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-700 leading-none">{user?.username}</span>
                                    <Link to="/profilo" className="text-xs text-emerald-600 hover:underline">Vedi profilo</Link>
                                </div>
                            </div>
                            <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Esci">
                                <LogOut className="h-5 w-5" />
                            </button>
                        </>
                    )}
                </div>

                {/* MOBILE TOGGLE */}
                <button className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg" onClick={() => setOpenMobile(!openMobile)}>
                    {openMobile ? <X /> : <Menu />}
                </button>
            </div>

            {/* MOBILE MENU */}
            {openMobile && (
                <div ref={mobileRef} className="md:hidden absolute top-20 left-0 w-full bg-white border-b border-emerald-100 shadow-xl z-40">
                    <div className="flex flex-col p-4 space-y-2">
                        {!isAuthenticated ? (
                            <>
                                <Link to="/" onClick={() => setOpenMobile(false)} className="p-3 font-bold text-gray-700 hover:bg-gray-50 rounded-lg">Home</Link>
                                <Link to="/login" onClick={() => setOpenMobile(false)} className="block w-full text-center py-3 rounded-lg bg-gray-100 font-bold text-gray-700">Accedi</Link>
                                <Link to="/register" onClick={() => setOpenMobile(false)} className="block w-full text-center py-3 rounded-lg bg-emerald-600 text-white font-bold">Registrati</Link>
                            </>
                        ) : (
                            <>
                                <Link to="/dashboard" onClick={() => setOpenMobile(false)} className="p-3 font-bold text-gray-700 hover:bg-gray-50 rounded-lg">Dashboard</Link>
                                <div className="bg-emerald-50/50 rounded-xl p-2 space-y-1">
                                    <p className="px-3 py-2 text-xs font-bold text-emerald-500 uppercase">Menu Rapido</p>
                                    <Link to="/piante" onClick={() => setOpenMobile(false)} className="block p-3 rounded-lg hover:bg-white font-medium text-emerald-800">🌿 Le mie piante</Link>
                                    <Link to="/ai/irrigazione" onClick={() => setOpenMobile(false)} className="block p-3 rounded-lg hover:bg-white font-medium text-emerald-800">🤖 Assistente AI</Link>
                                    <Link to="/ai/pipeline-test" onClick={() => setOpenMobile(false)} className="block p-3 rounded-lg hover:bg-white font-medium text-emerald-800">🧪 Analisi Idoneità</Link>
                                </div>
                                <button onClick={() => {handleLogout(); setOpenMobile(false)}} className="w-full py-3 mt-2 text-red-500 font-bold hover:bg-red-50 rounded-lg">Esci</button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
}