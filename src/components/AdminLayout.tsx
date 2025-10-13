'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
//import { supabase } from '../lib/supabaseClient';
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
const supabase = createClientComponentClient();
import {
  FiHome, FiUsers, FiBook, FiFileText,
  FiSettings, FiMenu, FiLogOut, FiAward,
  FiLayers, FiBookOpen, FiGrid, FiFilePlus,
  FiChevronDown, FiChevronRight, FiX,FiShoppingBag
} from 'react-icons/fi';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [showSidebar, setShowSidebar] = useState(false);
  const [openParents, setOpenParents] = useState<string[]>([]);

  const navItems = [
    { id: '', label: 'Dashboard', icon: <FiHome /> },
    { id: 'users', label: 'User Management', icon: <FiUsers /> },
{ id: 'orders', label: 'Order Management', icon: <FiShoppingBag /> },

    {
      id: 'management',
      label: 'System Management',
      icon: <FiSettings />,
      subItems: [
        { id: 'management/classes', label: 'Classes', icon: <FiLayers /> },
        { id: 'management/subjects', label: 'Subjects', icon: <FiGrid /> },
        { id: 'management/chapters', label: 'Chapters', icon: <FiBookOpen /> },
        { id: 'management/topics', label: 'Topics', icon: <FiFilePlus /> },
        { id: 'management/questions', label: 'Question Bank', icon: <FiBook /> }
      ]
    },
   
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    
    router.push('/auth/login');
  };

  // Active check (Dashboard only when exactly /admin)
  const isItemActive = (id: string) => {
    if (id === '') return pathname === '/admin';
    return pathname?.startsWith(`/admin/${id}`);
  };

  // Auto-open parents if a child is active
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
    <div className="d-flex flex-column min-vh-100">
      {/* Top Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm px-3">
        <button className="navbar-toggler d-lg-none border-0" onClick={() => setShowSidebar(s => !s)}>
          {showSidebar ? <FiX size={24} /> : <FiMenu size={24} />}
        </button>
        <span className="navbar-brand fw-bold">⚡ Admin Dashboard</span>
        <div className="ms-auto">
          <button
            className="btn btn-light btn-sm rounded-pill d-flex align-items-center gap-1 shadow-sm"
            onClick={handleLogout}
          >
            <FiLogOut /> Logout
          </button>
        </div>
      </nav>

      <div className="container-fluid flex-grow-1">
        <div className="row h-100">
          {showSidebar && (
            <div className="sidebar-backdrop d-lg-none" onClick={() => setShowSidebar(false)} />
          )}

          {/* Sidebar */}
          <div
            className={`sidebar col-lg-2 bg-light border-end p-0 shadow-sm ${
              showSidebar ? 'sidebar-show' : 'sidebar-hide'
            }`}
          >
            <div className="p-3 h-100 d-flex flex-column">
              <ul className="nav nav-pills flex-column gap-2 mb-auto">
                {navItems.map(item => (
                  <li key={item.id} className="nav-item">
                    {item.subItems ? (
                      <>
                        <button
                          className={`nav-link d-flex align-items-center gap-2 rounded-pill fw-semibold w-100 text-start ${
                            openParents.includes(item.id) ? 'active-parent' : ''
                          } ${
                            item.subItems.some(si => isItemActive(si.id)) ? 'active-parent' : ''
                          }`}
                          onClick={() => toggleParent(item.id)}
                        >
                          {item.icon}
                          {item.label}
                          <span className="ms-auto">
                            {openParents.includes(item.id) ? <FiChevronDown /> : <FiChevronRight />}
                          </span>
                        </button>

                        <div className={`collapse ${openParents.includes(item.id) ? 'show' : ''}`}>
                          <ul className="nav flex-column gap-1 mt-2 ms-3">
                            {item.subItems.map(subItem => (
                              <li key={subItem.id}>
                                <Link
                                  href={`/admin/${subItem.id}`}
                                  className={`nav-link d-flex align-items-center gap-2 rounded ${
                                    isItemActive(subItem.id) ? 'active-sub' : ''
                                  }`}
                                  onClick={() => setShowSidebar(false)}
                                >
                                  {subItem.icon}
                                  {subItem.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    ) : (
                      <Link
                        href={`/admin/${item.id}`}
                        className={`nav-link d-flex align-items-center gap-2 rounded-pill fw-semibold ${
                          isItemActive(item.id) ? 'active' : ''
                        }`}
                        onClick={() => setShowSidebar(false)}
                      >
                        {item.icon}
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-lg-10 p-4 bg-light">{children}</div>
        </div>
      </div>

      <style jsx>{`
        .nav-link {
          transition: all 0.3s ease;
          color: #333;
        }

        /* Parent / main active (uses :global to beat Bootstrap specificity/order) */
        .sidebar :global(.nav-link.active-parent),
        .sidebar :global(.nav-link.active) {
          background: linear-gradient(45deg, #0d6efd, #4dabf7) !important;
          color: #fff !important;
          font-weight: 700 !important;
        }

        /* Submenu active styling — strong selector + !important so Bootstrap won't override */
        .sidebar :global(.nav-link.active-sub) {
          background: #e7f1ff !important;
          color: #0d6efd !important;
          font-weight: 700 !important;
          font-size: 1.05rem !important;
          border-left: 4px solid #0d6efd !important;
          padding-left: 0.75rem !important;
        }

        .sidebar {
          position: fixed;
          top: 0;
          left: 0;
          height: 100vh;
          z-index: 1040;
          width: 280px;
          transition: transform 0.3s ease;
          overflow-y: auto;
        }
        .sidebar-hide {
          transform: translateX(-100%);
        }
        .sidebar-show {
          transform: translateX(0);
          box-shadow: 5px 0 15px rgba(0, 0, 0, 0.1);
        }
        .sidebar-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1039;
        }
        @media (min-width: 992px) {
          .sidebar {
            position: static;
            height: auto;
            transform: none !important;
            width: auto;
            box-shadow: none !important;
          }
          .sidebar-backdrop {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
