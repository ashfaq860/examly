'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { 
  LayoutDashboard, Users, ShoppingBag, Settings, 
  Layers, Grid, BookOpen, FilePlus, Book, 
  ChevronDown, ChevronRight, Menu, X, LogOut, 
  ShieldCheck, Zap 
} from 'lucide-react';

const supabase = createClientComponentClient();

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [showSidebar, setShowSidebar] = useState(false);
  const [openParents, setOpenParents] = useState<string[]>([]);

  const navItems = [
    { id: '', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'users', label: 'User Management', icon: <Users size={18} /> },
    { id: 'orders', label: 'Order Management', icon: <ShoppingBag size={18} /> },
    {
      id: 'management',
      label: 'System Setup',
      icon: <Settings size={18} />,
      subItems: [
        { id: 'management/classes', label: 'Classes', icon: <Layers size={16} /> },
        { id: 'management/subjects', label: 'Subjects', icon: <Grid size={16} /> },
        { id: 'management/chapters', label: 'Chapters', icon: <BookOpen size={16} /> },
        { id: 'management/topics', label: 'Topics', icon: <FilePlus size={16} /> },
        { id: 'management/questions', label: 'Question Bank', icon: <Book size={16} /> }
      ]
    },
    { id: 'subject-rules', label: 'Question Rules', icon: <ShieldCheck size={18} /> },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  const isItemActive = (id: string) => {
    if (id === '') return pathname === '/admin';
    return pathname?.startsWith(`/admin/${id}`);
  };

  useEffect(() => {
    const activeParents: string[] = [];
    navItems.forEach(item => {
      if (item.subItems && item.subItems.some(si => isItemActive(si.id))) {
        activeParents.push(item.id);
      }
    });
    setOpenParents(activeParents);
  }, [pathname]);

  const toggleParent = (parentId: string) => {
    setOpenParents(prev =>
      prev.includes(parentId) ? prev.filter(id => id !== parentId) : [...prev, parentId]
    );
  };

  return (
    <div className="admin-container">
      {/* Top Header */}
      <header className="admin-header">
        <div className="d-flex align-items-center gap-3">
          <button className="menu-toggle d-lg-none" onClick={() => setShowSidebar(!showSidebar)}>
            {showSidebar ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="brand-box">
            <div className="brand-logo"><Zap size={16} fill="currentColor" /></div>
            <span className="brand-text">EXAMLY <span className="text-muted fw-normal">ADMIN</span></span>
          </div>
        </div>

        <div className="header-actions">
          <button className="logout-pill" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <div className="main-layout">
        {/* Sidebar */}
        <aside className={`admin-sidebar ${showSidebar ? 'mobile-show' : ''}`}>
          <nav className="sidebar-nav">
            <div className="nav-section-label">Main Menu</div>
            {navItems.map(item => (
              <div key={item.id} className="nav-group">
                {item.subItems ? (
                  <>
                    <button
                      className={`nav-item-btn ${openParents.includes(item.id) ? 'expanded' : ''} ${item.subItems.some(si => isItemActive(si.id)) ? 'active' : ''}`}
                      onClick={() => toggleParent(item.id)}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-label">{item.label}</span>
                      <ChevronRight className="arrow-icon" size={14} />
                    </button>
                    <div className={`sub-nav ${openParents.includes(item.id) ? 'open' : ''}`}>
                      {item.subItems.map(subItem => (
                        <Link
                          key={subItem.id}
                          href={`/admin/${subItem.id}`}
                          className={`sub-nav-item ${isItemActive(subItem.id) ? 'active' : ''}`}
                          onClick={() => window.innerWidth < 992 && setShowSidebar(false)}
                        >
                          {subItem.label}
                        </Link>
                      ))}
                    </div>
                  </>
                ) : (
                  <Link
                    href={`/admin/${item.id}`}
                    className={`nav-item-btn ${isItemActive(item.id) ? 'active' : ''}`}
                    onClick={() => window.innerWidth < 992 && setShowSidebar(false)}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="content-area">
          <div className="content-wrapper">
            {children}
          </div>
        </main>
      </div>

      {showSidebar && <div className="sidebar-overlay" onClick={() => setShowSidebar(false)} />}

      <style jsx global>{`
        :root {
          --sidebar-width: 260px;
          --header-height: 70px;
          --primary-blue: #2563eb;
          --bg-soft: #f8fafc;
          --border-color: #f1f5f9;
          --text-main: #1e293b;
          --text-muted: #64748b;
        }

        body {
          background-color: var(--bg-soft);
          color: var(--text-main);
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        .admin-header {
          height: var(--header-height);
          background: #fff;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 1.5rem;
          position: fixed;
          top: 0;
          width: 100%;
          z-index: 1050;
        }

        .brand-box {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-logo {
          width: 32px;
          height: 32px;
          background: var(--primary-blue);
          color: white;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .brand-text {
          font-weight: 800;
          letter-spacing: -0.5px;
          font-size: 1.1rem;
        }

        .logout-pill {
          background: var(--bg-soft);
          border: 1px solid var(--border-color);
          padding: 6px 16px;
          border-radius: 100px;
          font-size: 0.85rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .logout-pill:hover {
          background: #fee2e2;
          border-color: #fecaca;
          color: #dc2626;
        }

        .main-layout {
          display: flex;
          padding-top: var(--header-height);
          min-height: 100vh;
        }

        .admin-sidebar {
          width: var(--sidebar-width);
          background: #fff;
          border-right: 1px solid var(--border-color);
          position: fixed;
          height: calc(100vh - var(--header-height));
          overflow-y: auto;
          padding: 1.5rem 1rem;
          z-index: 1040;
          transition: transform 0.3s ease;
        }

        .nav-section-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-muted);
          font-weight: 700;
          margin-bottom: 1rem;
          padding-left: 0.75rem;
        }

        .nav-item-btn {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 10px 12px;
          border-radius: 10px;
          color: var(--text-main);
          font-weight: 500;
          font-size: 0.925rem;
          background: transparent;
          border: none;
          transition: all 0.2s;
          margin-bottom: 4px;
          text-decoration: none;
        }

        .nav-item-btn:hover {
          background: var(--bg-soft);
          color: var(--primary-blue);
        }

        .nav-item-btn.active {
          background: #eff6ff;
          color: var(--primary-blue);
          font-weight: 600;
        }

        .nav-icon {
          margin-right: 12px;
          display: flex;
          align-items: center;
          opacity: 0.7;
        }

        .nav-item-btn.active .nav-icon {
          opacity: 1;
        }

        .arrow-icon {
          margin-left: auto;
          transition: transform 0.2s;
        }

        .nav-item-btn.expanded .arrow-icon {
          transform: rotate(90deg);
        }

        .sub-nav {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease-out;
          padding-left: 2.2rem;
        }

        .sub-nav.open {
          max-height: 500px;
        }

        .sub-nav-item {
          display: block;
          padding: 8px 12px;
          font-size: 0.85rem;
          color: var(--text-muted);
          text-decoration: none;
          border-left: 1px solid var(--border-color);
          transition: all 0.2s;
        }

        .sub-nav-item:hover, .sub-nav-item.active {
          color: var(--primary-blue);
          border-left-color: var(--primary-blue);
        }

        .content-area {
          flex-grow: 1;
          margin-left: var(--sidebar-width);
          padding: 2rem;
          background-color: var(--bg-soft);
        }

        @media (max-width: 991px) {
          .admin-sidebar {
            transform: translateX(-100%);
          }
          .admin-sidebar.mobile-show {
            transform: translateX(0);
          }
          .content-area {
            margin-left: 0;
            padding: 1.5rem;
          }
        }

        .sidebar-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(4px);
          z-index: 1035;
        }
      `}</style>
    </div>
  );
}