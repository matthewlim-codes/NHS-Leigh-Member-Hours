import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useChangePassword, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: user, isSuccess, isError, isLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false
    }
  });

  useEffect(() => {
    if (isError) {
      setLocation("/login");
    } else if (isSuccess && user && !user.mustChangePassword) {
      setLocation("/dashboard");
    }
  }, [isSuccess, isError, user, setLocation]);

  const changePasswordMutation = useChangePassword();

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = (values: ChangePasswordFormValues) => {
    changePasswordMutation.mutate(
      { 
        data: {
          currentPassword: values.currentPassword,
          newPassword: values.newPassword
        } 
      },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetMeQueryKey(), data);
          setLocation("/dashboard");
        },
      }
    );
  };

  if (isLoading) return null;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="bg-primary/10 p-4 rounded-full mb-4">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="heading-change-password">
            Secure your account
          </h1>
          <p className="text-muted-foreground mt-2" data-testid="text-change-password-subtitle">
            Please choose a new password for your first sign-in
          </p>
        </div>

        <Card className="shadow-lg border-muted/50">
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>
              To keep your member account secure, we ask everyone to set their own personal password when logging in for the first time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {changePasswordMutation.isError && (
              <Alert variant="destructive" className="mb-6" data-testid="alert-change-password-error">
                <AlertDescription>
                  {changePasswordMutation.error?.error || "We couldn't update your password. Please check your current password and try again."}
                </AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          autoComplete="current-password"
                          {...field} 
                          data-testid="input-current-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          autoComplete="new-password"
                          {...field} 
                          data-testid="input-new-password"
                        />
                      </FormControl>
                      <p className="text-[13px] text-muted-foreground mt-1">
                        Must be at least 8 characters long
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          autoComplete="new-password"
                          {...field} 
                          data-testid="input-confirm-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full text-base font-medium" 
                  size="lg"
                  disabled={changePasswordMutation.isPending}
                  data-testid="button-submit-change-password"
                >
                  {changePasswordMutation.isPending ? "Saving..." : "Save and continue"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
