import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export default function UserMenu({ user, items, onSelect }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className={`user-menu-trigger ${open ? "is-open" : ""}`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <div className="user-menu-identity">
          <div className="user-menu-avatar">AI</div>
          <div className="user-menu-text">
            <strong>{user.name}</strong>
            <span>{user.role}</span>
          </div>
        </div>
        <ChevronDown className={`user-menu-chevron ${open ? "rotated" : ""}`} size={16} />
      </button>

      {open ? (
        <div className="user-menu-dropdown" role="menu">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                className={`user-menu-item ${item.tone === "danger" ? "danger" : ""}`}
                onClick={() => {
                  setOpen(false);
                  onSelect(item.id);
                }}
                type="button"
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
