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

  return (
    <div className="space-y-4">
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

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
        <h1 className="text-3xl font-bold mb-8">관리자 패널</h1>
        
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
