import React, { useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/lib/AuthContext";
import { useLocation, useParams } from "wouter";
import { useGetChatMessages, useSendChatMessage, getGetChatMessagesQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export default function Chat() {
  const { user } = useAuth();
  const params = useParams();
  const roomId = Number(params.roomId);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [content, setContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useGetChatMessages(roomId, {
    query: {
      enabled: !!roomId && !!user,
      refetchInterval: 3000,
      queryKey: getGetChatMessagesQueryKey(roomId)
    }
  });

  const sendMutation = useSendChatMessage();

  useEffect(() => {
    if (!user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!user || !roomId) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    sendMutation.mutate({ roomId, data: { content } }, {
      onSuccess: () => {
        setContent("");
        queryClient.invalidateQueries({ queryKey: getGetChatMessagesQueryKey(roomId) });
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 mt-16 max-w-3xl w-full mx-auto flex flex-col p-4 md:p-8 h-[calc(100dvh-4rem)]">
        <h1 className="text-2xl font-bold mb-4">채팅방 #{roomId}</h1>
        
        <div className="flex-1 bg-card rounded-md border flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages?.length === 0 && (
              <div className="text-center text-muted-foreground py-8">메시지가 없습니다. 거래 상대방과 대화를 시작해보세요.</div>
            )}
            {messages?.map(msg => {
              const isMe = msg.senderId === user.id;
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-lg p-3 ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <div className="text-sm">{msg.content}</div>
                    <div className={`text-[10px] mt-1 opacity-70 ${isMe ? "text-right" : "text-left"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          
          <form onSubmit={handleSend} className="p-4 border-t bg-card flex gap-2">
            <Input 
              value={content} 
              onChange={e => setContent(e.target.value)} 
              placeholder="메시지를 입력하세요..." 
              className="flex-1"
              data-testid="input-chat-message"
            />
            <Button type="submit" disabled={sendMutation.isPending || !content.trim()} data-testid="button-chat-send">전송</Button>
          </form>
        </div>
      </main>
    </div>
  );
}
