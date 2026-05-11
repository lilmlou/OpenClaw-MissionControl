// Manual mock for react-router-dom (v7 ESM, used in Jest tests)
const React = require("react");

// Use function declarations for hoisting safety
function useSearchParams() { return [new URLSearchParams(), jest.fn()]; }
function useLocation() { return { pathname: "/", search: "", hash: "", state: null, key: "default" }; }
function useNavigate() { return jest.fn(); }
function useParams() { return {}; }
function useMatch() { return null; }
function useResolvedPath(to) { return to; }
function useHref(to) { return to; }
function useLinkClickHandler() { return jest.fn(); }
function useLinkPressHandler() { return jest.fn(); }
function Link({ to, children, ...props }) { return React.createElement("a", { href: typeof to === "string" ? to : "#", ...props }, children); }
function NavLink({ to, children, ...props }) { return React.createElement("a", { href: typeof to === "string" ? to : "#", ...props }, children); }
function Navigate() { return null; }
function Routes({ children }) { return children; }
function Route({ element }) { return element; }
function Outlet() { return null; }
function MemoryRouter({ children }) { return children; }
function BrowserRouter({ children }) { return children; }
function Router({ children }) { return children; }

module.exports = {
  useSearchParams,
  useLocation,
  useNavigate,
  useParams,
  useMatch,
  useResolvedPath,
  useHref,
  useLinkClickHandler,
  useLinkPressHandler,
  Link,
  NavLink,
  Navigate,
  Routes,
  Route,
  Outlet,
  MemoryRouter,
  BrowserRouter,
  Router,
};