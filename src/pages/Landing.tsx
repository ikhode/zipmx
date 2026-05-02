import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/landing.css';

export default function Landing() {
  return (
    <div className="landing-container">
      <nav className="landing-nav">
        <Link to="/" className="landing-logo">
          <img src="/logo.png" alt="Zipp Logo" onError={(e) => { e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="%232563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><path d="M10 14l4-8-4 8z"/></svg>'}} />
          <span>Zipp</span>
        </Link>
        <div className="landing-nav-links">
          <a href="#features">Características</a>
          <a href="#drivers">Conductores</a>
          <Link to="/app" className="btn-primary" style={{ padding: '0.5rem 1rem' }}>Abrir Web App</Link>
        </div>
      </nav>

      <main className="landing-hero">
        <h1 className="fade-in">La movilidad que mereces, <br/>al alcance de tu mano</h1>
        <p className="stagger-in">
          Zipp es la plataforma que conecta a pasajeros con conductores confiables de manera rápida, segura y económica. Descubre una nueva forma de moverte por la ciudad.
        </p>
        <div className="hero-buttons stagger-in" style={{ animationDelay: '0.2s' }}>
          <Link to="/app" className="btn-primary">Pedir un viaje ahora</Link>
          <a href="#download" className="btn-outline">Descargar App</a>
        </div>
      </main>

      <footer className="landing-footer">
        <div className="landing-logo" style={{ fontSize: '1.25rem' }}>
          <img src="/logo.png" alt="Zipp Logo" style={{ height: '30px' }} onError={(e) => { e.currentTarget.style.display = 'none'}} />
          <span>Zipp</span>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>© {new Date().getFullYear()} Zipp Technologies. Todos los derechos reservados.</p>
        <div className="footer-links">
          <Link to="/privacy">Política de Privacidad</Link>
          <Link to="/terms">Términos de Servicio</Link>
          <a href="mailto:soporte@inteligent.software">Contacto de Soporte</a>
        </div>
      </footer>
    </div>
  );
}
