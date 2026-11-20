"use client";

import { useForm } from "@tanstack/react-form";
import { Loader2, Send } from "lucide-react";
import { z } from "zod";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const nameSchema = z.string().trim().min(2).max(100);
const emailSchema = z.string().trim().email().max(200);
const messageSchema = z.string().trim().min(10).max(5000);

export function ContactForm() {
  const t = useT("pages.contact");
  const { toast } = useToast();

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
      website: "", // honeypot
    },
    onSubmit: async ({ value }) => {
      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? t("failed"));
        }
        toast({ title: t("success") });
        form.reset();
      } catch (err) {
        toast({
          title: t("failed"),
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      className="grid content-start gap-4 rounded-2xl border border-border bg-card p-6"
    >
      <form.Field name="website">
        {(field) => (
          <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </label>
          </div>
        )}
      </form.Field>

      <form.Field
        name="name"
        validators={{
          onChange: ({ value }) =>
            nameSchema.safeParse(value).success ? undefined : t("name"),
        }}
      >
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor="name">{t("name")}</Label>
            <Input
              id="name"
              required
              minLength={2}
              maxLength={100}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>

      <form.Field
        name="email"
        validators={{
          onChange: ({ value }) =>
            emailSchema.safeParse(value).success ? undefined : t("email"),
        }}
      >
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              required
              maxLength={200}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>

      <form.Field name="subject">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor="subject">{t("subject")}</Label>
            <Input
              id="subject"
              maxLength={200}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>

      <form.Field
        name="message"
        validators={{
          onChange: ({ value }) =>
            messageSchema.safeParse(value).success ? undefined : t("message"),
        }}
      >
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor="message">{t("message")}</Label>
            <Textarea
              id="message"
              required
              minLength={10}
              maxLength={5000}
              rows={5}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="gap-2 bg-brand-gradient font-semibold text-slate-950 hover:opacity-90"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            {isSubmitting ? t("sending") : t("send")}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
