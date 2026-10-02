import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/lib/AuthContext";
import { BuyModal } from "@/components/modals/BuyModal";
import { useListProducts } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ListProductsParams } from "@workspace/api-client-react";

function formatKRW(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

type ProductType = {
  id: number;
  title: string;
  price: number;
  gameName?: string | null;
  sellerName?: string | null;
  thumbnailUrl?: string | null;
  status: string;
  itemmaniaid?: string | null;
};

function ProductCard({ product, onBuy }: { product: ProductType; onBuy: (p: ProductType) => void }) {
  const sold = product.status === "sold";
  return (
    <div
      data-testid={`card-product-${product.id}`}
      onClick={sold ? undefined : () => onBuy(product)}
      className={`relative bg-card border border-border rounded-lg overflow-hidden group ${sold ? "cursor-not-allowed" : "hover:border-primary/60 hover:shadow-md transition-all cursor-pointer"}`}
    >
      <div className="aspect-square bg-muted relative overflow-hidden">
        {product.thumbnailUrl ? (
          <img src={product.thumbnailUrl} alt={product.title} className={`w-full h-full object-cover ${sold ? "" : "group-hover:scale-105 transition-transform duration-300"}`} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">이미지 없음</div>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        {product.gameName && (
          <Badge variant="secondary" className="text-xs">{product.gameName}</Badge>
        )}
        <p className="text-sm font-medium leading-tight line-clamp-2" data-testid={`text-title-${product.id}`}>{product.title}</p>
        <p className="text-base font-bold text-primary" data-testid={`text-price-${product.id}`}>{formatKRW(product.price)}</p>
        {product.sellerName && (
          <p className="text-xs text-muted-foreground">{product.sellerName}</p>
        )}
        <div className="pt-1">
          <span className={`inline-block w-full text-center text-xs font-semibold py-1.5 rounded bg-primary/10 text-primary ${sold ? "" : "group-hover:bg-primary group-hover:text-primary-foreground transition-colors"}`}>
            구매하기
          </span>
        </div>
      </div>
      {sold && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-[#eeeff1]/85 text-[#24262b] text-xl font-extrabold tracking-tight select-none"
          aria-label="거래 완료"
          data-testid={`status-sold-${product.id}`}
        >
          거래 완료
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { openLogin, user } = useAuth();
  const [buyModalData, setBuyModalData] = useState<{ title: string; price: number; itemId: string } | null>(null);
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const listParams = keyword ? { keyword, limit: 40 } : { limit: 40 };
  const { data: productData, isLoading: activeLoading, isError: activeError, refetch: refetchActive } = useListProducts(listParams);
  // The generated query URL accepts extra query parameters even though its schema has not
  // yet been updated to type the server's existing status filter.
  const soldParams: ListProductsParams & { status: string } = { ...listParams, status: "sold" };
  const { data: soldData, isLoading: soldLoading, isError: soldError, refetch: refetchSold } = useListProducts(soldParams);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === "IM_LOGIN") {
        openLogin();
      } else if (data?.type === "IM_BUY") {
        if (!user) {
          openLogin();
          return;
        }
        setBuyModalData({
          title: data.title,
          price: data.price,
          itemId: data.itemId,
        });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [openLogin, user]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setKeyword(searchInput.trim());
  };

  const handleBuy = (product: ProductType) => {
    if (product.status === "sold") return;
    if (!user) {
      openLogin();
      return;
    }
    setBuyModalData({
      title: product.title,
      price: product.price,
      itemId: String(product.itemmaniaid ?? product.id),
    });
  };

  const isLoading = activeLoading || soldLoading;
  const isError = activeError || soldError;
  const products: ProductType[] = [];
  const seen = new Set<string>();
  [...(productData?.items ?? []), ...(soldData?.items ?? [])].forEach((product) => {
    const key = product.itemmaniaid || String(product.id);
    if (seen.has(key)) return;
    seen.add(key);
    products.push(product);
  });
  products.sort((a, b) => b.id - a.id);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 mt-16">
        {/* Hero / Search bar */}
        <section className="border-b border-border bg-card/40 py-8 px-4">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold mb-1" data-testid="text-hero-title">안전거래 게임 아이템 마켓</h1>
            <p className="text-muted-foreground text-sm mb-4">에스크로 방식으로 안전하게 게임 아이템을 거래하세요</p>
            <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
              <input
                data-testid="input-search"
                type="text"
                placeholder="아이템명, 게임명 검색..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                data-testid="button-search"
                type="submit"
                className="h-10 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                검색
              </button>
            </form>
          </div>
        </section>

        {/* Product grid */}
        <section className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide" data-testid="text-section-title">
              {keyword ? `"${keyword}" 검색 결과` : "최신 등록 아이템"}
            </h2>
            {keyword && (
              <button
                data-testid="button-clear-search"
                onClick={() => { setKeyword(""); setSearchInput(""); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                초기화
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-square w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="py-16 text-center" role="alert" data-testid="error-products">
              <p className="text-sm text-muted-foreground mb-4">상품을 불러오지 못했습니다.</p>
              <button type="button" data-testid="button-retry-products" onClick={() => { void refetchActive(); void refetchSold(); }} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">다시 시도</button>
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} onBuy={handleBuy} />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center" data-testid="empty-products">
              <p className="text-muted-foreground text-sm">
                {keyword ? "검색 결과가 없습니다." : "아직 등록된 아이템이 없습니다."}
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                아이템이 크롤링되면 이곳에 표시됩니다.
              </p>
            </div>
          )}
        </section>
      </main>

      {buyModalData && (
        <BuyModal
          isOpen={!!buyModalData}
          onClose={() => setBuyModalData(null)}
          data={buyModalData}
        />
      )}
    </div>
  );
}
