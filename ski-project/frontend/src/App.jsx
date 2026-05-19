import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./components/Home";
import About from "./components/About";
import Dashboard from "./components/Dashboard";
import ChatWidget from "./components/ChatWidget";
import logoImg from "./assets/logo.png";
import "./styles.css";

// d 

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [user, setUser] = useState(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  
  // Helper to load view state from url pathname on startup
  const getInitialView = () => {
    const path = window.location.pathname;
    if (path === "/about") return "about";
    if (path === "/dashboard" || path === "/scanner") return "dashboard";
    return "home";
  };

  // Theme & Routing View States
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [activeView, setActiveView] = useState(getInitialView);

  // Sync activeView state directly with URL pathname in address bar
  useEffect(() => {
    const currentPath = window.location.pathname;
    let targetPath = "/";
    if (activeView === "about") targetPath = "/about";
    else if (activeView === "dashboard") targetPath = "/dashboard";

    if (currentPath !== targetPath) {
      window.history.pushState({}, "", targetPath);
    }
  }, [activeView]);

  // Handle browser Back/Forward navigation clicks
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === "/about") setActiveView("about");
      else if (path === "/dashboard" || path === "/scanner") setActiveView("dashboard");
      else setActiveView("home");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // 1. Theme handler effect
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // 2. Detect Token in URL redirection (Google or Mock Login Callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("token");

    if (tokenFromUrl) {
      localStorage.setItem("token", tokenFromUrl);
      setToken(tokenFromUrl);
      setActiveView("dashboard");
      // Clean up the URL query params so they don't linger in the address bar
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // 3. Fetch user profile whenever token changes or on application launch
  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) {
        setUser(null);
        if (activeView === "dashboard") {
          setActiveView("home");
        }
        return;
      }
      setAuthLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const profileData = await res.json();
          setUser(profileData);
        } else {
          // Token expired or invalid, clear it
          handleLogout();
        }
      } catch (err) {
        console.error("Profile authorization check failed:", err);
      } finally {
        setAuthLoading(false);
      }
    };

    fetchProfile();
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setActiveView("home");
  };

  const handleLoginClick = () => {
    setIsLoginOpen(true);
  };

  return (
    <div className="app-shell">
      {/* Premium Navbar */}
      <Navbar 
        user={user} 
        onLogout={handleLogout} 
        onLoginClick={handleLoginClick}
        activeView={activeView}
        setActiveView={setActiveView}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      {/* Main View Router */}
      <main className="main-content-panel">
        {authLoading ? (
          <div className="auth-loader-screen">
            <div className="auth-spinner"></div>
            <p>Authenticating secure session...</p>
          </div>
        ) : activeView === "about" ? (
          <About onLoginClick={handleLoginClick} user={user} />
        ) : activeView === "dashboard" && user ? (
          <Dashboard
            user={user}
            token={token}
            API_URL={API_URL}
            onUserUpdate={(updatedUser) => setUser(updatedUser)}
            onLogout={handleLogout}
          />
        ) : (
          <Home token={token} onLoginClick={handleLoginClick} user={user} onScanClick={() => setActiveView("dashboard")} />
        )}
      </main>

      {/* Premium Footer */}
      <Footer setActiveView={setActiveView} user={user} />

      {/* Sleek Sign-In Overlay Portal Modal */}
      {isLoginOpen && (
        <div className="login-modal-overlay animate-fade-in" onClick={() => setIsLoginOpen(false)}>
          <div className="login-modal-card glass-card animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <button className="login-modal-close" onClick={() => setIsLoginOpen(false)}>&times;</button>
            
            <div className="login-modal-header">
              <img src={logoImg} alt="Scan Karega India" className="modal-brand-logo-img" />
              <h3>Sign In to Scan Karega India</h3>
              <p>Sign in to unlock label scanning, analyze ingredients, and save your historical product ratings.</p>
            </div>

            <div className="login-modal-body">
              {/* Google Sign-in */}
              <a href={`${API_URL}/api/auth/google/login`} className="btn-login-google">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7v2.24h2.9c1.69-1.55 2.69-3.84 2.69-6.57z" fill="#4285F4" />
                  <path d="M9 18c2.43 0 4.47-.8 5.96-2.23l-2.9-2.24c-.8.54-1.84.87-3.06.87-2.35 0-4.34-1.58-5.05-3.7H.94v2.32C2.42 15.98 5.51 18 9 18z" fill="#34A853" />
                  <path d="M3.95 10.7a5.4 5.4 0 0 1 0-3.4V4.98H.94a9 9 0 0 0 0 8.04l3.01-2.32z" fill="#FBBC05" />
                  <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15 2.3A9 9 0 0 0 .94 4.98l3.01 2.32C4.66 5.16 6.65 3.58 9 3.58z" fill="#EA4335" />
                </svg>
                Continue with Google
              </a>
            </div>
          </div>
        </div>
      )}
      
      {/* Global responsive AI Chat Widget */}
      <ChatWidget />
    </div>
  );
}
