import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useLogin,
  useTeacherLogin,
  getGetMeQueryKey,
  type AuthUser,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GraduationCap, School } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isValidTeacherCode,
  LOCAL_TEACHER_USER,
  setLocalTeacherUser,
  clearLocalTeacherUser,
} from "@/lib/local-teacher-auth";
import { useAuthUser, notifyLocalTeacherAuthChanged } from "@/hooks/use-auth-user";

const studentSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const teacherSchema = z.object({
  code: z.string().min(1, "Access code is required"),
});

type StudentFormValues = z.infer<typeof studentSchema>;
type TeacherFormValues = z.infer<typeof teacherSchema>;
type RoleChoice = "chooser" | "student" | "teacher";

function homeForRole(role?: string) {
  return role === "teacher" ? "/teacher" : "/tutoros";
}

function isMissingRouteError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  return status === 404 || status === 405;
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [roleChoice, setRoleChoice] = useState<RoleChoice>("chooser");
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [teacherPending, setTeacherPending] = useState(false);

  const { user, isAuthenticated } = useAuthUser();

  useEffect(() => {
    if (isAuthenticated && user) {
      setLocation(homeForRole(user.role));
    }
  }, [isAuthenticated, user, setLocation]);

  const loginMutation = useLogin();
  const teacherLoginMutation = useTeacherLogin();

  const studentForm = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: { username: "", password: "" },
  });

  const teacherForm = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: { code: "" },
  });

  const finishLogin = (data: AuthUser) => {
    queryClient.setQueryData(getGetMeQueryKey(), data);
    setLocation(homeForRole(data.role));
  };

  const onStudentSubmit = (values: StudentFormValues) => {
    clearLocalTeacherUser();
    notifyLocalTeacherAuthChanged();
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          finishLogin({ ...data, role: data.role ?? "member" });
        },
      },
    );
  };

  const onTeacherSubmit = async (values: TeacherFormValues) => {
    setTeacherError(null);
    setTeacherPending(true);

    if (!isValidTeacherCode(values.code)) {
      setTeacherError("Invalid teacher access code");
      setTeacherPending(false);
      return;
    }

    try {
      const data = await teacherLoginMutation.mutateAsync({
        data: { code: values.code.trim() },
      });
      finishLogin(data);
    } catch (error) {
      // Live API may not have teacher-login yet — unlock with local session.
      if (isMissingRouteError(error) || error instanceof TypeError) {
        const local = setLocalTeacherUser(LOCAL_TEACHER_USER);
        notifyLocalTeacherAuthChanged();
        finishLogin(local);
        return;
      }

      const message =
        error &&
        typeof error === "object" &&
        "data" in error &&
        error.data &&
        typeof error.data === "object" &&
        "error" in error.data &&
        typeof (error.data as { error?: unknown }).error === "string"
          ? (error.data as { error: string }).error
          : "Invalid access code. Please try again.";
      setTeacherError(message);
    } finally {
      setTeacherPending(false);
    }
  };

  return (
    <div className="min-h-[100dvh] relative overflow-hidden bg-[#f6f8fc]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(24,101,242,0.18), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(14,165,233,0.12), transparent)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col justify-center px-5 py-10">
        <div className="mb-8 text-center">
          <img
            src={`${import.meta.env.BASE_URL}nhs-logo.png`}
            alt="National Honor Society"
            className="mx-auto mb-5 h-20 w-auto"
          />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1865F2]">
            Leigh NHS Tutors
          </p>
          <h1
            className="mt-2 font-display text-4xl font-bold tracking-tight text-slate-900"
            data-testid="heading-login"
          >
            TutorOS
          </h1>
          <p className="mt-2 text-[15px] text-slate-600" data-testid="text-login-subtitle">
            Sign in to tutor students or assign tutoring requests
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur">
          {roleChoice === "chooser" && (
            <div className="space-y-5" data-testid="login-role-chooser">
              <div className="text-center">
                <h2 className="text-xl font-bold text-slate-900">Are you a student or a teacher?</h2>
                <p className="mt-1.5 text-sm text-slate-500">
                  Choose how you want to sign in
                </p>
              </div>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => setRoleChoice("student")}
                  className={cn(
                    "group flex items-center gap-4 rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-left transition",
                    "hover:border-[#1865F2] hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1865F2]",
                  )}
                  data-testid="button-choose-student"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#1865F2] transition group-hover:bg-[#1865F2] group-hover:text-white">
                    <GraduationCap className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="block text-base font-bold text-slate-900">Student</span>
                    <span className="block text-sm text-slate-500">
                      NHS tutors — username &amp; student ID
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRoleChoice("teacher")}
                  className={cn(
                    "group flex items-center gap-4 rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-left transition",
                    "hover:border-[#1865F2] hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1865F2]",
                  )}
                  data-testid="button-choose-teacher"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
                    <School className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="block text-base font-bold text-slate-900">Teacher</span>
                    <span className="block text-sm text-slate-500">
                      Assign students who need tutoring
                    </span>
                  </span>
                </button>
              </div>
            </div>
          )}

          {roleChoice === "student" && (
            <div data-testid="login-student-form">
              <button
                type="button"
                onClick={() => {
                  setRoleChoice("chooser");
                  loginMutation.reset();
                }}
                className="mb-4 text-sm font-semibold text-[#1865F2]"
              >
                ← Back
              </button>
              <h2 className="text-xl font-bold text-slate-900">Student sign in</h2>
              <p className="mt-1 text-sm text-slate-500">Use your NHS member credentials</p>

              {loginMutation.isError && (
                <Alert variant="destructive" className="mt-4" data-testid="alert-login-error">
                  <AlertDescription>
                    {loginMutation.error?.data?.error ||
                      "We couldn't sign you in. Please check your details and try again."}
                  </AlertDescription>
                </Alert>
              )}

              <Form {...studentForm}>
                <form
                  onSubmit={studentForm.handleSubmit(onStudentSubmit)}
                  className="mt-5 space-y-4"
                >
                  <FormField
                    control={studentForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="First-Last"
                            autoComplete="username"
                            autoCapitalize="none"
                            autoCorrect="off"
                            className="h-12 rounded-xl"
                            {...field}
                            data-testid="input-username"
                          />
                        </FormControl>
                        <p className="text-[13px] text-muted-foreground">
                          First and last name separated by a hyphen
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={studentForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="current-password"
                            placeholder="Student ID"
                            className="h-12 rounded-xl"
                            {...field}
                            data-testid="input-password"
                          />
                        </FormControl>
                        <p className="text-[13px] text-muted-foreground">Your student ID</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="h-12 w-full rounded-full bg-[#1865F2] text-base font-semibold hover:bg-[#1557d0]"
                    disabled={loginMutation.isPending}
                    data-testid="button-submit-login"
                  >
                    {loginMutation.isPending ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
              </Form>
            </div>
          )}

          {roleChoice === "teacher" && (
            <div data-testid="login-teacher-form">
              <button
                type="button"
                onClick={() => {
                  setRoleChoice("chooser");
                  teacherLoginMutation.reset();
                  setTeacherError(null);
                }}
                className="mb-4 text-sm font-semibold text-[#1865F2]"
              >
                ← Back
              </button>
              <h2 className="text-xl font-bold text-slate-900">Teacher sign in</h2>
              <p className="mt-1 text-sm text-slate-500">Enter the teacher access code</p>

              {teacherError && (
                <Alert variant="destructive" className="mt-4" data-testid="alert-teacher-login-error">
                  <AlertDescription>{teacherError}</AlertDescription>
                </Alert>
              )}

              <Form {...teacherForm}>
                <form
                  onSubmit={teacherForm.handleSubmit(onTeacherSubmit)}
                  className="mt-5 space-y-4"
                >
                  <FormField
                    control={teacherForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Access code</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="off"
                            placeholder="Enter code"
                            className="h-12 rounded-xl"
                            {...field}
                            data-testid="input-teacher-code"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="h-12 w-full rounded-full bg-emerald-600 text-base font-semibold hover:bg-emerald-700"
                    disabled={teacherPending}
                    data-testid="button-submit-teacher-login"
                  >
                    {teacherPending ? "Signing in..." : "Continue as teacher"}
                  </Button>
                </form>
              </Form>
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-sm text-slate-500" data-testid="text-support">
          Need help? Contact{" "}
          <a
            className="font-medium text-[#1865F2] underline-offset-4 hover:underline"
            href="mailto:562022@my.cuhsd.org"
          >
            562022@my.cuhsd.org
          </a>
        </p>
      </div>
    </div>
  );
}
