import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useLocation, useParams } from "wouter";
import {
  useGetChatMessages,
  useSendChatMessage,
  useUpdateChatRoom,
  getGetChatMessagesQueryKey,
  ChatRoomUpdateInputStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_LABEL: Record<string, string> = {
  pending: "거래대기",
  active: "거래중",
  handover: "거래중",
  ended: "거래완료",
  cancelled: "거래취소",
  rejected: "거래불가",
};

export default function Chat() {
  const { user } = useAuth();
  const params = useParams();
  const roomId = Number(params.roomId);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [content, setContent] = useState("");
  // 판매자가 인계하기를 누른 사실을 SSE로 받으면 true
  const [handoverReady, setHandoverReady] = useState(false);

  const { data } = useGetChatMessages(roomId, {
    query: {
      enabled: !!roomId && !!user,
      refetchInterval: 3000,
      queryKey: getGetChatMessagesQueryKey(roomId),
    },
  });

  const room = data?.room;
  const messages = data?.messages ?? [];

  const isSeller = !!user && !!room && user.id === room.sellerId;
  const isBuyer = !!user && !!room && user.id === room.buyerId;

  // 페이지 로드 시 이미 handover 상태면 즉시 활성화
  useEffect(() => {
    if (room?.status === "handover" || room?.status === "ended") {
      setHandoverReady(true);
    }
  }, [room?.status]);

  // SSE 연결 — chat_handover 이벤트 수신 시 인수확인 버튼 활성화
  useEffect(() => {
    if (!user || !roomId) return;
    const es = new EventSource("/api/events", { withCredentials: true });
    es.addEventListener("chat_handover", (e) => {
      try {
        const d = JSON.parse(e.data) as { roomId: number };
        if (d.roomId === roomId) setHandoverReady(true);
      } catch { /* ignore */ }
    });
    return () => es.close();
  }, [user, roomId]);

  // 메시지 수신 시 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!user) setLocation("/");
  }, [user, setLocation]);

  const sendMutation = useSendChatMessage();
  const updateRoom = useUpdateChatRoom();

  if (!user || !roomId) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    sendMutation.mutate({ roomId, data: { content } }, {
      onSuccess: () => {
        setContent("");
        queryClient.invalidateQueries({ queryKey: getGetChatMessagesQueryKey(roomId) });
      },
    });
  };

  const handleStatusChange = (status: ChatRoomUpdateInputStatus) => {
    updateRoom.mutate({ roomId, data: { status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetChatMessagesQueryKey(roomId) });
      },
    });
  };

  // 인수확인: handoverReady가 false면 조용히 무응답
  const handleBuyerConfirm = () => {
    if (!handoverReady) return;
    handleStatusChange(ChatRoomUpdateInputStatus.ended);
  };

  const tradeStatus = room?.status ?? "pending";
  const isDone = tradeStatus === "ended" || tradeStatus === "cancelled" || tradeStatus === "rejected";

  // 상대방 정보
  const counterpartNickname = isSeller ? room?.buyerNickname : room?.sellerNickname;
  const myRole = isSeller ? "판매자" : "구매자";
  const counterRole = isSeller ? "구매자" : "판매자";

  const priceLabel = room?.productPrice != null
    ? room.productPrice.toLocaleString() + " 원"
    : "-";

  const gameInfo = [room?.gameName, room?.serverName, room?.itemCategory]
    .filter(Boolean).join(" > ");

  return (
    <div style={{ minHeight: "100dvh", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", padding: "15px" }}>
      <div style={{ width: "100%", maxWidth: 860, background: "#fff", borderRadius: 20, border: "1px solid #ddd", overflow: "hidden", display: "flex", flexDirection: "column", height: "calc(100dvh - 30px)" }}>

        {/* ── 헤더 ── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "18px 18px 14px", borderBottom: "1px solid #ddd", flexShrink: 0 }}>
          <button
            onClick={() => setLocation("/mypage")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#159EFD", fontWeight: 700, fontSize: 14, padding: "4px 0", whiteSpace: "nowrap", marginTop: 2 }}
          >
            ← 뒤로가기
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, background: "#fef3cd", color: "#a06c00", padding: "2px 8px", borderRadius: 20, border: "1px solid #fde68a" }}>
                {counterRole}
              </span>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#222" }}>{counterpartNickname ?? "..."}</span>
            </div>
            <div style={{ fontSize: 13, color: "#444", fontWeight: 600, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {room?.productTitle ?? "상품 로딩 중..."}
            </div>
            <div style={{ display: "flex", gap: 10, fontSize: 12, color: "#888" }}>
              {room && <span>#{roomId}</span>}
              {gameInfo && <span>{gameInfo}</span>}
            </div>
          </div>
          <div style={{
            padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700,
            background: tradeStatus === "ended" ? "#e6f9f0" : tradeStatus === "cancelled" ? "#ffeaea" : "#edf8ff",
            color: tradeStatus === "ended" ? "#0a7a4a" : tradeStatus === "cancelled" ? "#c0392b" : "#159EFD",
            border: `1px solid ${tradeStatus === "ended" ? "#b2e8d0" : tradeStatus === "cancelled" ? "#f5b7b1" : "#b0dfff"}`,
            flexShrink: 0,
          }}>
            {STATUS_LABEL[tradeStatus] ?? tradeStatus}
          </div>
        </div>

        {/* ── 본문 ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* 채팅 영역 */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* 상대방 정보 패널 */}
            {room && (
              <div style={{ background: "#f8f9fb", borderBottom: "1px solid #eee", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#888", background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "2px 8px" }}>{counterRole} 정보</span>
                <span style={{ fontSize: 13, color: "#444", fontWeight: 600 }}>{counterpartNickname}</span>
                {room.characterName && (
                  <span style={{ fontSize: 12, color: "#666" }}>캐릭터: {room.characterName}</span>
                )}
              </div>
            )}

            {/* 거래 상태 안내 */}
            {tradeStatus === "handover" && isBuyer && (
              <div style={{ background: "#edf8ff", borderBottom: "1px solid #b0dfff", padding: "10px 16px", fontSize: 13, color: "#0e6cb8", flexShrink: 0 }}>
                <b>판매자가 아이템을 인계했습니다.</b> 아이템 수령 확인 후 인수확인 버튼을 클릭하세요.
              </div>
            )}
            {tradeStatus === "handover" && isSeller && (
              <div style={{ background: "#f0fff4", borderBottom: "1px solid #b2e8d0", padding: "10px 16px", fontSize: 13, color: "#0a7a4a", flexShrink: 0 }}>
                <b>인계 완료.</b> 구매자의 인수확인을 기다리고 있습니다.
              </div>
            )}
            {tradeStatus === "ended" && (
              <div style={{ background: "#f0fff4", borderBottom: "1px solid #b2e8d0", padding: "10px 16px", fontSize: 13, color: "#0a7a4a", flexShrink: 0 }}>
                <b>거래가 완료되었습니다.</b>
              </div>
            )}

            {/* 메시지 목록 */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: "center", color: "#aaa", marginTop: 40, fontSize: 14 }}>
                  메시지가 없습니다. 거래 상대방과 대화를 시작해보세요.
                </div>
              )}
              {messages.map((msg) => {
                const isMe = msg.senderId === user.id;
                return (
                  <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "70%", borderRadius: 14, padding: "8px 14px",
                      background: isMe ? "#159EFD" : "#f2f2f2",
                      color: isMe ? "#fff" : "#222",
                    }}>
                      <div style={{ fontSize: 14, lineHeight: 1.5 }}>{msg.content}</div>
                      <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7, textAlign: isMe ? "right" : "left" }}>
                        {new Date(msg.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* 입력창 */}
            <form onSubmit={handleSend} style={{ borderTop: "1px solid #eee", padding: "12px 16px", display: "flex", gap: 8, background: "#fff", flexShrink: 0 }}>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e as unknown as React.FormEvent); } }}
                placeholder="메세지를 입력해주세요."
                maxLength={1000}
                disabled={isDone}
                style={{
                  flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: "8px 12px",
                  fontSize: 14, resize: "none", outline: "none", height: 40, lineHeight: "24px",
                  background: isDone ? "#f8f8f8" : "#fff",
                }}
                data-testid="input-chat-message"
              />
              <button
                type="submit"
                disabled={sendMutation.isPending || !content.trim() || isDone}
                style={{
                  background: "#159EFD", color: "#fff", border: "none", borderRadius: 8,
                  padding: "0 18px", fontWeight: 700, fontSize: 14, cursor: "pointer",
                  opacity: (!content.trim() || isDone) ? 0.5 : 1,
                }}
                data-testid="button-chat-send"
              >
                전송
              </button>
            </form>
          </div>

          {/* ── 우측 메뉴 ── */}
          <div style={{ width: 170, borderLeft: "1px solid #eee", display: "flex", flexDirection: "column", padding: "16px 12px", gap: 8, background: "#fff", flexShrink: 0 }}>

            {/* 채팅 관리 버튼들 */}
            {(["채팅차단", "채팅종료", "자주쓰는채팅", "신고하기", "알림보내기"] as const).map((label) => (
              <button key={label} style={{
                width: "100%", padding: "9px 0", borderRadius: 8, border: "1px solid #ddd",
                background: "#fff", fontSize: 13, color: "#444", cursor: "pointer", textAlign: "center",
                fontWeight: 500,
              }}>
                {label}
              </button>
            ))}

            <div style={{ borderTop: "1px solid #eee", paddingTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>

              {/* 거래취소 */}
              {!isDone && (
                <button
                  onClick={() => handleStatusChange("cancelled")}
                  disabled={updateRoom.isPending}
                  style={{
                    width: "100%", padding: "9px 0", borderRadius: 8,
                    border: "1px solid #ddd", background: "#fff",
                    fontSize: 13, color: "#888", cursor: "pointer", fontWeight: 500,
                  }}
                >
                  거래취소
                </button>
              )}

              {/* 판매자: 인계하기 (하늘색) */}
              {isSeller && !isDone && tradeStatus !== "handover" && (
                <button
                  onClick={() => handleStatusChange("handover")}
                  disabled={updateRoom.isPending}
                  style={{
                    width: "100%", padding: "9px 0", borderRadius: 8,
                    border: "none", background: "#159EFD",
                    fontSize: 13, color: "#fff", cursor: "pointer", fontWeight: 700,
                    opacity: updateRoom.isPending ? 0.6 : 1,
                  }}
                  data-testid="button-handover"
                >
                  인계하기
                </button>
              )}

              {/* 구매자: 인수확인 — handoverReady가 false면 클릭해도 아무 반응 없음 */}
              {isBuyer && !isDone && (
                <button
                  onClick={handleBuyerConfirm}
                  style={{
                    width: "100%", padding: "9px 0", borderRadius: 8,
                    border: "none",
                    background: handoverReady ? "#159EFD" : "#c8e6f5",
                    fontSize: 13, color: "#fff", cursor: handoverReady ? "pointer" : "default",
                    fontWeight: 700,
                    transition: "background 0.3s",
                  }}
                  data-testid="button-confirm"
                >
                  인수확인
                </button>
              )}

              {/* 완료/취소 후 상태 표시 */}
              {tradeStatus === "ended" && (
                <div style={{ textAlign: "center", fontSize: 13, color: "#0a7a4a", fontWeight: 700, padding: "8px 0" }}>
                  ✅ 거래완료
                </div>
              )}
              {tradeStatus === "cancelled" && (
                <div style={{ textAlign: "center", fontSize: 13, color: "#c0392b", fontWeight: 700, padding: "8px 0" }}>
                  ❌ 거래취소
                </div>
              )}
            </div>

            {/* 거래금액 */}
            <div style={{ marginTop: "auto", border: "1px solid #eee", borderRadius: 10, padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>거래금액</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#159EFD" }}>{priceLabel}</div>
            </div>

            {/* 내 역할 표시 */}
            <div style={{ textAlign: "center", fontSize: 11, color: "#bbb" }}>
              내 역할: <b style={{ color: "#888" }}>{myRole}</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
