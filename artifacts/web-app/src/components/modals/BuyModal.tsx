import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCreateOrder, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
  const createOrder = useCreateOrder();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleBuy = () => {
    createOrder.mutate(
      {
        data: {
          productTitle: data.title,
          amount: data.price,
          productId: Number(data.itemId) || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          toast({ title: "주문 완료", description: "결제가 완료되었습니다." });
          onClose();
          setLocation("/mypage");
        },
        onError: (err: any) => {
          toast({ title: "주문 실패", description: err?.response?.data?.error || "잔액이 부족하거나 오류가 발생했습니다.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>구매 확인</DialogTitle>
          <DialogDescription>
            해당 물품을 구매하시겠습니까?
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
            disabled={createOrder.isPending} 
            className="bg-ring text-primary hover:bg-ring/90 font-bold"
            data-testid="button-buy-confirm"
          >
            {createOrder.isPending ? "처리 중..." : "결제하기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
