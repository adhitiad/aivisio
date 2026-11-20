'use client'

import { useState } from 'react'
import { Check, ClipboardCopy, BookMarked, Wand2 } from 'lucide-react'
import { useT } from "@/lib/i18n";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { TOOLS } from '@/lib/tools'

export function PromptLibrary({ onUseTool }: { onUseTool: (toolId: string) => void }) {
  const { toast } = useToast()
  const t = useT()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyPrompt = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
      toast({ title: t('common.copied'), description: t('studio.copiedDesc') })
    } catch {
      toast({
        title: t('studio.copyFailed'),
        description: t('studio.copyFailedDesc'),
        variant: 'destructive',
      })
    }
  }

  return (
    <section id="prompt" className="scroll-mt-24 space-y-6">
      <div className="text-center space-y-3">
        <Badge
          variant="outline"
          className="border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:border-yellow-400/30 dark:text-yellow-300"
        >
          {t('promptLibrary.badge')}
        </Badge>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t('promptLibrary.titleA')}{' '}
          <span className="text-brand-gradient">{t('promptLibrary.titleB')}</span>
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          {t('promptLibrary.subtitle')}
        </p>
      </div>

      <Card className="border-border bg-card/70">
        <CardContent className="p-0">
          <Accordion type="single" collapsible className="w-full">
            {TOOLS.map((tool) => {
              const copied = copiedId === tool.id
              return (
                <AccordionItem
                  key={tool.id}
                  value={tool.id}
                  className="border-border px-4 sm:px-6"
                >
                  <AccordionTrigger className="hover:no-underline text-left gap-3 py-4">
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="shrink-0 font-mono text-sm text-yellow-600 dark:text-yellow-400">
                        {tool.step}.
                      </span>
                      <span className="font-medium text-base truncate">{tool.name}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pb-5">
                    <div className="rounded-lg border border-border bg-muted/40 p-4">
                      <p className="mb-2 text-xs font-bold tracking-widest text-yellow-600 dark:text-yellow-400">
                        {t('promptLibrary.promptLabel')}
                      </p>
                      <p className="text-sm leading-relaxed">
                        {tool.originalPrompt}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyPrompt(tool.id, tool.originalPrompt)}
                      >
                        {copied ? (
                          <>
                            <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />
                            {t('promptLibrary.copied')}
                          </>
                        ) : (
                          <>
                            <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
                            {t('promptLibrary.copyPrompt')}
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => onUseTool(tool.id)}
                        className="bg-brand-gradient text-slate-950 font-semibold hover:opacity-90 hover:text-slate-950"
                      >
                        <Wand2 className="h-4 w-4" aria-hidden="true" />
                        {t('promptLibrary.useInTool')}
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </CardContent>
      </Card>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <BookMarked className="h-3.5 w-3.5" aria-hidden="true" />
        {t('promptLibrary.tip')}
      </p>
    </section>
  )
}
