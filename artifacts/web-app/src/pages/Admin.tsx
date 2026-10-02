import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/lib/AuthContext";
import { useLocation } from "wouter";
import { 
  useAdminListUsers, 
  useAdminListOrders, 
  useAdminListWithdrawals, 
  useAdminUpdateWithdrawal,
  getAdminListWithdrawalsQueryKey,
  useAdminListProducts,
  useAdminListChatRooms,
  useAdminDeleteChatRoom,
  getAdminListChatRoomsQueryKey,
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

function UsersTab() {
  const { data: users } = useAdminListUsers();
  const [registrationBlocked, setRegistrationBlocked] = React.useState<boolean | null>(null);
  const [policyLoading, setPolicyLoading] = React.useState(true);
  const [policyPending, setPolicyPending] = React.useState(false);
  const [policyError, setPolicyError] = React.useState("");
  const [policyMessage, setPolicyMessage] = React.useState("");
  const policyPendingRef = React.useRef(false);
  const policyLoadIdRef = React.useRef(0);

  const loadRegistrationPolicy = React.useCallback(async () => {
    if (policyPendingRef.current) return;
    const loadId = ++policyLoadIdRef.current;
    setPolicyLoading(true);
    setPolicyError("");
    setPolicyMessage("");
    try {
      const response = await fetch("/api/admin/registration-policy", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `가입 정책을 불러오지 못했습니다. (${response.status})`);
      if (typeof data.blocked !== "boolean") throw new Error("가입 정책 응답을 확인할 수 없습니다.");
      if (loadId === policyLoadIdRef.current) setRegistrationBlocked(data.blocked);
    } catch (error) {
      if (loadId === policyLoadIdRef.current) {
        setPolicyError(error instanceof Error ? error.message : "가입 정책을 불러오지 못했습니다.");
      }
    } finally {
      if (loadId === policyLoadIdRef.current) setPolicyLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRegistrationPolicy();
    const refreshOnFocus = () => { void loadRegistrationPolicy(); };
    const timer = window.setInterval(() => { void loadRegistrationPolicy(); }, 30_000);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [loadRegistrationPolicy]);

  const toggleRegistrationPolicy = async () => {
    if (registrationBlocked === null || policyLoading || policyPending) return;
    const savedState = registrationBlocked;
    const requestedState = !savedState;
    ++policyLoadIdRef.current;
    policyPendingRef.current = true;
    setPolicyLoading(false);
    setPolicyPending(true);
    setPolicyError("");
    setPolicyMessage("");
    try {
      const response = await fetch("/api/admin/registration-policy", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked: requestedState }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `가입 정책을 저장하지 못했습니다. (${response.status})`);
      if (typeof data.blocked === "boolean" && data.blocked !== requestedState) {
        throw new Error("저장된 가입 정책이 요청한 상태와 다릅니다.");
      }
      const saved = typeof data.blocked === "boolean" ? data.blocked : requestedState;
      setRegistrationBlocked(saved);
      setPolicyMessage(`저장되었습니다. 현재 상태: ${saved ? "ON (차단)" : "OFF (허용)"}`);
    } catch (error) {
      setRegistrationBlocked(savedState);
      setPolicyError(error instanceof Error ? error.message : "가입 정책을 저장하지 못했습니다.");
    } finally {
      policyPendingRef.current = false;
      setPolicyPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-4 rounded-lg border p-4" aria-labelledby="registration-policy-title">
        <div className="min-w-[240px] flex-1">
          <h2 id="registration-policy-title" className="font-semibold">신규 회원 가입 차단</h2>
          <p className="text-sm text-muted-foreground">
            ON = 차단, OFF = 허용. ON이면 일반 회원가입과 미등록 ID 로그인 시 자동 회원가입이 차단됩니다. 기존 회원의 로그인은 계속 허용됩니다.
          </p>
        </div>
        <Button
          type="button"
          variant={registrationBlocked ? "destructive" : "outline"}
          role="switch"
          aria-label={`신규 회원 가입 차단: ${registrationBlocked === null ? "상태 확인 중" : registrationBlocked ? "ON, 차단" : "OFF, 허용"}`}
          aria-checked={registrationBlocked === true}
          disabled={registrationBlocked === null || policyLoading || policyPending || !!policyError}
          onClick={toggleRegistrationPolicy}
        >
          {registrationBlocked === null ? "—" : registrationBlocked ? "ON" : "OFF"}
        </Button>
        <p className={policyError ? "w-full text-sm text-destructive" : "w-full text-sm text-muted-foreground"} role="status" aria-live="polite">
          {policyPending ? "저장 중..." : policyLoading ? "상태 확인 중..." : policyError || policyMessage || (registrationBlocked === null ? "상태를 확인할 수 없습니다." : `현재 상태: ${registrationBlocked ? "ON (차단)" : "OFF (허용)"}`)}
        </p>
        {policyError && <Button type="button" variant="ghost" size="sm" onClick={() => { void loadRegistrationPolicy(); }}>정책 다시 불러오기</Button>}
      </section>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>이메일</TableHead>
            <TableHead>닉네임</TableHead>
            <TableHead>권한</TableHead>
            <TableHead>잔액</TableHead>
            <TableHead>가입일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users?.map(u => (
            <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
              <TableCell>{u.id}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>{u.nickname}</TableCell>
              <TableCell><Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge></TableCell>
              <TableCell>{(u.balance || 0).toLocaleString("ko-KR")}원</TableCell>
              <TableCell>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function OrdersTab() {
  const { data: orders } = useAdminListOrders();

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>상품명</TableHead>
            <TableHead>금액</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>구매자ID</TableHead>
            <TableHead>판매자ID</TableHead>
            <TableHead>일시</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders?.map(o => (
            <TableRow key={o.id} data-testid={`row-order-${o.id}`}>
              <TableCell>{o.id}</TableCell>
              <TableCell className="max-w-[200px] truncate">{o.productTitle}</TableCell>
              <TableCell>{o.amount.toLocaleString("ko-KR")}원</TableCell>
              <TableCell><Badge>{o.status}</Badge></TableCell>
              <TableCell>{o.buyerId}</TableCell>
              <TableCell>{o.sellerId || "-"}</TableCell>
              <TableCell>{new Date(o.createdAt).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function WithdrawalsTab() {
  const { data: withdrawals } = useAdminListWithdrawals();
  const updateMutation = useAdminUpdateWithdrawal();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleUpdate = (id: number, status: "approved" | "rejected") => {
    updateMutation.mutate({ id, data: { status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAdminListWithdrawalsQueryKey() });
        toast({ title: "처리 완료", description: "출금 요청이 처리되었습니다." });
      },
      onError: () => {
        toast({ title: "처리 실패", description: "오류가 발생했습니다.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>요청자ID</TableHead>
            <TableHead>금액</TableHead>
            <TableHead>은행/계좌</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>액션</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {withdrawals?.map(w => (
            <TableRow key={w.id} data-testid={`row-withdrawal-${w.id}`}>
              <TableCell>{w.id}</TableCell>
              <TableCell>{w.userId}</TableCell>
              <TableCell className="font-bold text-primary">{w.amount.toLocaleString("ko-KR")}원</TableCell>
              <TableCell>
                <div className="text-sm">{w.bankName} {w.accountNumber}</div>
                <div className="text-xs text-muted-foreground">{w.accountHolder}</div>
              </TableCell>
              <TableCell>
                <Badge variant={w.status === "pending" ? "outline" : w.status === "approved" ? "default" : "destructive"}>
                  {w.status}
                </Badge>
              </TableCell>
              <TableCell>
                {w.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleUpdate(w.id, "approved")} data-testid={`button-approve-${w.id}`}>승인</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleUpdate(w.id, "rejected")} data-testid={`button-reject-${w.id}`}>거절</Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ProductsTab() {
  const { data: products } = useAdminListProducts();

  return (
    <div className="space-y-4 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>제목</TableHead>
            <TableHead>게임</TableHead>
            <TableHead>가격</TableHead>
            <TableHead>카테고리</TableHead>
            <TableHead>판매자</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>등록일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products?.map(p => (
            <TableRow key={p.id} data-testid={`row-product-${p.id}`}>
              <TableCell>{p.id}</TableCell>
              <TableCell className="max-w-[200px] truncate">{p.title}</TableCell>
              <TableCell>{p.gameName ?? "-"}</TableCell>
              <TableCell className="font-medium">{p.price.toLocaleString("ko-KR")}원</TableCell>
              <TableCell>{p.category ?? "-"}</TableCell>
              <TableCell>{p.sellerName ?? "-"}</TableCell>
              <TableCell>
                <Badge variant={p.status === "active" ? "default" : p.status === "sold" ? "secondary" : "outline"}>
                  {p.status === "active" ? "판매중" : p.status === "sold" ? "판매완료" : "비활성"}
                </Badge>
              </TableCell>
              <TableCell>{new Date(p.createdAt).toLocaleDateString("ko-KR")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ChatRoomsTab() {
  const { data: rooms } = useAdminListChatRooms();
  const deleteMutation = useAdminDeleteChatRoom();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (!window.confirm(`채팅방 #${id}과 모든 메시지를 영구 삭제하시겠습니까?\n구매자·판매자에게도 보이지 않으며 복구할 수 없습니다. 주문에 연결된 방은 삭제되지 않습니다.`)) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAdminListChatRoomsQueryKey() });
        toast({ title: "삭제 완료", description: "채팅방과 메시지가 삭제되었습니다." });
      },
      onError: (error) => {
        queryClient.invalidateQueries({ queryKey: getAdminListChatRoomsQueryKey() });
        toast({ title: "삭제 실패", description: error instanceof Error ? error.message : "다시 시도해 주세요.", variant: "destructive" });
      },
    });
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "active": return "진행중";
      case "handover": return "인계완료";
      case "ended": return "거래완료";
      case "cancelled": return "취소";
      default: return s;
    }
  };
  const statusVariant = (s: string): "default" | "secondary" | "outline" | "destructive" => {
    if (s === "ended") return "default";
    if (s === "handover") return "secondary";
    if (s === "cancelled") return "destructive";
    return "outline";
  };

  return (
    <div className="space-y-4 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>판매자</TableHead>
            <TableHead>구매자</TableHead>
            <TableHead>상품</TableHead>
            <TableHead>거래금액</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>생성일</TableHead>
            <TableHead>관리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rooms?.map(r => (
            <TableRow key={r.id} data-testid={`row-chatroom-${r.id}`}>
              <TableCell>{r.id}</TableCell>
              <TableCell>{r.sellerNickname ?? r.sellerId}</TableCell>
              <TableCell>{r.buyerNickname ?? r.buyerId}</TableCell>
              <TableCell className="max-w-[200px] truncate">{r.productTitle ?? "-"}</TableCell>
              <TableCell className="font-medium">
                {r.amount != null ? r.amount.toLocaleString("ko-KR") + "원" : "-"}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge>
              </TableCell>
              <TableCell>{new Date(r.createdAt).toLocaleDateString("ko-KR")}</TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!r.canDelete || deleteMutation.isPending}
                  title={r.canDelete ? "채팅방과 메시지 영구 삭제" : "주문에 연결된 채팅방은 삭제할 수 없습니다"}
                  onClick={() => handleDelete(r.id)}
                >{r.canDelete ? "삭제" : "삭제 불가"}</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function Admin() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) return null;

  if (!user) {
    setLocation("/");
    return null;
  }
  
  if (user.role !== "admin") {
    setLocation("/mypage");
    return null;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 mt-16 max-w-7xl w-full mx-auto p-4 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">관리자 패널</h1>
          <Button
            variant="outline"
            onClick={() => { window.location.href = "/api/admin/crawl-script"; }}
          >
            🕷️ 크롤 스크립트 다운로드
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            <Tabs defaultValue="withdrawals">
              <TabsList className="mb-4 flex-wrap">
                <TabsTrigger value="withdrawals" data-testid="tab-admin-withdrawals">출금 관리</TabsTrigger>
                <TabsTrigger value="users" data-testid="tab-admin-users">유저 관리</TabsTrigger>
                <TabsTrigger value="orders" data-testid="tab-admin-orders">주문 내역</TabsTrigger>
                <TabsTrigger value="chat-rooms" data-testid="tab-admin-chat-rooms">채팅 거래</TabsTrigger>
                <TabsTrigger value="products" data-testid="tab-admin-products">판매/구매글</TabsTrigger>
              </TabsList>
              <TabsContent value="withdrawals">
                <WithdrawalsTab />
              </TabsContent>
              <TabsContent value="users">
                <UsersTab />
              </TabsContent>
              <TabsContent value="orders">
                <OrdersTab />
              </TabsContent>
              <TabsContent value="chat-rooms">
                <ChatRoomsTab />
              </TabsContent>
              <TabsContent value="products">
                <ProductsTab />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
