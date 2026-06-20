import React, { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/lib/AuthContext";
import { 
  useGetWallet, 
  useChargeWallet, 
  useRequestWithdraw, 
  useListOrders,
  useMarkOrderShipped,
  useConfirmOrder,
  useCancelOrder,
  useListChatRooms,
  getGetWalletQueryKey,
  getListOrdersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";

function WalletSection() {
  const { data: wallet } = useGetWallet();
  const chargeMutation = useChargeWallet();
  const withdrawMutation = useRequestWithdraw();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [chargeAmount, setChargeAmount] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");

  const commonAmounts = [10000, 30000, 50000, 100000];

  const handleCharge = () => {
    const amt = Number(chargeAmount);
    if (!amt || amt < 1000) {
      toast({ title: "오류", description: "1,000원 이상 입력해주세요.", variant: "destructive" });
      return;
    }
    chargeMutation.mutate({ data: { amount: amt } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
        toast({ title: "충전 신청 완료", description: "관리자 승인 후 반영됩니다." });
        setChargeAmount("");
      },
      onError: (err: any) => {
        toast({ title: "오류", description: err?.response?.data?.error || "충전에 실패했습니다.", variant: "destructive" });
      }
    });
  };

  const handleWithdraw = () => {
    const amt = Number(withdrawAmount);
    if (!amt || amt < 1000 || !bankName || !accountNumber || !accountHolder) {
      toast({ title: "오류", description: "모든 정보를 정확히 입력해주세요.", variant: "destructive" });
      return;
    }
    withdrawMutation.mutate({ data: { amount: amt, bankName, accountNumber, accountHolder } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
        toast({ title: "출금 신청 완료", description: "관리자 승인 후 입금됩니다." });
        setWithdrawAmount("");
        setBankName("");
        setAccountNumber("");
        setAccountHolder("");
      },
      onError: (err: any) => {
        toast({ title: "오류", description: err?.response?.data?.error || "출금에 실패했습니다.", variant: "destructive" });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>내 지갑</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-2xl font-bold text-primary">
          잔여 마일리지: <span className="text-ring" data-testid="text-mypage-balance">{wallet?.balance.toLocaleString("ko-KR") || 0}</span>원
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="font-semibold border-b pb-2">마일리지 충전</h3>
            <div className="flex gap-2 flex-wrap">
              {commonAmounts.map(amt => (
                <Button key={amt} variant="outline" size="sm" onClick={() => setChargeAmount(amt.toString())} data-testid={`button-charge-${amt}`}>
                  +{amt.toLocaleString("ko-KR")}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input 
                type="number" 
                placeholder="충전 금액" 
                value={chargeAmount} 
                onChange={(e) => setChargeAmount(e.target.value)} 
                data-testid="input-charge-amount"
              />
              <Button onClick={handleCharge} disabled={chargeMutation.isPending} data-testid="button-submit-charge">충전</Button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold border-b pb-2">마일리지 출금</h3>
            <div className="space-y-2">
              <Input type="number" placeholder="출금 금액" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} data-testid="input-withdraw-amount" />
              <div className="flex gap-2">
                <Input placeholder="은행명" value={bankName} onChange={(e) => setBankName(e.target.value)} data-testid="input-withdraw-bank" />
                <Input placeholder="예금주" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} data-testid="input-withdraw-holder" />
              </div>
              <Input placeholder="계좌번호" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} data-testid="input-withdraw-account" />
              <Button className="w-full" onClick={handleWithdraw} disabled={withdrawMutation.isPending} data-testid="button-submit-withdraw">출금 신청</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrdersSection({ role }: { role: "buyer" | "seller" }) {
  const { data: orders } = useListOrders({ role }, { query: { queryKey: getListOrdersQueryKey({ role }) }});
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const markShipped = useMarkOrderShipped();
  const confirmOrder = useConfirmOrder();
  const cancelOrder = useCancelOrder();

  const handleAction = (mutation: any, id: number, successMsg: string) => {
    mutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey({ role }) });
        toast({ title: "완료", description: successMsg });
      },
      onError: () => toast({ title: "오류", description: "요청 처리에 실패했습니다.", variant: "destructive" })
    });
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string, variant: any }> = {
      pending: { label: "결제완료", variant: "secondary" },
      shipped: { label: "물품인계", variant: "default" },
      confirmed: { label: "인수확인", variant: "outline" },
      completed: { label: "거래완료", variant: "outline" },
      cancelled: { label: "취소됨", variant: "destructive" },
      disputed: { label: "분쟁중", variant: "destructive" },
    };
    const s = map[status] || { label: status, variant: "secondary" };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  if (!orders || orders.length === 0) return <div className="py-8 text-center text-muted-foreground">거래 내역이 없습니다.</div>;

  return (
    <div className="space-y-4">
      {orders.map(order => (
        <Card key={order.id} className="overflow-hidden" data-testid={`card-order-${order.id}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {getStatusBadge(order.status)}
                <span className="text-sm text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</span>
              </div>
              <h4 className="font-bold text-lg">{order.productTitle}</h4>
              <p className="text-primary font-medium">{order.amount.toLocaleString("ko-KR")}원</p>
            </div>
            <div className="flex gap-2">
              {role === "seller" && order.status === "pending" && (
                <Button onClick={() => handleAction(markShipped, order.id, "물품 인계 처리되었습니다.")} data-testid={`button-shipped-${order.id}`}>
                  물품인계 (배송완료)
                </Button>
              )}
              {role === "buyer" && order.status === "shipped" && (
                <Button onClick={() => handleAction(confirmOrder, order.id, "인수 확인되었습니다.")} className="bg-ring text-primary hover:bg-ring/90" data-testid={`button-confirm-${order.id}`}>
                  인수확인
                </Button>
              )}
              {(order.status === "pending" || order.status === "shipped") && (
                <Button variant="destructive" onClick={() => handleAction(cancelOrder, order.id, "거래가 취소되었습니다.")} data-testid={`button-cancel-${order.id}`}>
                  취소
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ChatRoomsSection() {
  const { data: rooms } = useListChatRooms();
  const [, setLocation] = useLocation();

  if (!rooms || rooms.length === 0) return <div className="py-8 text-center text-muted-foreground">채팅방이 없습니다.</div>;

  return (
    <div className="space-y-4">
      {rooms.map(room => (
        <Card key={room.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setLocation(`/chat/${room.id}`)} data-testid={`card-chatroom-${room.id}`}>
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <div className="font-bold">주문번호 #{room.orderId} 채팅방</div>
              <div className="text-sm text-muted-foreground">개설일: {new Date(room.createdAt).toLocaleDateString()}</div>
            </div>
            <Button variant="ghost" size="sm">입장하기</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function MyPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 mt-16 max-w-5xl w-full mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-8">마이페이지</h1>
        
        <div className="space-y-8">
          <WalletSection />

          <Card>
            <CardHeader>
              <CardTitle>거래 관리</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="buyer">
                <TabsList className="mb-4">
                  <TabsTrigger value="buyer" data-testid="tab-buyer-orders">구매 내역</TabsTrigger>
                  <TabsTrigger value="seller" data-testid="tab-seller-orders">판매 내역</TabsTrigger>
                </TabsList>
                <TabsContent value="buyer">
                  <OrdersSection role="buyer" />
                </TabsContent>
                <TabsContent value="seller">
                  <OrdersSection role="seller" />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>내 채팅방</CardTitle>
            </CardHeader>
            <CardContent>
              <ChatRoomsSection />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
