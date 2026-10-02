import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface BuyModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    title: string;
    price: number;
    itemId: string;
  };
}

export function BuyModal({ isOpen, onClose, data }: BuyModalProps) {
  const [pending, setPending] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleBuy = async () => {
    const id = Number(data.itemId);
    if (!Number.isSafeInteger(id) || id < 1) {
      toast({ title: "구매신청 실패", description: "회원 판매글을 찾을 수 없습니다.", variant: "destructive" });
      return;
    }
    setPending(true);
    try {
      const productResponse = await fetch(`/api/products/${id}`, { credentials: "include" });
      const product = await productResponse.json() as { sellerId?: number | null; status?: string; category?: string; error?: string };
      if (!productResponse.ok || product.status !== "active" || product.category !== "sell") {
        throw new Error(product.error || "거래 가능한 회원 판매글이 아닙니다.");
      }
      if (!product.sellerId) {
        const response = await fetch("/api/orders", {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: id }),
        });
        const order = await response.json() as { id?: number; error?: string };
        if (!response.ok || !order.id) throw new Error(order.error || "주문을 만들 수 없습니다.");
        toast({ title: "주문 완료", description: "구매 내역에서 주문을 확인하세요." });
        onClose();
        setLocation("/mypage");
        return;
      }
      const roomResponse = await fetch("/api/chat/rooms", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id, sellerId: product.sellerId }),
      });
      const room = await roomResponse.json() as { id?: number; error?: string };
      if (!roomResponse.ok || !room.id) throw new Error(room.error || "채팅방을 열 수 없습니다.");
      onClose();
      setLocation(`/chat/${room.id}`);
    } catch (error) {
      toast({ title: "구매신청 실패", description: error instanceof Error ? error.message : "채팅방을 열 수 없습니다.", variant: "destructive" });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>구매신청</DialogTitle>
          <DialogDescription>
            회원 판매글은 먼저 채팅방을 열고 결제를 확정합니다. 외부 매물은 기존 주문 방식으로 진행됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="py-6 space-y-4">
          <div className="flex justify-between p-4 bg-muted rounded-md border">
            <span className="text-muted-foreground">물품명</span>
            <span className="font-medium max-w-[200px] truncate" title={data.title}>{data.title}</span>
          </div>
          <div className="flex justify-between p-4 bg-primary/5 rounded-md border border-primary/20">
            <span className="text-muted-foreground">결제 금액</span>
            <span className="font-bold text-lg text-primary">{data.price.toLocaleString("ko-KR")}원</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-buy-cancel">취소</Button>
          <Button 
            onClick={handleBuy} 
            disabled={pending}
            className="bg-ring text-primary hover:bg-ring/90 font-bold"
            data-testid="button-buy-confirm"
          >
            {pending ? "처리 중..." : "계속하기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
