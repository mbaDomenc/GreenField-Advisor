import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Menu, X, Sprout, User, UserPlus, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
    const [openMobile, setOpenMobile] = useState(false);
    const [openPiante, setOpenPiante] = useState(false);
    const [openAI, setOpenAI] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    const mobileRef = useRef(null);
    const pianteRef = useRef(null);
    const aiRef = useRef(null);

    const navigate = useNavigate();
    const { isAuthenticated, user, logout } = useAuth();
    const avatarUrl = user?.avatarUrl ?? null;
    const initials = (user?.username || user?.email || 'U').slice(0, 2).toUpperCase();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll);
        
        const handleClickOutside = (event) => {
            if (mobileRef.current && !mobileRef.current.contains(event.target)) setOpenMobile(false);
            if (pianteRef.current && !pianteRef.current.contains(event.target)) setOpenPiante(false);
            if (aiRef.current && !aiRef.current.contains(event.target)) setOpenAI(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        
        return () => {
            window.removeEventListener('scroll', onScroll);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const navClasses = `fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out px-4 md:px-8 ${
        scrolled ? 'py-2' : 'py-5'
    }`;

    const glassContainer = `mx-auto max-w-7xl rounded-full glass shadow-xl/10 transition-all duration-500 flex items-center justify-between px-6 ${
        scrolled ? 'h-16 bg-white/80' : 'h-20 bg-white/60'
    }`;

    const linkBase = "relative font-medium text-gray-600 hover:text-emerald-600 transition-colors px-4 py-2 rounded-full hover:bg-emerald-50/80";
    const linkActive = "text-emerald-700 bg-emerald-100/80 font-bold shadow-sm";

    const btnPrimary = "btn-bouncy bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-2.5 rounded-full font-semibold shadow-lg shadow-emerald-200 flex items-center gap-2";
    const btnGhost = "btn-bouncy border-2 border-emerald-100 text-emerald-700 px-6 py-2 rounded-full font-semibold hover:bg-white hover:border-emerald-200";

    const dropPanel = "absolute top-full left-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-emerald-100 overflow-hidden p-2 animate-in fade-in slide-in-from-top-2 duration-200";
    const dropItem = "block px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors";

    const handleLogout = async () => {
        await logout();
        navigate('/', { replace: true });
    };

    return (
        <nav className={navClasses}>
            <div className={glassContainer}>
                
                <Link to="/" className="flex items-center gap-2.5 group">
                    <div className="bg-gradient-to-br from-emerald-400 to-teal-500 p-2.5 rounded-xl shadow-lg group-hover:rotate-12 transition-transform duration-300">
                        <Sprout className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-700 to-teal-600 tracking-tight">
                        Greenfield
                    </span>
                </Link>

                <div className="hidden md:flex items-center gap-2">
                    {!isAuthenticated ? (
                        <>
                            <NavLink to="/" end className={({isActive}) => `${linkBase} ${isActive ? linkActive : ''}`}>Home</NavLink>
                            <a href="/#funzionalita" className={linkBase}>Funzionalità</a>
                        </>
                    ) : (
                        <>
                            <NavLink to="/dashboard" className={({isActive}) => `${linkBase} ${isActive ? linkActive : ''}`}>Dashboard</NavLink>
                            
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

                            <div className="relative" ref={aiRef}>
                                <button onClick={() => { setOpenAI(!openAI); setOpenPiante(false); }} className={`${linkBase} flex items-center gap-1`}>
                                    AI Tools <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${openAI ? 'rotate-180':''}`} />
                                </button>
                                {openAI && (
                                    <div className={dropPanel}>
                                        <div className="px-4 py-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">Strumenti Smart</div>
                                        <Link to="/ai/irrigazione" className={dropItem} onClick={() => setOpenAI(false)}>🤖 Assistente Coltivazione</Link>
                                        <Link to="/ai/pipeline-test" className={dropItem} onClick={() => setOpenAI(false)}>
                                            🌿Analisi Idoneità Ambientale
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className="hidden md:flex items-center gap-4">
                    {!isAuthenticated ? (
                        <>
                            <Link to="/login" className={btnGhost}>Accedi</Link>
                            <Link to="/register" className={btnPrimary}>Inizia Ora</Link>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 pl-4 border-l border-emerald-100">
                                <div className="h-10 w-10 rounded-full p-[2px] bg-gradient-to-tr from-emerald-400 to-teal-500 shadow-md">
                                    <div className="h-full w-full rounded-full bg-white p-0.5 overflow-hidden">
                                        {avatarUrl ? 
                                            <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover rounded-full" /> : 
                                            <div className="h-full w-full bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold text-sm">{initials}</div>
                                        }
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-700 leading-none">{user?.username}</span>
                                    <Link to="/profilo" className="text-xs text-emerald-600 hover:underline">Vedi profilo</Link>
                                </div>
                            </div>
                            <button onClick={handleLogout} className="p-2.5 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Esci">
                                <LogOut className="h-5 w-5" />
                            </button>
                        </>
                    )}
                </div>

                <button className="md:hidden p-2 text-emerald-800" onClick={() => setOpenMobile(!openMobile)}>
                    {openMobile ? <X /> : <Menu />}
                </button>
            </div>

            {openMobile && (
                <div ref={mobileRef} className="md:hidden absolute top-24 left-4 right-4 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-6 border border-white/50 animate-in slide-in-from-top-4 z-50">
                    <div className="flex flex-col space-y-2">
                        {!isAuthenticated ? (
                            <>
                                <Link to="/" onClick={() => setOpenMobile(false)} className="p-3 font-bold text-gray-700">Home</Link>
                                <Link to="/login" onClick={() => setOpenMobile(false)} className="w-full text-center py-3 rounded-xl bg-gray-100 font-bold text-gray-700">Accedi</Link>
                                <Link to="/register" onClick={() => setOpenMobile(false)} className="w-full text-center py-3 rounded-xl bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-200">Registrati</Link>
                            </>
                        ) : (
                            <>
                                <Link to="/dashboard" onClick={() => setOpenMobile(false)} className="p-3 font-bold text-gray-700 hover:bg-gray-50 rounded-xl">Dashboard</Link>
                                <div className="bg-emerald-50/50 rounded-2xl p-2 space-y-1">
                                    <p className="px-3 py-2 text-xs font-bold text-emerald-400 uppercase">Menu Rapido</p>
                                    <Link to="/piante" onClick={() => setOpenMobile(false)} className="block p-3 rounded-xl hover:bg-white font-medium text-emerald-800">🌿 Le mie piante</Link>
                                    <Link to="/ai/irrigazione" onClick={() => setOpenMobile(false)} className="block p-3 rounded-xl hover:bg-white font-medium text-emerald-800">🤖 Assistente AI</Link>
                                </div>
                                <button onClick={() => {handleLogout(); setOpenMobile(false)}} className="w-full py-3 mt-2 text-red-500 font-bold hover:bg-red-50 rounded-xl">Esci</button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
}