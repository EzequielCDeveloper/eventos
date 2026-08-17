/* ============================================
   FiestaExpert — Tema compartido (theme.js)
   Único origen de tokens Material 3 para los 3
   roles (usuario/, proveedor/, admin/).
   Cargar DESPUÉS del CDN de Tailwind y ANTES de
   style.css de cada rol. Reemplaza los bloques
   inline #tailwind-config duplicados ×3.
   Sin darkMode residual (dark mode es post-MVP).
   ============================================ */
window.tailwind = window.tailwind || {};
window.tailwind.config = {
  theme: {
    extend: {
      colors: {
        "on-surface": "#191c1e",
        "on-error": "#ffffff",
        "tertiary-container": "#5d1600",
        "surface-variant": "#e0e3e6",
        "on-tertiary-fixed": "#3a0a00",
        "on-secondary-container": "#745c00",
        "on-primary-container": "#8690ee",
        "inverse-surface": "#2d3133",
        "tertiary-fixed-dim": "#ffb59f",
        "surface-container": "#eceef1",
        "primary": "#000666",
        "primary-fixed": "#e0e0ff",
        "surface-container-highest": "#e0e3e6",
        "error-container": "#ffdad6",
        "on-primary-fixed-variant": "#343d96",
        "secondary-container": "#fed65b",
        "tertiary": "#390a00",
        "tertiary-fixed": "#ffdbd0",
        "surface-bright": "#f7f9fc",
        "on-secondary-fixed": "#241a00",
        "background": "#f7f9fc",
        "secondary-fixed-dim": "#e9c349",
        "primary-fixed-dim": "#bdc2ff",
        "on-tertiary": "#ffffff",
        "on-tertiary-fixed-variant": "#852300",
        "inverse-primary": "#bdc2ff",
        "surface": "#f7f9fc",
        "on-background": "#191c1e",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f2f4f7",
        "error": "#ba1a1a",
        "on-secondary-fixed-variant": "#574500",
        "inverse-on-surface": "#eff1f4",
        "on-error-container": "#93000a",
        "secondary": "#735c00",
        "secondary-fixed": "#ffe088",
        "surface-container-high": "#e6e8eb",
        "outline-variant": "#c6c5d4",
        "primary-container": "#1a237e",
        "on-tertiary-container": "#f96b3f",
        "on-surface-variant": "#454652",
        "outline": "#767683",
        "surface-tint": "#4c56af",
        "surface-dim": "#d8dadd",
        "on-primary-fixed": "#000767",
        "on-primary": "#ffffff",
        "on-secondary": "#ffffff"
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
      },
      spacing: {
        "margin-mobile": "16px",
        lg: "24px",
        md: "16px",
        "margin-desktop": "64px",
        gutter: "16px",
        "max-width": "1280px",
        sm: "12px",
        xl: "32px",
        xxl: "48px",
        base: "8px",
        xs: "4px",
        safe: "env(safe-area-inset-bottom)"
      },
      fontFamily: {
        "label-sm": ["Inter"],
        "label-md": ["Inter"],
        "headline-md": ["Montserrat"],
        "body-lg": ["Inter"],
        "body-md": ["Inter"],
        "display-lg": ["Montserrat"],
        "headline-lg": ["Montserrat"],
        "headline-lg-mobile": ["Montserrat"]
      },
      fontSize: {
        "label-sm": ["12px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "600" }],
        "label-md": ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "500" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", fontWeight: "600" }],
        "headline-lg-mobile": ["24px", { lineHeight: "32px", fontWeight: "600" }]
      }
    }
  }
};
