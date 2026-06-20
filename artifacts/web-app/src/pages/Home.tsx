import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/lib/AuthContext";
import { BuyModal } from "@/components/modals/BuyModal";
import { useListProducts } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function formatKRW(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

function ProductCard({ product }: { product: { id: number; title: string; price: number; gameName?: string | null; sellerName?: string | null; thumbnailUrl?: string | null; status: string } }) {
  return (
    <div
      data-testid={`card-product-${product.id}`}
      className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/60 transition-colors cursor-pointer group"
    >
      <div className="aspect-square bg-muted relative overflow-hidden">
        {product.thumbnailUrl ? (
          <img src={product.thumbnailUrl} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
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
      </div>
    </div>
  );
}

export default function Home() {
  const { openLogin, user } = useAuth();
  const [buyModalData, setBuyModalData] = useState<{ title: string; price: number; itemId: string } | null>(null);
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data: productData, isLoading } = useListProducts(
    keyword ? { keyword, limit: 40 } : { limit: 40 }
  );

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

  const products = productData?.items ?? [];

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
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
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
