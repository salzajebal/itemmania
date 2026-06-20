import React, { createContext, useContext, ReactNode } from "react";
import { useGetMe, type AuthUser, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  logout: () => void;
  isModalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  modalView: "login" | "register";
  setModalView: (view: "login" | "register") => void;
  openLogin: () => void;
  openRegister: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
      staleTime: 1000 * 60 * 5,
    }
  });

  const queryClient = useQueryClient();
  const [isModalOpen, setModalOpen] = React.useState(false);
  const [modalView, setModalView] = React.useState<"login" | "register">("login");

  const handleLogout = () => {
    queryClient.setQueryData(getGetMeQueryKey(), null);
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  };

  const openLogin = () => {
    setModalView("login");
    setModalOpen(true);
  };

  const openRegister = () => {
    setModalView("register");
    setModalOpen(true);
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        logout: handleLogout,
        isModalOpen,
        setModalOpen,
        modalView,
        setModalView,
        openLogin,
        openRegister,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
