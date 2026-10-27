import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getAccountSession, loginAccount, registerAccount, logoutAccount, cancelPrivateRequests } from "@workspace/api-client-react";
import AccountPage from "@/pages/account";
import EmailSignIn from "@/pages/email-signin";

type User = { id: number; email: string };
const AccountContext = createContext<{ user: User; signOut: () => Promise<void> } | null>(null);
export function useAccount() { return useContext(AccountContext)!; }

export function AccountBoundary({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [client, setClient] = useState(() => new QueryClient());
  const [location, navigate] = useLocation();
  const reset = () => {
    cancelPrivateRequests();
    void client.cancelQueries();
    client.clear();
    setUser(null);
    setClient(new QueryClient());
  };
  useEffect(() => {
    let alive = true;
    getAccountSession().then(s => { if (alive) setUser(s.user); }).catch(e => {
      if (alive && e.status !== 401) setError("Unable to check your session. Reload to try again.");
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let active = true;
    const expired = () => { if (active) { reset(); navigate("/login"); } };
    const channel = new BroadcastChannel("tutor-account");
    channel.onmessage = expired;
    const check = () => {
      if (document.visibilityState === "visible" && user) {
        getAccountSession().then(s => { if (active && s.user.id !== user.id) expired(); }).catch(e => { if (active && e.status === 401) expired(); });
      }
    };
    window.addEventListener("tutor-session-expired", expired);
    window.addEventListener("focus", check);
    const timer = window.setInterval(check, 30_000);
    return () => { active = false; channel.close(); window.removeEventListener("tutor-session-expired", expired); window.removeEventListener("focus", check); clearInterval(timer); };
  }, [user, client]);
  if (loading) return <div role="status" className="grid min-h-screen place-items-center">Checking your session…</div>;
  if (error) return <div role="alert" className="grid min-h-screen place-items-center">{error}</div>;
  const signedIn = (result: { user: User }) => {
    reset();
    setUser(result.user);
    const channel = new BroadcastChannel("tutor-account");
    channel.postMessage("changed");
    channel.close();
    navigate("/");
  };
  if (!user) {
    if (location === "/login/password" || location === "/register/password") return <AccountPage
      key={location} mode={location === "/register/password" ? "register" : "login"}
      onSubmit={async (email, password) => signedIn(await (location === "/register/password" ? registerAccount : loginAccount)({ email, password }))} />;
    return <EmailSignIn onSignedIn={signedIn} />;
  }
  return <AccountContext.Provider value={{ user, signOut: async () => {
    // Hide private content and abort mounted streams before awaiting the server.
    reset();
    setLoading(true);
    const channel = new BroadcastChannel("tutor-account");
    channel.postMessage("changed");
    channel.close();
    navigate("/login");
    try { await logoutAccount(); } catch { setError("Sign-out could not be confirmed. Reload and try signing out again."); }
    finally { setLoading(false); }
  } }}>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  </AccountContext.Provider>;
}
