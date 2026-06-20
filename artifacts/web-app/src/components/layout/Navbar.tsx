import React from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { useGetWallet, getGetWalletQueryKey } from "@workspace/api-client-react";
import { LogOut, User, Wallet } from "lucide-react";

export function Navbar() {
  const { user, openLogin, openRegister, logout } = useAuth();
  const { data: wallet } = useGetWallet({ query: { enabled: !!user, queryKey: getGetWalletQueryKey() } });

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-primary text-primary-foreground flex items-center justify-between px-6 z-50 border-b border-primary-foreground/10">
      <div className="flex items-center gap-8">
        <Link href="/" className="text-xl font-bold tracking-tighter" data-testid="link-home">
          TRADE<span className="text-ring">MANIA</span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <div className="flex items-center gap-4 mr-4 text-sm font-medium bg-black/20 px-4 py-2 rounded-md">
              <span className="flex items-center gap-2" data-testid="text-user-nickname">
                <User size={16} className="text-ring" />
                {user.nickname}
              </span>
              <span className="flex items-center gap-2" data-testid="text-wallet-balance">
                <Wallet size={16} className="text-ring" />
                {wallet ? `${wallet.balance.toLocaleString("ko-KR")}원` : "0원"}
              </span>
            </div>
            {user.role === "admin" && (
              <Link href="/admin">
                <Button variant="ghost" size="sm" className="hover:bg-primary-foreground/10" data-testid="link-admin">
                  관리자
                </Button>
              </Link>
            )}
            <Link href="/mypage">
              <Button variant="ghost" size="sm" className="hover:bg-primary-foreground/10" data-testid="link-mypage">
                마이페이지
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={logout} className="hover:bg-primary-foreground/10 text-destructive-foreground hover:text-destructive" data-testid="button-logout">
              <LogOut size={16} className="mr-2" />
              로그아웃
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={openLogin} className="hover:bg-primary-foreground/10" data-testid="button-open-login">
              로그인
            </Button>
            <Button variant="default" onClick={openRegister} className="bg-ring text-primary font-bold hover:bg-ring/90" data-testid="button-open-register">
              회원가입
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}
