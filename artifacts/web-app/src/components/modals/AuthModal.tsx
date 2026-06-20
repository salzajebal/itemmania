import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/lib/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLogin, useRegister, getGetMeQueryKey, getGetWalletQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  nickname: z.string().min(2, "Nickname must be at least 2 characters"),
  phone: z.string().optional(),
});

export function AuthModal() {
  const { isModalOpen, setModalOpen, modalView, setModalView } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", nickname: "", phone: "" },
  });

  const onLogin = (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
          setModalOpen(false);
          toast({ title: "로그인 성공", description: "환영합니다!" });
        },
        onError: (err: any) => {
          toast({ title: "로그인 실패", description: err?.response?.data?.error || "오류가 발생했습니다.", variant: "destructive" });
        },
      }
    );
  };

  const onRegister = (values: z.infer<typeof registerSchema>) => {
    registerMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setModalOpen(false);
          toast({ title: "회원가입 성공", description: "환영합니다!" });
        },
        onError: (err: any) => {
          toast({ title: "회원가입 실패", description: err?.response?.data?.error || "오류가 발생했습니다.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={setModalOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{modalView === "login" ? "로그인" : "회원가입"}</DialogTitle>
        </DialogHeader>
        <Tabs value={modalView} onValueChange={(v) => setModalView(v as "login" | "register")}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login" data-testid="tab-login">로그인</TabsTrigger>
            <TabsTrigger value="register" data-testid="tab-register">회원가입</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이메일</FormLabel>
                      <FormControl>
                        <Input placeholder="user@example.com" {...field} data-testid="input-login-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>비밀번호</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="******" {...field} data-testid="input-login-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loginMutation.isPending} data-testid="button-login-submit">
                  {loginMutation.isPending ? "로그인 중..." : "로그인"}
                </Button>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="register">
            <Form {...registerForm}>
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                <FormField
                  control={registerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이메일</FormLabel>
                      <FormControl>
                        <Input placeholder="user@example.com" {...field} data-testid="input-register-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>비밀번호</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="******" {...field} data-testid="input-register-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="nickname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>닉네임</FormLabel>
                      <FormControl>
                        <Input placeholder="게이머123" {...field} data-testid="input-register-nickname" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>전화번호 (선택)</FormLabel>
                      <FormControl>
                        <Input placeholder="010-1234-5678" {...field} data-testid="input-register-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={registerMutation.isPending} data-testid="button-register-submit">
                  {registerMutation.isPending ? "가입 중..." : "회원가입"}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
